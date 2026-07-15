import "server-only";

/**
 * The paid-monitoring gate. An ecosystem is 'active' when it is comped
 * (monthly_price_usd = 0) or has a verified, still-live Sablier stream of
 * $POLYGRAPH to the treasury (an ecosystem_payments row with status='active'
 * and end_at in the future). Everything else is 'unpaid' — the /manage console
 * redirects to the activation page and the manage APIs return 402.
 *
 * The stream is the source of truth: status is re-checked onchain (statusOf)
 * when a row hasn't been looked at for an hour, so a payer canceling mid-term
 * flips the gate within an hour of the next dashboard visit. RPC failures never
 * lock a paying customer out — the row stays as-is and the check retries later.
 *
 * Pricing is USD-pegged at quote time via the token's DexScreener price
 * (deepest Base pair), cached for a minute server-side. The onchain plumbing
 * (provider, stream reads, pricing) is shared with the per-user plan rail —
 * see lib/paymentRail.
 */

import { ethers } from "ethers";
import { getSupabaseAdmin } from "@/lib/supabase";
import type { EcosystemRow } from "@/lib/ecosystemTypes";
import {
  billedMonths,
  DEFAULT_MONTHLY_PRICE_USD,
  DEPOSIT_TOLERANCE,
  MIN_STREAM_SECONDS,
  MONTH_SECONDS,
  PAYMENT_CHAIN_ID,
  paymentShapeTag,
  POLYGRAPH_TOKEN_ADDRESS,
  POLYGRAPH_TOKEN_DECIMALS,
  SABLIER_LOCKUP_ADDRESS,
  termDurationSeconds,
  TREASURY_ADDRESS,
  type BillingTerm,
  type PaymentQuote,
} from "@/lib/paymentConfig";
import {
  getTokenUsdRate,
  liveStreamStatus,
  readStreamCreation,
  usdToRawTokens,
} from "@/lib/paymentRail";

export { getTokenUsdRate };

// Column-for-column mirror of ecosystem_payments (see packages/core/src/types.ts).
export interface EcosystemPaymentRow {
  id: string;
  ecosystem_id: string;
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
  status: "active" | "canceled" | "ended" | "stopped";
  verified_at: string;
  last_checked_at: string;
  created_at: string;
}

const PAYMENT_COLUMNS =
  "id, ecosystem_id, chain_id, sablier_contract, stream_id, tx_hash, token, token_decimals, " +
  "deposit_amount, usd_monthly, usd_total, token_usd_rate, payer_address, start_at, end_at, " +
  "status, verified_at, last_checked_at, created_at";

const RECHECK_AFTER_MS = 60 * 60 * 1000;

/** Effective monitoring price. null override = app default; 0 = comped. */
export function effectiveMonthlyPriceUsd(
  ecosystem: Pick<EcosystemRow, "monthly_price_usd">,
): number {
  return ecosystem.monthly_price_usd ?? DEFAULT_MONTHLY_PRICE_USD;
}

export interface PaymentGate {
  status: "active" | "unpaid";
  /** True when the ecosystem is comped and no stream is required. */
  exempt: boolean;
  payment: EcosystemPaymentRow | null;
}

/**
 * The one question the console, the manage APIs, and the digest ask: is this
 * ecosystem paid up right now?
 */
export async function getPaymentGate(
  ecosystem: Pick<EcosystemRow, "id" | "monthly_price_usd">,
): Promise<PaymentGate> {
  if (effectiveMonthlyPriceUsd(ecosystem) === 0) {
    return { status: "active", exempt: true, payment: null };
  }
  const db = getSupabaseAdmin();
  if (!db) return { status: "unpaid", exempt: false, payment: null };

  const { data } = await db
    .from("ecosystem_payments")
    .select(PAYMENT_COLUMNS)
    .eq("ecosystem_id", ecosystem.id)
    .eq("status", "active")
    .order("verified_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  let payment = (data as EcosystemPaymentRow | null) ?? null;
  if (!payment) return { status: "unpaid", exempt: false, payment: null };

  payment = await refreshPaymentStatus(payment);
  return payment.status === "active"
    ? { status: "active", exempt: false, payment }
    : { status: "unpaid", exempt: false, payment };
}

/**
 * Lazily reconcile a payment row with the chain: expire it when end_at has
 * passed, and once an hour (or immediately when `force`) ask the Lockup
 * contract whether the payer canceled. Onchain read failures leave the row
 * untouched (never lock out on RPC flake). `force` is used right after a user
 * cancels in the UI so the change reflects without waiting out the hour.
 */
async function refreshPaymentStatus(
  row: EcosystemPaymentRow,
  force = false,
): Promise<EcosystemPaymentRow> {
  const db = getSupabaseAdmin();
  if (!db) return row;

  if (new Date(row.end_at).getTime() <= Date.now()) {
    await db.from("ecosystem_payments").update({ status: "ended" }).eq("id", row.id);
    return { ...row, status: "ended" };
  }

  if (!force && Date.now() - new Date(row.last_checked_at).getTime() < RECHECK_AFTER_MS) return row;

  try {
    const live = await liveStreamStatus(row.sablier_contract, row.stream_id);
    const now = new Date().toISOString();
    if (live === "canceled") {
      await db
        .from("ecosystem_payments")
        .update({ status: "canceled", last_checked_at: now })
        .eq("id", row.id);
      return { ...row, status: "canceled", last_checked_at: now };
    }
    if (live === "ended") {
      await db
        .from("ecosystem_payments")
        .update({ status: "ended", last_checked_at: now })
        .eq("id", row.id);
      return { ...row, status: "ended", last_checked_at: now };
    }
    await db.from("ecosystem_payments").update({ last_checked_at: now }).eq("id", row.id);
    return { ...row, last_checked_at: now };
  } catch (e) {
    console.error("[payments] onchain re-check failed", e);
    return row;
  }
}

/**
 * Force an immediate onchain re-check of the ecosystem's active payment and
 * return the reconciled status. Called by the payment/refresh route right after
 * a user cancels the stream in the UI. No-ops to "unpaid" when there's no
 * active row (already canceled/ended).
 */
export async function reconcileEcosystemPayment(
  ecosystemId: string,
): Promise<"active" | "canceled" | "ended" | "stopped" | "unpaid"> {
  const db = getSupabaseAdmin();
  if (!db) return "unpaid";

  // An admin-stopped stream the payer may just have canceled: reconcile it so
  // the "cancel to reclaim" notice clears. refreshPaymentStatus never writes
  // 'active', so a stopped row can only move to 'canceled'/'ended'.
  const stopped = await getStoppedPayment(ecosystemId);
  if (stopped) await refreshPaymentStatus(stopped, true);

  const { data } = await db
    .from("ecosystem_payments")
    .select(PAYMENT_COLUMNS)
    .eq("ecosystem_id", ecosystemId)
    .eq("status", "active")
    .order("verified_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  const row = (data as EcosystemPaymentRow | null) ?? null;
  if (!row) return "unpaid";
  const reconciled = await refreshPaymentStatus(row, true);
  return reconciled.status === "active" ? "active" : reconciled.status;
}

// ── Admin stop ───────────────────────────────────────────────────────────────

/**
 * Stop the ecosystem's active subscription server-side (admin action): the
 * manage console locks now, but the payer's stream keeps running onchain until
 * THEY cancel it — Sablier's cancel is sender-only, and the payer is the
 * sender. Returns the stopped row, or null when there's nothing active to stop
 * (including a concurrent cancel racing this — the guard only flips an
 * 'active' row).
 */
export async function stopEcosystemPayment(
  ecosystemId: string,
): Promise<EcosystemPaymentRow | null> {
  const db = getSupabaseAdmin();
  if (!db) return null;
  const { data } = await db
    .from("ecosystem_payments")
    .select(PAYMENT_COLUMNS)
    .eq("ecosystem_id", ecosystemId)
    .eq("status", "active")
    .order("verified_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  const row = (data as EcosystemPaymentRow | null) ?? null;
  if (!row) return null;
  const now = new Date().toISOString();
  const { data: updated, error } = await db
    .from("ecosystem_payments")
    .update({ status: "stopped", last_checked_at: now })
    .eq("id", row.id)
    .eq("status", "active")
    .select(PAYMENT_COLUMNS)
    .maybeSingle();
  if (error) {
    console.error("[payments] stop failed", error);
    return null;
  }
  return (updated as EcosystemPaymentRow | null) ?? null;
}

/**
 * The newest admin-stopped monitoring stream that is still running onchain
 * (end_at in the future) — the manage console's "cancel to reclaim the
 * remainder" notice. A lapsed stream has nothing left to reclaim and is
 * excluded.
 */
export async function getStoppedPayment(
  ecosystemId: string,
): Promise<EcosystemPaymentRow | null> {
  const db = getSupabaseAdmin();
  if (!db) return null;
  const { data } = await db
    .from("ecosystem_payments")
    .select(PAYMENT_COLUMNS)
    .eq("ecosystem_id", ecosystemId)
    .eq("status", "stopped")
    .gt("end_at", new Date().toISOString())
    .order("verified_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  return (data as EcosystemPaymentRow | null) ?? null;
}

// ── Quotes ───────────────────────────────────────────────────────────────────

const QUOTE_TTL_MS = 10 * 60 * 1000;

/**
 * Build the live quote the activation page renders and the create tx uses.
 * The quote is for ONE billing term — a month, or a year billed as 10 months;
 * renewal is the next stream.
 */
export async function buildPaymentQuote(
  ecosystem: Pick<EcosystemRow, "monthly_price_usd">,
  term: BillingTerm = "monthly",
): Promise<PaymentQuote> {
  const usdMonthly = effectiveMonthlyPriceUsd(ecosystem);
  const durationSeconds = termDurationSeconds(term);
  const usdTotal = Math.round(usdMonthly * billedMonths(durationSeconds / MONTH_SECONDS) * 100) / 100;
  const rate = await getTokenUsdRate();
  const raw = usdToRawTokens(usdTotal, rate);
  return {
    term,
    durationSeconds,
    usdMonthly,
    usdTotal,
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

export type VerifyResult =
  | { ok: true; payment: EcosystemPaymentRow }
  | { ok: false; reason: string };

/**
 * Verify a payment from its CREATION TRANSACTION and, when it checks out,
 * record it as this ecosystem's payment. The stream is derived from the tx's
 * CreateLockupLinearStream event — never from a client-supplied id — and the
 * event's `shape` must carry this ecosystem's tag (paymentShapeTag, written by
 * our create flow). That binding is what stops someone pasting another
 * client's fresh, not-yet-verified stream and claiming it for their own
 * ecosystem: the tag names the ecosystem it was created for.
 *
 * Stateless with respect to the quote: the price is re-fetched here and the
 * deposit must cover ≥95% of the monthly price × the stream's duration, so a
 * quote can't be replayed after the token moves.
 */
export async function verifyStreamPayment(
  ecosystem: Pick<EcosystemRow, "id" | "slug" | "monthly_price_usd">,
  txHash: string,
): Promise<VerifyResult> {
  const db = getSupabaseAdmin();
  if (!db) return { ok: false, reason: "storage unconfigured" };
  if (!TREASURY_ADDRESS) return { ok: false, reason: "treasury address unconfigured" };

  const read = await readStreamCreation(txHash);
  if (!read.ok) return read;
  const onchain = read.onchain;

  const same = (a: string, b: string) => a.toLowerCase() === b.toLowerCase();
  if (onchain.shape !== paymentShapeTag(ecosystem.slug)) {
    return {
      ok: false,
      reason:
        "this stream wasn't created for this ecosystem — pay on this page, or email hello@polygraph.so to attach a stream created elsewhere",
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

  // Idempotent re-verify; a stream can back only one ecosystem. (The shape tag
  // already binds it, but the unique row keeps history honest.)
  const { data: existing } = await db
    .from("ecosystem_payments")
    .select(PAYMENT_COLUMNS)
    .eq("chain_id", PAYMENT_CHAIN_ID)
    .eq("sablier_contract", SABLIER_LOCKUP_ADDRESS)
    .eq("stream_id", streamId)
    .maybeSingle();
  const prior = (existing as EcosystemPaymentRow | null) ?? null;
  if (prior) {
    if (prior.ecosystem_id !== ecosystem.id) {
      return { ok: false, reason: "stream already backs another ecosystem" };
    }
    return prior.status === "active"
      ? { ok: true, payment: prior }
      : { ok: false, reason: `stream already recorded as ${prior.status}` };
  }

  // Rate-based: the deposit must cover the monthly price for however long the
  // stream runs — a 1-month stream needs one month's worth, a 6-month stream
  // six. Prepaying more months in one stream is fine at the same rate, and
  // every full 12-month block bills as 10 (billedMonths — the yearly deal).
  const usdMonthly = effectiveMonthlyPriceUsd(ecosystem);
  const usdTotal = Math.round(usdMonthly * billedMonths(durationSeconds / MONTH_SECONDS) * 100) / 100;
  let rate: number;
  try {
    rate = await getTokenUsdRate();
  } catch (e) {
    console.error("[payments] price fetch failed", e);
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
    ecosystem_id: ecosystem.id,
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
    .from("ecosystem_payments")
    .insert(insert)
    .select(PAYMENT_COLUMNS)
    .single();
  if (error || !created) {
    console.error("[payments] insert failed", error);
    return { ok: false, reason: "verified onchain but could not be recorded, retry" };
  }
  return { ok: true, payment: created as unknown as EcosystemPaymentRow };
}
