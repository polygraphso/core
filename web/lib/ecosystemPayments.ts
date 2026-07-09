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
 * (deepest Base pair), cached for a minute server-side.
 */

import { ethers } from "ethers";
import { getSupabaseAdmin } from "@/lib/supabase";
import type { EcosystemRow } from "@/lib/ecosystemTypes";
import {
  DEFAULT_MONTHLY_PRICE_USD,
  DEPOSIT_TOLERANCE,
  MIN_TERM_SECONDS,
  PAYMENT_CHAIN_ID,
  POLYGRAPH_TOKEN_ADDRESS,
  POLYGRAPH_TOKEN_DECIMALS,
  SABLIER_LOCKUP_ABI,
  SABLIER_LOCKUP_ADDRESS,
  STREAM_STATUS,
  TERM_MONTHS,
  TREASURY_ADDRESS,
  type PaymentQuote,
} from "@/lib/paymentConfig";

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
  status: "active" | "canceled" | "ended";
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
 * passed, and once an hour ask the Lockup contract whether the payer canceled.
 * Onchain read failures leave the row untouched (never lock out on RPC flake).
 */
async function refreshPaymentStatus(row: EcosystemPaymentRow): Promise<EcosystemPaymentRow> {
  const db = getSupabaseAdmin();
  if (!db) return row;

  if (new Date(row.end_at).getTime() <= Date.now()) {
    await db.from("ecosystem_payments").update({ status: "ended" }).eq("id", row.id);
    return { ...row, status: "ended" };
  }

  if (Date.now() - new Date(row.last_checked_at).getTime() < RECHECK_AFTER_MS) return row;

  try {
    const lockup = lockupContract(row.sablier_contract);
    const status = Number(await lockup.statusOf(row.stream_id));
    const now = new Date().toISOString();
    if (status === STREAM_STATUS.CANCELED) {
      await db
        .from("ecosystem_payments")
        .update({ status: "canceled", last_checked_at: now })
        .eq("id", row.id);
      return { ...row, status: "canceled", last_checked_at: now };
    }
    if (status === STREAM_STATUS.DEPLETED) {
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

// ── Pricing ──────────────────────────────────────────────────────────────────

const DEXSCREENER_URL = `https://api.dexscreener.com/latest/dex/tokens/${POLYGRAPH_TOKEN_ADDRESS}`;
const PRICE_TTL_MS = 60 * 1000;
const QUOTE_TTL_MS = 10 * 60 * 1000;

let priceCache: { rate: number; fetchedAt: number } | null = null;

interface DexScreenerPair {
  chainId?: string;
  priceUsd?: string;
  liquidity?: { usd?: number };
}

/** USD per $POLYGRAPH from the deepest Base pair. Throws when unavailable. */
export async function getTokenUsdRate(): Promise<number> {
  if (priceCache && Date.now() - priceCache.fetchedAt < PRICE_TTL_MS) return priceCache.rate;
  const res = await fetch(DEXSCREENER_URL, { cache: "no-store" });
  if (!res.ok) throw new Error(`dexscreener ${res.status}`);
  const body = (await res.json()) as { pairs?: DexScreenerPair[] };
  const best = (body.pairs ?? [])
    .filter((p) => p.chainId === "base" && p.priceUsd)
    .sort((a, b) => (b.liquidity?.usd ?? 0) - (a.liquidity?.usd ?? 0))[0];
  const rate = best ? Number.parseFloat(best.priceUsd as string) : NaN;
  if (!Number.isFinite(rate) || rate <= 0) throw new Error("no usable POLYGRAPH price");
  priceCache = { rate, fetchedAt: Date.now() };
  return rate;
}

/** Convert a USD total into raw token units at the given rate. */
function usdToRawTokens(usdTotal: number, rate: number): bigint {
  const tokens = usdTotal / rate;
  // 6 fractional digits is far inside the 5% verify tolerance; parseUnits keeps
  // the 1e18 scaling exact.
  return ethers.parseUnits(tokens.toFixed(6), POLYGRAPH_TOKEN_DECIMALS);
}

/** Build the live quote the activation page renders and the create tx uses. */
export async function buildPaymentQuote(
  ecosystem: Pick<EcosystemRow, "monthly_price_usd">,
): Promise<PaymentQuote> {
  const usdMonthly = effectiveMonthlyPriceUsd(ecosystem);
  const usdTotal = usdMonthly * TERM_MONTHS;
  const rate = await getTokenUsdRate();
  const raw = usdToRawTokens(usdTotal, rate);
  return {
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

function lockupContract(address: string = SABLIER_LOCKUP_ADDRESS): ethers.Contract {
  const rpc = process.env.BASE_RPC_URL?.trim() || "https://mainnet.base.org";
  return new ethers.Contract(address, SABLIER_LOCKUP_ABI, new ethers.JsonRpcProvider(rpc));
}

export type VerifyResult =
  | { ok: true; payment: EcosystemPaymentRow }
  | { ok: false; reason: string };

/**
 * Read the stream the client says it created and, when it checks out, record it
 * as this ecosystem's payment. Stateless with respect to the quote: the price is
 * re-fetched here and the deposit must cover ≥95% of the USD-pegged amount, so a
 * quote can't be replayed after the token moves.
 */
export async function verifyStreamPayment(
  ecosystem: Pick<EcosystemRow, "id" | "monthly_price_usd">,
  streamId: number,
  txHash: string | null,
): Promise<VerifyResult> {
  const db = getSupabaseAdmin();
  if (!db) return { ok: false, reason: "storage unconfigured" };
  if (!TREASURY_ADDRESS) return { ok: false, reason: "treasury address unconfigured" };
  if (!Number.isInteger(streamId) || streamId < 0) {
    return { ok: false, reason: "invalid stream id" };
  }

  // Idempotent re-verify; a stream can back only one ecosystem.
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

  let onchain: {
    token: string;
    recipient: string;
    sender: string;
    deposited: bigint;
    startTime: number;
    endTime: number;
    canceled: boolean;
    depleted: boolean;
  };
  try {
    const lockup = lockupContract();
    // Sequential on purpose: the default public Base RPC rate-limits a parallel
    // burst of eth_calls (observed live); a one-shot verify can afford ~1s.
    const token = await lockup.getUnderlyingToken(streamId);
    const recipient = await lockup.getRecipient(streamId);
    const sender = await lockup.getSender(streamId);
    const deposited = await lockup.getDepositedAmount(streamId);
    const startTime = await lockup.getStartTime(streamId);
    const endTime = await lockup.getEndTime(streamId);
    const canceled = await lockup.wasCanceled(streamId);
    const depleted = await lockup.isDepleted(streamId);
    onchain = {
      token: String(token),
      recipient: String(recipient),
      sender: String(sender),
      deposited: BigInt(deposited),
      startTime: Number(startTime),
      endTime: Number(endTime),
      canceled: Boolean(canceled),
      depleted: Boolean(depleted),
    };
  } catch (e) {
    console.error("[payments] stream read failed", e);
    return { ok: false, reason: "could not read the stream onchain" };
  }

  const same = (a: string, b: string) => a.toLowerCase() === b.toLowerCase();
  if (!same(onchain.token, POLYGRAPH_TOKEN_ADDRESS)) {
    return { ok: false, reason: "stream token is not $POLYGRAPH" };
  }
  if (!same(onchain.recipient, TREASURY_ADDRESS)) {
    return { ok: false, reason: "stream recipient is not the polygraph treasury" };
  }
  if (onchain.canceled) return { ok: false, reason: "stream was canceled" };
  if (onchain.depleted) return { ok: false, reason: "stream is depleted" };
  if (onchain.endTime * 1000 <= Date.now()) return { ok: false, reason: "stream has ended" };
  if (onchain.endTime - onchain.startTime < MIN_TERM_SECONDS) {
    return { ok: false, reason: `stream is shorter than the ${TERM_MONTHS}-month term` };
  }

  const usdMonthly = effectiveMonthlyPriceUsd(ecosystem);
  const usdTotal = usdMonthly * TERM_MONTHS;
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
      reason: `stream deposit is below the $${usdTotal.toLocaleString("en-US")} commitment at the current rate`,
    };
  }

  const insert = {
    ecosystem_id: ecosystem.id,
    chain_id: PAYMENT_CHAIN_ID,
    sablier_contract: SABLIER_LOCKUP_ADDRESS,
    stream_id: streamId,
    tx_hash: txHash,
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
