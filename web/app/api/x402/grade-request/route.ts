/**
 * POST /api/x402/grade-request — the agent rail for the $1 grading fee.
 *
 * Standard x402 (v2): a request without an X-PAYMENT header gets a 402 whose
 * body carries the payment requirements ($1 in USDC on Base, exact scheme, to
 * the treasury); an x402-capable client signs the transfer authorization and
 * retries with X-PAYMENT. We then verify via the facilitator, run the same
 * gates as every other intake (runGradeRequest), and only SETTLE — i.e.
 * actually take the dollar — once the request is recorded; a rejected target
 * is never charged. On settlement the request is stamped paid and the 48h
 * clock starts. Humans pay the same fee in $POLYGRAPH on the web checkout;
 * this rail exists because agents hold USDC, not the token, and x402's exact
 * scheme rides EIP-3009, which USDC implements and $POLYGRAPH doesn't.
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
import { recordSettledFeePayment } from "@/lib/priorityPayments";
import { PRIORITY_GRADE_PRICE_USD, TREASURY_ADDRESS } from "@/lib/paymentConfig";
import { SITE_ORIGIN } from "@/lib/site";
import {
  HTTPFacilitatorClient,
  x402HTTPResourceServer,
  x402ResourceServer,
  type HTTPRequestContext,
} from "@x402/core/server";
import { ExactEvmScheme } from "@x402/evm/exact/server";
import { createFacilitatorConfig } from "@coinbase/x402";

/** Base mainnet, CAIP-2 — the only network this rail accepts. */
const NETWORK = "eip155:8453";
/** USDC on Base has 6 decimals; the requirement's amount is in atomic units. */
const USDC_DECIMALS = 6;
const ROUTE_PATTERN = "POST /api/x402/grade-request";

/**
 * Lazy singleton: initialize() fetches the facilitator's supported schemes,
 * so build it once per instance and retry on failure instead of caching a
 * rejection.
 */
let httpServerPromise: Promise<x402HTTPResourceServer> | null = null;

function getX402Server(): Promise<x402HTTPResourceServer> {
  if (!httpServerPromise) {
    httpServerPromise = (async () => {
      const facilitator = new HTTPFacilitatorClient(
        createFacilitatorConfig(process.env.CDP_API_KEY_ID, process.env.CDP_API_KEY_SECRET),
      );
      const server = new x402ResourceServer(facilitator).register(NETWORK, new ExactEvmScheme());
      const httpServer = new x402HTTPResourceServer(server, {
        [ROUTE_PATTERN]: {
          accepts: {
            scheme: "exact",
            price: `$${PRIORITY_GRADE_PRICE_USD.toFixed(2)}`,
            network: NETWORK,
            payTo: TREASURY_ADDRESS,
          },
          resource: `${SITE_ORIGIN}/api/x402/grade-request`,
          description:
            "polygraph grading fee: records the grade request and starts the 48h grading clock. The fee buys the run, never the grade.",
          mimeType: "application/json",
        },
      });
      await httpServer.initialize();
      return httpServer;
    })().catch((e) => {
      httpServerPromise = null;
      throw e;
    });
  }
  return httpServerPromise;
}

function requestContext(request: Request): HTTPRequestContext {
  const url = new URL(request.url);
  return {
    adapter: {
      getHeader: (name: string) => request.headers.get(name) ?? undefined,
      getMethod: () => request.method,
      getPath: () => url.pathname,
      getUrl: () => request.url,
      getAcceptHeader: () => request.headers.get("accept") ?? "application/json",
      getUserAgent: () => request.headers.get("user-agent") ?? "",
    },
    path: url.pathname,
    method: request.method,
    paymentHeader: request.headers.get("x-payment") ?? undefined,
    routePattern: ROUTE_PATTERN,
  };
}

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

  let body: GradeRequestBody;
  try {
    body = (await request.json()) as GradeRequestBody;
  } catch {
    return Response.json({ error: "Invalid JSON body." }, { status: 400 });
  }
  if (typeof body.server_ref !== "string" || body.server_ref.length === 0) {
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
    if (!request.headers.get("x-payment")) {
      const result = await runGradeRequest({ serverRef: body.server_ref, email }, { supabase, identity });
      if (result.status === "error") {
        return Response.json({ error: result.error }, { status: result.code });
      }
      if (!result.payment.required) {
        return Response.json({ ...result, paid: true });
      }
      // Recorded but unpaid — fall through to the 402 so the client can pay.
    }
    const { status, headers, body: responseBody } = processed.response;
    return Response.json(responseBody ?? null, { status, headers });
  }

  if (processed.type !== "payment-verified") {
    // Can't happen: the route is payment-configured. Fail loudly if it does.
    console.error("[x402/grade-request] unexpected process result", processed.type);
    return Response.json({ error: "Payment processing failed, retry." }, { status: 500 });
  }

  // Payment verified (not yet settled): run the same gates as every intake.
  // A rejected target returns here WITHOUT settlement — the caller is never
  // charged for a request we won't grade.
  const result = await runGradeRequest({ serverRef: body.server_ref, email }, { supabase, identity });
  if (result.status === "error") {
    return Response.json({ error: result.error }, { status: result.code });
  }
  if (!result.payment.required || !result.requestId) {
    // Already paid (idempotent retry or a race) — don't charge twice.
    return Response.json({ ...result, paid: true });
  }

  const settled = await httpServer.processSettlement(processed.paymentPayload, processed.paymentRequirements);
  if (!settled.success) {
    console.error("[x402/grade-request] settlement failed", settled.errorReason, settled.errorMessage);
    return Response.json(
      { error: `Payment settlement failed (${settled.errorReason ?? "unknown"}) — the request is recorded but unpaid; retry, or pay at ${result.payment.payUrl}.` },
      { status: 402, headers: settled.headers },
    );
  }

  const stamped = await recordSettledFeePayment(result.requestId, {
    txHash: settled.transaction,
    payerAddress: settled.payer ?? null,
    token: processed.paymentRequirements.asset,
    tokenDecimals: USDC_DECIMALS,
    amountRaw: settled.amount ?? processed.paymentRequirements.amount,
    usdPrice: PRIORITY_GRADE_PRICE_USD,
  });
  if (!stamped.ok) {
    // The dollar settled but our stamp failed — surface it; the tx hash in the
    // logs lets us reconcile by hand.
    console.error("[x402/grade-request] paid but stamp failed", settled.transaction, stamped.reason);
    return Response.json(
      { error: `Payment settled (tx ${settled.transaction}) but ${stamped.reason}` },
      { status: 500, headers: settled.headers },
    );
  }

  return Response.json(
    {
      status: "queued",
      created: result.created,
      demand: result.demand,
      requestId: result.requestId,
      paid: true,
      deadlineAt: stamped.deadlineAt,
      payment: { ...result.payment, required: false },
    },
    { headers: settled.headers },
  );
}
