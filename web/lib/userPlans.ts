import "server-only";

/**
 * Per-user plans: the paid monitor quota. A user lifts the free 1-monitor cap
 * by streaming $POLYGRAPH to the treasury, exactly the ecosystem-monitoring
 * rail keyed by user instead of ecosystem (see lib/ecosystemPayments for the
 * pattern, lib/paymentRail for the shared onchain plumbing). The stream IS the
 * subscription: while a user_plan_payments row is status='active' with end_at
 * in the future, record_monitor grants the plan's quota; cancel and the quota
 * falls back to free within an hour of the next quota-relevant request.
 *
 * The RPC enforces quotas from the DB row alone (end_at); callers that are
 * about to hit the quota path should call getUserPlan() first so onchain
 * cancellation reconciles before enforcement.
 */

import { ethers } from "ethers";
import { getSupabaseAdmin } from "@/lib/supabase";
import {
  DEPOSIT_TOLERANCE,
  MIN_STREAM_SECONDS,
  MONTH_SECONDS,
  PAYMENT_CHAIN_ID,
  PLAN_PRICES_USD,
  PLAN_QUOTAS,
  planShapeTag,
  POLYGRAPH_TOKEN_ADDRESS,
  POLYGRAPH_TOKEN_DECIMALS,
  SABLIER_LOCKUP_ADDRESS,
  TREASURY_ADDRESS,
  type PlanId,
  type PlanQuote,
} from "@/lib/paymentConfig";
import {
  getTokenUsdRate,
  liveStreamStatus,
  readStreamCreation,
  usdToRawTokens,
} from "@/lib/paymentRail";

// Column-for-column mirror of user_plan_payments (see packages/core/src/types.ts).
export interface UserPlanPaymentRow {
  id: string;
  user_id: string;
  plan: PlanId;
  chain_id: number;
  sablier_contract: string;
  stream_id: number;
  tx_hash: string | null;
  token: string;
  token_decimals: number;
  deposit_amount: number;
  usd_monthly: number;
  usd_total: number;
  token_usd_rate: number;
  payer_address: string;
  start_at: string;
  end_at: string;
  status: "active" | "canceled" | "ended";
  verified_at: string;
  last_checked_at: string;
  created_at: string;
}

const PLAN_COLUMNS =
  "id, user_id, plan, chain_id, sablier_contract, stream_id, tx_hash, token, token_decimals, " +
  "deposit_amount, usd_monthly, usd_total, token_usd_rate, payer_address, start_at, end_at, " +
  "status, verified_at, last_checked_at, created_at";

const RECHECK_AFTER_MS = 60 * 60 * 1000;

export interface UserPlanState {
  plan: PlanId | "free";
  /** Active monitor slots this plan grants (admins are uncapped elsewhere). */
  quota: number;
  payment: UserPlanPaymentRow | null;
  /** When the paid plan lapses; null on free. */
  endAt: string | null;
}

const FREE: UserPlanState = { plan: "free", quota: PLAN_QUOTAS.free, payment: null, endAt: null };

/** The user's current plan, lazily reconciled with the chain. */
export async function getUserPlan(userId: string): Promise<UserPlanState> {
  const db = getSupabaseAdmin();
  if (!db) return FREE;

  const { data } = await db
    .from("user_plan_payments")
    .select(PLAN_COLUMNS)
    .eq("user_id", userId)
    .eq("status", "active")
    .order("verified_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  let payment = (data as UserPlanPaymentRow | null) ?? null;
  if (!payment) return FREE;

  payment = await refreshPlanStatus(payment);
  if (payment.status !== "active") return FREE;
  return {
    plan: payment.plan,
    quota: PLAN_QUOTAS[payment.plan],
    payment,
    endAt: payment.end_at,
  };
}

/** Same lazy reconcile as the ecosystem gate: expiry in SQL terms, cancel onchain. */
async function refreshPlanStatus(row: UserPlanPaymentRow): Promise<UserPlanPaymentRow> {
  const db = getSupabaseAdmin();
  if (!db) return row;

  if (new Date(row.end_at).getTime() <= Date.now()) {
    await db.from("user_plan_payments").update({ status: "ended" }).eq("id", row.id);
    return { ...row, status: "ended" };
  }

  if (Date.now() - new Date(row.last_checked_at).getTime() < RECHECK_AFTER_MS) return row;

  try {
    const live = await liveStreamStatus(row.sablier_contract, row.stream_id);
    const now = new Date().toISOString();
    if (live === "canceled") {
      await db
        .from("user_plan_payments")
        .update({ status: "canceled", last_checked_at: now })
        .eq("id", row.id);
      return { ...row, status: "canceled", last_checked_at: now };
    }
    if (live === "ended") {
      await db
        .from("user_plan_payments")
        .update({ status: "ended", last_checked_at: now })
        .eq("id", row.id);
      return { ...row, status: "ended", last_checked_at: now };
    }
    await db.from("user_plan_payments").update({ last_checked_at: now }).eq("id", row.id);
    return { ...row, last_checked_at: now };
  } catch (e) {
    console.error("[plans] onchain re-check failed", e);
    return row;
  }
}

// ── Quotes ───────────────────────────────────────────────────────────────────

const QUOTE_TTL_MS = 10 * 60 * 1000;

/** Live quote for one month of a plan, same shape the activate page uses. */
export async function buildPlanQuote(plan: PlanId): Promise<PlanQuote> {
  const usdMonthly = PLAN_PRICES_USD[plan];
  const rate = await getTokenUsdRate();
  const raw = usdToRawTokens(usdMonthly, rate);
  return {
    plan,
    usdMonthly,
    usdTotal: usdMonthly,
    tokenAmount: raw.toString(),
    tokenAmountDisplay: Number(ethers.formatUnits(raw, POLYGRAPH_TOKEN_DECIMALS)),
    tokenUsdRate: rate,
    expiresAt: Date.now() + QUOTE_TTL_MS,
    chainId: PAYMENT_CHAIN_ID,
    token: POLYGRAPH_TOKEN_ADDRESS,
    treasury: TREASURY_ADDRESS,
    lockup: SABLIER_LOCKUP_ADDRESS,
  };
}

// ── Onchain verification ─────────────────────────────────────────────────────

export type PlanVerifyResult =
  | { ok: true; payment: UserPlanPaymentRow }
  | { ok: false; reason: string };

/**
 * Verify a plan payment from its creation tx and record it. Same trust posture
 * as verifyStreamPayment: the stream comes from the event, the shape tag must
 * name THIS user (pgu: namespace — an ecosystem stream can never be claimed as
 * a plan or vice versa), and the deposit must cover the plan's monthly price
 * for the stream's duration at the current rate. The plan is the buyer's claim
 * checked against the deposit: claiming a pricier plan than was paid for fails
 * the deposit check.
 */
export async function verifyPlanStreamPayment(
  userId: string,
  plan: PlanId,
  txHash: string,
): Promise<PlanVerifyResult> {
  const db = getSupabaseAdmin();
  if (!db) return { ok: false, reason: "storage unconfigured" };
  if (!TREASURY_ADDRESS) return { ok: false, reason: "treasury address unconfigured" };

  const read = await readStreamCreation(txHash);
  if (!read.ok) return read;
  const onchain = read.onchain;

  const same = (a: string, b: string) => a.toLowerCase() === b.toLowerCase();
  if (onchain.shape !== planShapeTag(userId)) {
    return {
      ok: false,
      reason:
        "this stream wasn't created for this account's plan — pay on the upgrade page, or email hello@polygraph.so",
    };
  }
  if (!same(onchain.token, POLYGRAPH_TOKEN_ADDRESS)) {
    return { ok: false, reason: "stream token is not $POLYGRAPH" };
  }
  if (!same(onchain.recipient, TREASURY_ADDRESS)) {
    return { ok: false, reason: "stream recipient is not the polygraph treasury" };
  }
  if (onchain.canceled) return { ok: false, reason: "stream was canceled" };
  if (onchain.depleted) return { ok: false, reason: "stream is depleted" };
  if (onchain.endTime * 1000 <= Date.now()) return { ok: false, reason: "stream has ended" };
  const durationSeconds = onchain.endTime - onchain.startTime;
  if (durationSeconds < MIN_STREAM_SECONDS) {
    return { ok: false, reason: "stream is shorter than one month" };
  }

  const streamId = Number(onchain.streamId);

  // Idempotent re-verify; one stream backs one plan purchase.
  const { data: existing } = await db
    .from("user_plan_payments")
    .select(PLAN_COLUMNS)
    .eq("chain_id", PAYMENT_CHAIN_ID)
    .eq("sablier_contract", SABLIER_LOCKUP_ADDRESS)
    .eq("stream_id", streamId)
    .maybeSingle();
  const prior = (existing as UserPlanPaymentRow | null) ?? null;
  if (prior) {
    if (prior.user_id !== userId) {
      return { ok: false, reason: "stream already backs another account" };
    }
    return prior.status === "active"
      ? { ok: true, payment: prior }
      : { ok: false, reason: `stream already recorded as ${prior.status}` };
  }

  const usdMonthly = PLAN_PRICES_USD[plan];
  const months = durationSeconds / MONTH_SECONDS;
  const usdTotal = Math.round(usdMonthly * months * 100) / 100;
  let rate: number;
  try {
    rate = await getTokenUsdRate();
  } catch (e) {
    console.error("[plans] price fetch failed", e);
    return { ok: false, reason: "could not price $POLYGRAPH right now, retry shortly" };
  }
  const required = usdToRawTokens(usdTotal * DEPOSIT_TOLERANCE, rate);
  if (onchain.deposited < required) {
    return {
      ok: false,
      reason: `stream deposit is below $${usdMonthly.toLocaleString("en-US")}/month for its duration at the current rate`,
    };
  }

  const insert = {
    user_id: userId,
    plan,
    chain_id: PAYMENT_CHAIN_ID,
    sablier_contract: SABLIER_LOCKUP_ADDRESS,
    stream_id: streamId,
    tx_hash: txHash.toLowerCase(),
    token: POLYGRAPH_TOKEN_ADDRESS,
    token_decimals: POLYGRAPH_TOKEN_DECIMALS,
    deposit_amount: onchain.deposited.toString(),
    usd_monthly: usdMonthly,
    usd_total: usdTotal,
    token_usd_rate: rate,
    payer_address: onchain.sender,
    start_at: new Date(onchain.startTime * 1000).toISOString(),
    end_at: new Date(onchain.endTime * 1000).toISOString(),
    status: "active" as const,
  };
  const { data: created, error } = await db
    .from("user_plan_payments")
    .insert(insert)
    .select(PLAN_COLUMNS)
    .single();
  if (error || !created) {
    console.error("[plans] insert failed", error);
    return { ok: false, reason: "verified onchain but could not be recorded, retry" };
  }
  return { ok: true, payment: created as unknown as UserPlanPaymentRow };
}
