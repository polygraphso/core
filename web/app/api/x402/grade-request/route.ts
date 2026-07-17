/**
 * POST /api/x402/grade-request — the agent rail for the $1 grading fee.
 *
 * Standard x402 (v2) with DEFERRED settlement: a request without an X-PAYMENT
 * header gets a 402 whose requirements carry the fee ($1 in USDC on Base,
 * exact scheme, to the treasury); an x402-capable client signs the transfer
 * authorization and retries with X-PAYMENT. We verify via the facilitator,
 * run the same gates as every other intake (runGradeRequest), record the
 * authorization, and kick off grading — but the dollar moves only when the
 * run produces a grade (any letter, D/F included). A run the harness can't
 * complete voids the authorization: failed runs are never charged, and a
 * rejected target is never even authorized. Settlement happens in
 * lib/x402Fee.ts via the status endpoint's reconciler and the cron sweep.
 *
 * Humans pay the same fee in $POLYGRAPH on the web checkout; this rail exists
 * because agents hold USDC, not the token, and x402's exact scheme rides
 * EIP-3009, which USDC implements and $POLYGRAPH doesn't.
 *
 * Body: { server_ref, email?, agent_id?, source?, agent_meta? } — the same
 * shape as /api/cli/grade-request. Env-gated: without CDP facilitator keys
 * (CDP_API_KEY_ID / CDP_API_KEY_SECRET) the route 503s and points at the web
 * checkout.
 */

import { getSupabaseAdmin } from "@/lib/supabase";
import { enforceRateLimit } from "@/lib/rateLimit";
import { resolveAgentIdentity } from "@/lib/agentIdentity";
import { runGradeRequest } from "@/lib/lookup";
import { recordAuthorizedFeePayment } from "@/lib/x402Fee";
import { startGradeForRequest } from "@/lib/paidGrading";
import { PRIORITY_GRADE_PRICE_USD, TREASURY_ADDRESS } from "@/lib/paymentConfig";
import { SITE_ORIGIN } from "@/lib/site";
import { getX402Server, requestContext, USDC_DECIMALS } from "@/lib/x402Server";
import type { x402HTTPResourceServer } from "@x402/core/server";

interface GradeRequestBody {
  server_ref?: unknown;
  email?: unknown;
  agent_id?: unknown;
  source?: unknown;
  agent_meta?: unknown;
}

export async function POST(request: Request) {
  const limited = await enforceRateLimit(request, "x402-grade-request", {
    max: 20,
    windowSeconds: 60,
  });
  if (limited) return limited;

  if (!process.env.CDP_API_KEY_ID || !process.env.CDP_API_KEY_SECRET) {
    return Response.json(
      {
        error:
          "The x402 rail isn't configured on this deployment. Pay the fee on the web checkout instead — request the grade first via POST /api/cli/grade-request and follow its payment.payUrl.",
      },
      { status: 503 },
    );
  }
  if (!TREASURY_ADDRESS) {
    return Response.json({ error: "Payments aren't configured (treasury address unset)." }, { status: 503 });
  }

  // Parse leniently: an unauthenticated probe (x402scan, Bazaar crawlers, any
  // discovery client) POSTs an empty or schema-less body expecting to reach
  // the 402 challenge — body validation must not preempt it. Only a request
  // that actually carries a payment is held to the schema.
  let body: GradeRequestBody = {};
  try {
    body = (await request.json()) as GradeRequestBody;
  } catch {
    // tolerated — probes send no body
  }
  const serverRef = typeof body.server_ref === "string" && body.server_ref.length > 0 ? body.server_ref : null;
  if (!serverRef && request.headers.get("x-payment")) {
    return Response.json({ error: "server_ref is required." }, { status: 400 });
  }

  const supabase = getSupabaseAdmin();
  if (!supabase) {
    console.error("[x402/grade-request] Supabase is not configured");
    return Response.json({ error: "Request failed." }, { status: 500 });
  }
  const identity = resolveAgentIdentity({
    agentId: body.agent_id,
    source: body.source,
    agentMeta: body.agent_meta,
    userAgent: request.headers.get("user-agent"),
  });
  const email = typeof body.email === "string" ? body.email : null;

  let httpServer: x402HTTPResourceServer;
  try {
    httpServer = await getX402Server();
  } catch (e) {
    console.error("[x402/grade-request] facilitator init failed", e);
    return Response.json({ error: "The x402 rail is unavailable right now, retry shortly." }, { status: 503 });
  }

  const processed = await httpServer.processHTTPRequest(requestContext(request));

  // No/invalid payment → the protocol response (a 402 with the requirements).
  // Before returning it, short-circuit the one case where no payment is due:
  // this caller's request for this target already has its fee paid.
  if (processed.type === "payment-error") {
    if (!request.headers.get("x-payment") && serverRef) {
      const result = await runGradeRequest({ serverRef, email }, { supabase, identity });
      if (result.status === "error") {
        return Response.json({ error: result.error }, { status: result.code });
      }
      if (!result.payment.required) {
        return Response.json({ ...result, paid: true });
      }
      // Recorded but unpaid — fall through to the 402 so the client can pay.
    }
    // No server_ref (a discovery probe) → the bare 402 challenge.
    const { status, headers, body: responseBody } = processed.response;
    return Response.json(responseBody ?? null, { status, headers });
  }

  if (processed.type !== "payment-verified") {
    // Can't happen: the route is payment-configured. Fail loudly if it does.
    console.error("[x402/grade-request] unexpected process result", processed.type);
    return Response.json({ error: "Payment processing failed, retry." }, { status: 500 });
  }

  if (!serverRef) {
    // Can't happen: paid requests were schema-checked above. Guard anyway.
    return Response.json({ error: "server_ref is required." }, { status: 400 });
  }

  // Payment verified (NOT settled — the authorization is held and the dollar
  // moves only when a grade lands): run the same gates as every intake. A
  // rejected target returns here without even an authorization on file.
  const result = await runGradeRequest({ serverRef, email }, { supabase, identity });
  if (result.status === "error") {
    return Response.json({ error: result.error }, { status: result.code });
  }
  if (!result.payment.required || !result.requestId) {
    // Already paid/authorized (idempotent retry or a race) — don't hold a
    // second authorization for the same request.
    return Response.json({ ...result, paid: true });
  }

  const authorized = await recordAuthorizedFeePayment(result.requestId, {
    payload: processed.paymentPayload,
    requirements: processed.paymentRequirements,
    token: processed.paymentRequirements.asset,
    tokenDecimals: USDC_DECIMALS,
    amountRaw: processed.paymentRequirements.amount,
    usdPrice: PRIORITY_GRADE_PRICE_USD,
  });
  if (!authorized.ok) {
    console.error("[x402/grade-request] authorization record failed", authorized.reason);
    return Response.json(
      { error: `Payment authorization verified but ${authorized.reason ?? "could not be recorded"}` },
      { status: 500 },
    );
  }

  // Grading starts NOW (best-effort; the status reconciler self-heals a missed
  // kick). The 48h deadline is the outer promise, not the schedule.
  await startGradeForRequest(result.requestId);

  const statusUrl = `${SITE_ORIGIN}/api/grade-requests/${result.requestId}/status`;
  return Response.json({
    status: "grading",
    created: result.created,
    demand: result.demand,
    requestId: result.requestId,
    paid: false,
    charged: false,
    settlement:
      "deferred — the $1 settles only when a grade (A–F) lands; a run the harness can't complete is never charged",
    statusUrl,
    deadlineAt: authorized.deadlineAt,
    payment: { ...result.payment, required: false },
  });
}
