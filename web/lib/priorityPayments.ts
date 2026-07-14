import "server-only";

/**
 * Priority grading: the paid 48h lane on the /request queue. Unlike ecosystem
 * monitoring and plans (streams), this is a ONE-TIME transfer, so it can't ride
 * the Sablier shape-tag binding. Attribution instead rides a unique EXACT
 * amount: each quote's raw token amount carries randomized atto-scale dust
 * digits, kept unique among open quotes by a partial unique index, so a
 * Transfer of exactly that amount to the treasury can only be the payment for
 * that one quote. (Same trick commerce processors use with unique cents.) The
 * dust is sub-attodollar — far below the 6-decimal pricing granularity — so it
 * costs the payer nothing and never rounds into the price.
 *
 * The fee buys turnaround, never the grade: on payment we stamp
 * grade_requests.priority_paid_at + a 48h deadline; fulfillment is the same
 * manual drain, priority rows first.
 */

import { ethers } from "ethers";
import { getSupabaseAdmin } from "@/lib/supabase";
import {
  ERC20_ABI,
  PAYMENT_CHAIN_ID,
  POLYGRAPH_TOKEN_ADDRESS,
  POLYGRAPH_TOKEN_DECIMALS,
  PRIORITY_GRADE_PRICE_USD,
  TREASURY_ADDRESS,
  type PriorityQuote,
} from "@/lib/paymentConfig";
import { getTokenUsdRate, paymentProvider, usdToRawTokens } from "@/lib/paymentRail";

// Column-for-column mirror of grade_request_payments (see packages/core/src/types.ts).
export interface GradeRequestPaymentRow {
  id: string;
  grade_request_id: string;
  chain_id: number;
  token: string;
  token_decimals: number;
  treasury: string;
  expected_amount: string;
  usd_price: number;
  token_usd_rate: number;
  status: "pending" | "paid" | "expired";
  tx_hash: string | null;
  payer_address: string | null;
  expires_at: string;
  paid_at: string | null;
  created_at: string;
}

const PAYMENT_COLUMNS =
  "id, grade_request_id, chain_id, token, token_decimals, treasury, expected_amount, " +
  "usd_price, token_usd_rate, status, tx_hash, payer_address, expires_at, paid_at, created_at";

const QUOTE_TTL_MS = 30 * 60 * 1000;
/** 24h after a quote expires, an exact-amount match still attributes (grace). */
const GRACE_MS = 24 * 60 * 60 * 1000;
const PRIORITY_SLA_MS = 48 * 60 * 60 * 1000;

/**
 * Randomize the lowest DUST_DIGITS raw digits so the expected amount is unique.
 * 9 digits at 18 decimals is the 1e-9 token place — worth a fraction of an
 * attodollar, invisible next to the 6-decimal price. Keeps the amount strictly
 * within the same integer token count.
 */
const DUST_DIGITS = 9;
const DUST_MODULUS = BigInt("1000000000"); // 10 ** 9
const ONE = BigInt(1);

function applyDust(base: bigint, seed: number): bigint {
  // Clear the low digits, then set them to a nonzero dust value derived from
  // the seed. +1 guarantees nonzero so the amount always shifts off the round
  // number (two different quotes at the same price still differ).
  const cleared = (base / DUST_MODULUS) * DUST_MODULUS;
  const dust = (BigInt(Math.floor(seed)) % (DUST_MODULUS - ONE)) + ONE;
  return cleared + dust;
}

/**
 * Build (or reuse) a pending quote for a request's priority upgrade. Retries on
 * the rare dust collision (the partial unique index rejects a duplicate open
 * amount). Returns null if the request is already paid or gone.
 */
export async function buildPriorityQuote(
  requestId: string,
): Promise<{ ok: true; quote: PriorityQuote } | { ok: false; reason: string }> {
  const db = getSupabaseAdmin();
  if (!db) return { ok: false, reason: "storage unconfigured" };
  if (!TREASURY_ADDRESS) return { ok: false, reason: "treasury address unconfigured" };

  const { data: reqRow } = await db
    .from("grade_requests")
    .select("id, target, status, priority_paid_at")
    .eq("id", requestId)
    .maybeSingle();
  if (!reqRow) return { ok: false, reason: "unknown request" };
  if (reqRow.priority_paid_at) return { ok: false, reason: "already on the priority lane" };
  if (reqRow.status === "completed" || reqRow.status === "declined") {
    return { ok: false, reason: "this request is already resolved" };
  }

  const rate = await getTokenUsdRate();
  const base = usdToRawTokens(PRIORITY_GRADE_PRICE_USD, rate);
  const expiresAt = new Date(Date.now() + QUOTE_TTL_MS).toISOString();

  // A few attempts to dodge a dust collision on the open-amount unique index.
  for (let attempt = 0; attempt < 6; attempt++) {
    const seed = (Date.now() % 1_000_000) * 61 + attempt * 7919 + requestId.charCodeAt(attempt % requestId.length) * 131;
    const amount = applyDust(base, seed);
    const { data, error } = await db
      .from("grade_request_payments")
      .insert({
        grade_request_id: requestId,
        chain_id: PAYMENT_CHAIN_ID,
        token: POLYGRAPH_TOKEN_ADDRESS,
        token_decimals: POLYGRAPH_TOKEN_DECIMALS,
        treasury: TREASURY_ADDRESS,
        expected_amount: amount.toString(),
        usd_price: PRIORITY_GRADE_PRICE_USD,
        token_usd_rate: rate,
        expires_at: expiresAt,
      })
      .select(PAYMENT_COLUMNS)
      .single();
    if (!error && data) {
      const row = data as unknown as GradeRequestPaymentRow;
      return {
        ok: true,
        quote: quoteFromRow(row, reqRow.target as string),
      };
    }
    // 23505 = unique_violation: dust collided with another open quote, retry.
    if (error && error.code !== "23505") {
      console.error("[priority] quote insert failed", error);
      return { ok: false, reason: "could not create the quote, retry" };
    }
  }
  return { ok: false, reason: "could not allocate a unique amount, retry" };
}

function quoteFromRow(row: GradeRequestPaymentRow, target: string): PriorityQuote {
  const raw = BigInt(row.expected_amount);
  return {
    requestId: row.grade_request_id,
    target,
    usdPrice: row.usd_price,
    tokenAmount: raw.toString(),
    tokenAmountDisplay: Number(ethers.formatUnits(raw, POLYGRAPH_TOKEN_DECIMALS)),
    tokenUsdRate: row.token_usd_rate,
    expiresAt: new Date(row.expires_at).getTime(),
    chainId: row.chain_id,
    token: row.token,
    treasury: row.treasury,
  };
}

/**
 * Scan a receipt's logs for a $POLYGRAPH Transfer to `treasury` of exactly
 * `amount`. Pure so it can be unit-tested against fixture logs. Returns the
 * payer (`from`) on a match, else null.
 */
export function findMatchingTransfer(
  logs: ReadonlyArray<{ address: string; topics: ReadonlyArray<string>; data: string }>,
  token: string,
  treasury: string,
  amount: bigint,
): { from: string } | null {
  const iface = new ethers.Interface(ERC20_ABI);
  const tokenLc = token.toLowerCase();
  const treasuryLc = treasury.toLowerCase();
  for (const log of logs) {
    if (log.address.toLowerCase() !== tokenLc) continue;
    let parsed: ethers.LogDescription | null = null;
    try {
      parsed = iface.parseLog({ topics: [...log.topics], data: log.data });
    } catch {
      continue;
    }
    if (parsed?.name !== "Transfer") continue;
    const to = String(parsed.args.to).toLowerCase();
    if (to !== treasuryLc) continue;
    if (BigInt(parsed.args.value) !== amount) continue;
    return { from: String(parsed.args.from) };
  }
  return null;
}

export type PriorityVerifyResult =
  | { ok: true; deadlineAt: string }
  | { ok: false; reason: string };

/**
 * Verify a priority payment from its transfer tx. The tx must contain a
 * $POLYGRAPH Transfer to the treasury of the exact quoted amount for THIS
 * request; that exact amount is the whole binding (unique among open quotes),
 * so the payer wallet is irrelevant (anyone may pay). Idempotent for a tx
 * already recorded on this request.
 */
export async function verifyTransferPayment(
  requestId: string,
  txHash: string,
): Promise<PriorityVerifyResult> {
  const db = getSupabaseAdmin();
  if (!db) return { ok: false, reason: "storage unconfigured" };

  // Already paid? (idempotent — re-submitting the same tx is fine.)
  const { data: reqRow } = await db
    .from("grade_requests")
    .select("id, status, priority_paid_at, priority_deadline_at")
    .eq("id", requestId)
    .maybeSingle();
  if (!reqRow) return { ok: false, reason: "unknown request" };
  if (reqRow.priority_paid_at && reqRow.priority_deadline_at) {
    return { ok: true, deadlineAt: reqRow.priority_deadline_at as string };
  }

  // Candidate open quotes for this request: pending, and within the grace
  // window (exactness still binds even just after expiry).
  const { data: quotes } = await db
    .from("grade_request_payments")
    .select(PAYMENT_COLUMNS)
    .eq("grade_request_id", requestId)
    .eq("status", "pending")
    .gt("expires_at", new Date(Date.now() - GRACE_MS).toISOString());
  const openQuotes = (quotes ?? []) as unknown as GradeRequestPaymentRow[];
  if (openQuotes.length === 0) {
    return { ok: false, reason: "no open quote for this request — get a fresh quote and pay again" };
  }

  // If this tx already recorded a payment (any request), don't double-count.
  const { data: dup } = await db
    .from("grade_request_payments")
    .select("id, grade_request_id")
    .eq("tx_hash", txHash.toLowerCase())
    .maybeSingle();
  if (dup) {
    return dup.grade_request_id === requestId
      ? { ok: true, deadlineAt: (reqRow.priority_deadline_at as string) ?? new Date(Date.now() + PRIORITY_SLA_MS).toISOString() }
      : { ok: false, reason: "this transaction already paid another request" };
  }

  // Read the receipt once; match its Transfer logs against each open quote.
  let logs: ReadonlyArray<{ address: string; topics: ReadonlyArray<string>; data: string }>;
  let receiptOk = false;
  try {
    const provider = await paymentProvider();
    const receipt = await provider.getTransactionReceipt(txHash);
    if (!receipt) {
      return {
        ok: false,
        reason:
          "transaction not found on Base mainnet — if it just went through, retry in a few seconds; make sure it's a Base transaction",
      };
    }
    if (receipt.status !== 1) return { ok: false, reason: "transaction reverted" };
    receiptOk = true;
    logs = receipt.logs.map((l) => ({ address: l.address, topics: [...l.topics], data: l.data }));
  } catch (e) {
    console.error("[priority] receipt read failed", e);
    return { ok: false, reason: "could not read the transaction onchain" };
  }
  if (!receiptOk) return { ok: false, reason: "could not read the transaction onchain" };

  const matched = openQuotes
    .map((q) => ({ q, hit: findMatchingTransfer(logs, q.token, q.treasury, BigInt(q.expected_amount)) }))
    .find((m) => m.hit);
  if (!matched || !matched.hit) {
    return {
      ok: false,
      reason:
        "this transaction has no $POLYGRAPH transfer matching the quoted amount — pay the exact amount shown, or get a fresh quote",
    };
  }

  const now = new Date();
  const deadline = new Date(now.getTime() + PRIORITY_SLA_MS).toISOString();

  const { error: payErr } = await db
    .from("grade_request_payments")
    .update({
      status: "paid",
      tx_hash: txHash.toLowerCase(),
      payer_address: matched.hit.from,
      paid_at: now.toISOString(),
    })
    .eq("id", matched.q.id)
    .eq("status", "pending"); // guard against a concurrent claim
  if (payErr) {
    console.error("[priority] payment update failed", payErr);
    return { ok: false, reason: "verified onchain but could not be recorded, retry" };
  }

  const { error: reqErr } = await db
    .from("grade_requests")
    .update({ priority_paid_at: now.toISOString(), priority_deadline_at: deadline })
    .eq("id", requestId);
  if (reqErr) {
    console.error("[priority] request stamp failed", reqErr);
    return { ok: false, reason: "payment recorded but the request could not be flagged — email hello@polygraph.so" };
  }

  return { ok: true, deadlineAt: deadline };
}

/** Open priority requests for the admin lane, soonest deadline first. */
export interface PriorityLaneRow {
  id: string;
  target: string;
  status: string;
  priority_paid_at: string;
  priority_deadline_at: string;
}

export async function getPriorityLane(limit = 25): Promise<PriorityLaneRow[]> {
  const db = getSupabaseAdmin();
  if (!db) return [];
  const { data } = await db
    .from("grade_requests")
    .select("id, target, status, priority_paid_at, priority_deadline_at")
    .not("priority_paid_at", "is", null)
    .in("status", ["queued", "in_progress"])
    .order("priority_deadline_at", { ascending: true })
    .limit(limit);
  return (data ?? []) as PriorityLaneRow[];
}
