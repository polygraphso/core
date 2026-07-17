import "server-only";

/**
 * The x402 resource server, shared by the request route (verify) and the
 * fee reconcilers (settle). Settlement is DEFERRED on this rail: the route
 * verifies the signed authorization and records it; the reconciler in
 * lib/x402Fee.ts settles only once a grade lands. Both sides need the same
 * facilitator client and route configuration, so the singleton lives here.
 */

import { PRIORITY_GRADE_PRICE_USD, TREASURY_ADDRESS } from "@/lib/paymentConfig";
import { SITE_ORIGIN } from "@/lib/site";
import {
  HTTPFacilitatorClient,
  x402HTTPResourceServer,
  x402ResourceServer,
  type HTTPRequestContext,
  type ProcessSettleResultResponse,
} from "@x402/core/server";
import type { PaymentPayload, PaymentRequirements } from "@x402/core/types";
import { ExactEvmScheme } from "@x402/evm/exact/server";
import { bazaarResourceServerExtension, declareDiscoveryExtension } from "@x402/extensions/bazaar";
import { createFacilitatorConfig } from "@coinbase/x402";

/** Base mainnet, CAIP-2 — the only network this rail accepts. */
export const NETWORK = "eip155:8453";
/** USDC on Base has 6 decimals; the requirement's amount is in atomic units. */
export const USDC_DECIMALS = 6;
export const ROUTE_PATTERN = "POST /api/x402/grade-request";

/**
 * How long the signed authorization stays valid. Settlement happens after the
 * grading run (minutes) — or up to one reconciler sweep later if the payer
 * never polls — so the window is generous. The payer risks nothing extra: an
 * unsettled authorization is just a signature that expires.
 */
export const AUTHORIZATION_WINDOW_SECONDS = 7200;

/**
 * Lazy singleton: initialize() fetches the facilitator's supported schemes,
 * so build it once per instance and retry on failure instead of caching a
 * rejection.
 */
let httpServerPromise: Promise<x402HTTPResourceServer> | null = null;

export function getX402Server(): Promise<x402HTTPResourceServer> {
  if (!httpServerPromise) {
    httpServerPromise = (async () => {
      const facilitator = new HTTPFacilitatorClient(
        createFacilitatorConfig(process.env.CDP_API_KEY_ID, process.env.CDP_API_KEY_SECRET),
      );
      const server = new x402ResourceServer(facilitator)
        .register(NETWORK, new ExactEvmScheme())
        // Bazaar discovery: with the extension registered, one settled payment
        // through the CDP facilitator catalogs this endpoint (Agentic.Market,
        // x402scan). Routes without a bazaar declaration stay private.
        .registerExtension(bazaarResourceServerExtension);
      const httpServer = new x402HTTPResourceServer(server, {
        [ROUTE_PATTERN]: {
          accepts: {
            scheme: "exact",
            price: `$${PRIORITY_GRADE_PRICE_USD.toFixed(2)}`,
            network: NETWORK,
            payTo: TREASURY_ADDRESS,
            maxTimeoutSeconds: AUTHORIZATION_WINDOW_SECONDS,
          },
          resource: `${SITE_ORIGIN}/api/x402/grade-request`,
          description:
            "polygraph grading fee: records the grade request and starts the 48h grading clock. " +
            "Settlement is deferred — the $1 is taken only when a grade lands; a run the harness " +
            "can't complete never charges. The fee buys the run, never the grade.",
          mimeType: "application/json",
          serviceName: "polygraph",
          tags: ["security", "trust", "mcp", "grading"],
          iconUrl: `${SITE_ORIGIN}/brand/mark-512.png`,
          extensions: declareDiscoveryExtension({
            input: { server_ref: "npm/@scope/server" },
            inputSchema: {
              properties: {
                server_ref: {
                  type: "string",
                  description:
                    "Target to grade: npm ref (npm/@scope/name), github/owner/repo, pypi/name, or an https:// MCP URL.",
                },
                email: { type: "string", description: "Optional email notified when the grade publishes." },
                agent_id: { type: "string", description: "Optional stable identifier for the requesting agent." },
                source: { type: "string", description: "Optional client name for attribution." },
              },
              required: ["server_ref"],
            },
            bodyType: "json",
            output: {
              example: {
                status: "grading",
                created: true,
                requestId: "req_123",
                charged: false,
                statusUrl: "https://www.polygraph.so/api/grade-requests/req_123/status",
                deadlineAt: "2026-07-18T12:00:00Z",
              },
            },
          }),
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

export function requestContext(request: Request): HTTPRequestContext {
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

/** Settle a previously verified authorization (the reconciler's half). */
export async function settleX402Payment(
  payload: PaymentPayload,
  requirements: PaymentRequirements,
): Promise<ProcessSettleResultResponse> {
  const httpServer = await getX402Server();
  return httpServer.processSettlement(payload, requirements);
}
