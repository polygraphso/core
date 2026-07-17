import "server-only";

/**
 * The x402 fee's deferred-settlement state machine. The route verifies the
 * signed authorization and records it here as 'authorized'; nobody is charged
 * yet. When the grading run resolves, a reconciler (the status endpoint's
 * pollAndReconcile, or the cron sweep) moves the row:
 *
 *   authorized ── run graded ──→ settling ──→ paid            (the $1 moves now)
 *   authorized ── run failed ──→ voided                       (never charged)
 *   settling ─── facilitator error, authorization expired ──→ settle_failed
 *   settling ─── facilitator error, still valid ───────────→ authorized (retry)
 *
 * 'settling' is an atomic claim (guarded update) so a status poll and the cron
 * can't double-settle. A 'settle_failed' grade is never published — an
 * unsettled authorization must not buy a grade.
 */

import { getSupabaseAdmin } from "@/lib/supabase";
import { PAYMENT_CHAIN_ID, TREASURY_ADDRESS } from "@/lib/paymentConfig";
import { settleX402Payment, AUTHORIZATION_WINDOW_SECONDS } from "@/lib/x402Server";
import type { PaymentPayload, PaymentRequirements } from "@x402/core/types";

const PRIORITY_SLA_MS = 48 * 60 * 60 * 1000;

/** validBefore (unix seconds) out of an exact-EVM payload, if present. */
function authorizationValidBefore(payload: PaymentPayload): number | null {
  const auth = (payload as { payload?: { authorization?: { validBefore?: unknown } } }).payload
    ?.authorization;
  const n = Number(auth?.validBefore);
  return Number.isFinite(n) && n > 0 ? n : null;
}

function payerAddress(payload: PaymentPayload): string | null {
  const auth = (payload as { payload?: { authorization?: { from?: unknown } } }).payload
    ?.authorization;
  return typeof auth?.from === "string" ? auth.from : null;
}

export interface AuthorizeResult {
  ok: boolean;
  deadlineAt?: string;
  reason?: string;
}

/**
 * Record a verified-but-unsettled x402 authorization and start the request's
 * 48h clock. Idempotent per request: an existing open ('authorized'/'settling')
 * or settled ('paid') row short-circuits — one fee per request.
 */
export async function recordAuthorizedFeePayment(
  requestId: string,
  payment: {
    payload: PaymentPayload;
    requirements: PaymentRequirements;
    token: string;
    tokenDecimals: number;
    amountRaw: string;
    usdPrice: number;
  },
): Promise<AuthorizeResult> {
  const db = getSupabaseAdmin();
  if (!db) return { ok: false, reason: "storage unconfigured" };

  const { data: reqRow } = await db
    .from("grade_requests")
    .select("id, priority_paid_at, priority_deadline_at")
    .eq("id", requestId)
    .maybeSingle();
  if (!reqRow) return { ok: false, reason: "unknown request" };
  if (reqRow.priority_paid_at && reqRow.priority_deadline_at) {
    return { ok: true, deadlineAt: reqRow.priority_deadline_at as string };
  }

  const now = new Date();
  const deadline = new Date(now.getTime() + PRIORITY_SLA_MS).toISOString();
  const validBefore = authorizationValidBefore(payment.payload);
  const expiresAt = validBefore
    ? new Date(validBefore * 1000)
    : new Date(now.getTime() + AUTHORIZATION_WINDOW_SECONDS * 1000);

  const { error: payErr } = await db.from("grade_request_payments").insert({
    grade_request_id: requestId,
    chain_id: PAYMENT_CHAIN_ID,
    token: payment.token,
    token_decimals: payment.tokenDecimals,
    treasury: TREASURY_ADDRESS,
    expected_amount: payment.amountRaw,
    usd_price: payment.usdPrice,
    token_usd_rate: 1,
    status: "authorized",
    payer_address: payerAddress(payment.payload),
    expires_at: expiresAt.toISOString(),
    x402_payload: payment.payload,
    x402_requirements: payment.requirements,
  });
  if (payErr) {
    console.error("[x402] authorization insert failed", payErr);
    return { ok: false, reason: "authorization verified but could not be recorded — retry" };
  }

  // The fee is secured (an authorization we can settle), so the 48h clock
  // starts now; the dollar itself moves only when the grade lands.
  const { error: reqErr } = await db
    .from("grade_requests")
    .update({ priority_paid_at: now.toISOString(), priority_deadline_at: deadline })
    .eq("id", requestId);
  if (reqErr) {
    console.error("[x402] request stamp failed", reqErr);
    return { ok: false, reason: "authorization recorded but the request could not be flagged — email hello@polygraph.so" };
  }
  return { ok: true, deadlineAt: deadline };
}

interface OpenAuthorizationRow {
  id: string;
  status: string;
  expires_at: string;
  x402_payload: PaymentPayload | null;
  x402_requirements: PaymentRequirements | null;
}

async function openAuthorization(requestId: string): Promise<OpenAuthorizationRow | null> {
  const db = getSupabaseAdmin();
  if (!db) return null;
  const { data } = await db
    .from("grade_request_payments")
    .select("id, status, expires_at, x402_payload, x402_requirements")
    .eq("grade_request_id", requestId)
    .in("status", ["authorized", "settling"])
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  return (data as OpenAuthorizationRow | null) ?? null;
}

export type SettleOutcome =
  | { state: "no_authorization" } // web rail or already settled — nothing to do
  | { state: "settled"; txHash: string }
  | { state: "retry"; reason: string } // transient — leave the run unpublished, try again
  | { state: "failed"; reason: string }; // terminal — never publish, decline the request

/**
 * Settle the request's open authorization, if any. Called by the reconcilers
 * once the grading run has produced a grade. Atomic: the 'authorized' →
 * 'settling' guarded update elects a single settler.
 */
export async function settleAuthorizedFeePayment(requestId: string): Promise<SettleOutcome> {
  const db = getSupabaseAdmin();
  if (!db) return { state: "retry", reason: "storage unconfigured" };

  const row = await openAuthorization(requestId);
  if (!row) return { state: "no_authorization" };
  if (!row.x402_payload || !row.x402_requirements) {
    return { state: "failed", reason: "authorization row is missing its payload" };
  }

  if (row.status === "authorized") {
    const { data: claimed } = await db
      .from("grade_request_payments")
      .update({ status: "settling" })
      .eq("id", row.id)
      .eq("status", "authorized")
      .select("id");
    if (!claimed || claimed.length === 0) {
      // Another reconciler holds the claim; report transient so the caller
      // polls again rather than double-settling.
      return { state: "retry", reason: "settlement already in progress" };
    }
  }
  // (status === 'settling' falls through: a crashed settler's row is retried
  // by whoever sees it next — processSettlement is idempotent per nonce at the
  // facilitator, and a second settle of a settled transfer just fails.)

  let settled;
  try {
    settled = await settleX402Payment(row.x402_payload, row.x402_requirements);
  } catch (e) {
    console.error("[x402] settle threw", e);
    settled = null;
  }

  if (settled?.success) {
    await db
      .from("grade_request_payments")
      .update({
        status: "paid",
        tx_hash: settled.transaction.toLowerCase(),
        paid_at: new Date().toISOString(),
      })
      .eq("id", row.id);
    return { state: "settled", txHash: settled.transaction };
  }

  const reason = settled ? `${settled.errorReason ?? "unknown"}` : "facilitator unreachable";
  const expired = new Date(row.expires_at).getTime() <= Date.now();
  if (expired) {
    await db
      .from("grade_request_payments")
      .update({ status: "settle_failed" })
      .eq("id", row.id);
    console.error("[x402] settlement terminally failed", requestId, reason);
    return { state: "failed", reason: `payment authorization expired before settlement (${reason})` };
  }
  // Still inside the window — release the claim and let the next poll retry.
  await db.from("grade_request_payments").update({ status: "authorized" }).eq("id", row.id);
  return { state: "retry", reason };
}

/** Run failed — void the open authorization; the payer is never charged. */
export async function voidAuthorizedFeePayment(requestId: string, reason: string): Promise<void> {
  const db = getSupabaseAdmin();
  if (!db) return;
  const { data } = await db
    .from("grade_request_payments")
    .update({ status: "voided" })
    .eq("grade_request_id", requestId)
    .in("status", ["authorized", "settling"])
    .select("id");
  if (data && data.length > 0) {
    console.log(`[x402] voided authorization for ${requestId}: ${reason}`);
  }
}

/** Request ids holding an open authorization — the cron sweep's work list. */
export async function openAuthorizationRequestIds(limit = 25): Promise<string[]> {
  const db = getSupabaseAdmin();
  if (!db) return [];
  const { data } = await db
    .from("grade_request_payments")
    .select("grade_request_id")
    .in("status", ["authorized", "settling"])
    .order("created_at", { ascending: true })
    .limit(limit);
  return [...new Set((data ?? []).map((r) => r.grade_request_id as string))];
}
