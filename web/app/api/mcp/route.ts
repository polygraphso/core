/**
 * Hosted MCP endpoint — https://polygraph.so/api/mcp
 *
 * A lookup-only MCP server over Streamable HTTP, so any MCP-capable client
 * (ChatGPT/Claude connectors, Smithery, agent gateways) can read polygraph
 * grades without installing anything. It exposes exactly the three read/queue
 * tools — check_server, list_servers, request_grade — and NEVER run_litmus:
 * grading executes the target's code, which has no place in a hosted, anonymous
 * endpoint. Each tool calls the same lib/lookup helper the public /api/cli
 * routes use, so the hosted surface can't drift from the CLI.
 *
 * Identity: taken from the MCP initialize handshake (the client's name/version),
 * tagged source="mcp" — the same attribution the stdio litmus tools send.
 * Rate limiting: the real client IP is carried from the request into the tool
 * handlers via AsyncLocalStorage and fed to the shared DB limiter.
 */

import { AsyncLocalStorage } from "node:async_hooks";
import { createMcpHandler } from "mcp-handler";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { getSupabaseAdmin } from "@/lib/supabase";
import { clientIp, rateLimitOk } from "@/lib/rateLimit";
import { resolveAgentIdentity, type AgentIdentity } from "@/lib/agentIdentity";
import { runCheck, runList, runGradeRequest, type LookupContext } from "@/lib/lookup";
import { PRIORITY_GRADE_PRICE_USD } from "@/lib/paymentConfig";
import { SITE_ORIGIN } from "@/lib/site";

export const runtime = "nodejs";
export const maxDuration = 60;

// Carries the caller's IP from the route entry point down into the tool
// handlers (mcp-handler doesn't thread per-call request headers through to
// them). Set once per request; read inside each tool for rate limiting.
const ipStore = new AsyncLocalStorage<string>();

const SERVER_REF_DESC =
  "Registry-prefixed server ref: npm/<name>, npm/@scope/<name>, pypi/<name>, or " +
  "github/<owner>/<repo>, with an optional @version. Example: npm/@modelcontextprotocol/server-filesystem";

const INSTRUCTIONS = [
  "polygraph publishes independent behavioral security grades (A-F) for MCP servers.",
  "Use check_server as the pre-flight check before recommending or installing a server:",
  "it returns the published grade in well under a second and runs nothing. A not_available",
  "result means the server is unevaluated (neither safe nor unsafe), not that it failed.",
  `Call request_grade to get it graded: a $${PRIORITY_GRADE_PRICE_USD} one-time fee applies,`,
  "paid via the response's payment link (x402 for agents, web checkout for humans); the fee",
  "buys the run, never the grade. list_servers returns servers with a published grade, 25 at",
  "a time by default (up to 100 per call), with a summary that always covers the full graded",
  "corpus. Every grade is reproducible: the report page carries a one-command re-run. This",
  "endpoint does not grade servers itself.",
].join(" ");

/** Build the caller identity from the MCP initialize handshake (name/version,
 *  optional client metadata), tagged as an MCP caller. */
function identityFromHandshake(server: McpServer): AgentIdentity {
  const impl = server.server.getClientVersion();
  const caps = server.server.getClientCapabilities();
  const agentId = impl?.name
    ? impl.version
      ? `${impl.name}/${impl.version}`
      : impl.name
    : undefined;
  const meta = impl
    ? {
        title: (impl as { title?: string }).title,
        websiteUrl: (impl as { websiteUrl?: string }).websiteUrl,
        capabilities: caps ? Object.keys(caps) : undefined,
      }
    : undefined;
  return resolveAgentIdentity({ agentId, source: "mcp", agentMeta: meta, userAgent: null });
}

interface Ctx {
  ctx: LookupContext;
  /** false when the caller is over the per-IP limit for this bucket. */
  allowed: boolean;
}

/** Resolve supabase + identity + rate-limit for one tool call. Returns a
 *  ready LookupContext, or a flag telling the tool to refuse. */
async function toolContext(
  server: McpServer,
  bucket: string,
  rule: { max: number; windowSeconds: number },
): Promise<{ error: string } | Ctx> {
  const supabase = getSupabaseAdmin();
  if (!supabase) return { error: "Lookup is temporarily unavailable." };
  const identity = identityFromHandshake(server);
  const ip = ipStore.getStore() ?? "mcp:shared";
  const allowed = await rateLimitOk(`${bucket}:${ip}`, rule);
  return { ctx: { supabase, identity }, allowed };
}

/** A tool error (isError) — no structuredContent; the SDK doesn't validate it. */
function errResult(text: string) {
  return { content: [{ type: "text" as const, text }], isError: true as const };
}

/** A successful tool result carrying both human text and schema-validated
 *  structuredContent (declared via each tool's outputSchema). */
function dataResult(text: string, structuredContent: Record<string, unknown>) {
  return { content: [{ type: "text" as const, text }], structuredContent };
}

const TOO_MANY = "Too many requests. Please slow down and try again shortly.";

// Output schemas — declared so clients (and directories) get typed results, not
// just prose. Kept permissive where a tool has more than one success shape.
const CHECK_OUTPUT = {
  status: z.enum(["graded", "not_available"]).describe("Whether a published grade exists."),
  server_ref: z.string(),
  grade: z.string().optional().describe("A-F, present when status is graded."),
  categories: z
    .object({ c01: z.string(), c02: z.string(), c03: z.string() })
    .optional()
    .describe("Per-category pass/fail, present when graded."),
  current_version: z.string().nullable().optional(),
  version_match: z.boolean().nullable().optional(),
  report_url: z.string().optional(),
  self_grade: z.string().optional().describe("One-command reproduce/grade, present on a miss."),
};
const LIST_INPUT = {
  grade: z.enum(["A", "B", "C", "D", "F"]).optional().describe("Restrict to servers with this grade."),
  limit: z
    .number()
    .int()
    .positive()
    .optional()
    .describe("Rows to return. Default 25, capped at 100 per call."),
  offset: z
    .number()
    .int()
    .nonnegative()
    .optional()
    .describe("Rows to skip before taking `limit`, for paging past the first page."),
};
const GRADE_COUNTS = z.object({
  A: z.number(),
  B: z.number(),
  C: z.number(),
  D: z.number(),
  F: z.number(),
});
const LIST_OUTPUT = {
  total: z
    .number()
    .describe("Rows matching `grade` (if given), before `limit`/`offset`. Equals summary.total when grade is omitted."),
  servers: z.array(z.object({ server_ref: z.string(), polygraph: z.string() })),
  summary: z
    .object({
      total: z.number().describe("Total graded servers across the whole corpus."),
      byGrade: GRADE_COUNTS.describe("Count of graded servers per letter, across the whole corpus."),
    })
    .describe("Always covers the full graded corpus, independent of `grade`, `limit`, or `offset`."),
};
const REQUEST_OUTPUT = {
  status: z.literal("queued"),
  server_ref: z.string().describe("The server ref that was recorded."),
  created: z.boolean().describe("false if the server was already recorded."),
  demand: z.number().describe("How many times this server has been requested."),
  requestId: z.string().nullable().describe("The recorded request's id."),
  statusUrl: z
    .string()
    .nullable()
    .describe("Poll for grading progress (unpaid, grading, graded, failed); check_server also reflects the published result."),
  payment: z
    .object({
      required: z.boolean().describe("false when the fee is already paid or authorized."),
      usdPrice: z.number().describe("The one-time fee, in USD."),
      payUrl: z.string().nullable().describe("Human/browser checkout for this request, paid in $POLYGRAPH."),
      x402Url: z
        .string()
        .describe(
          "The agent payment endpoint. POST the same request body here; a bare POST returns a 402 with " +
            "the exact payment requirements, and a retry with an X-PAYMENT header pays it.",
        ),
      network: z.string().describe("CAIP-2 chain id the x402 payment settles on: eip155:8453 (Base mainnet)."),
      asset: z.string().describe("The token the x402 rail expects: USDC."),
    })
    .describe(
      "How grading is paid for. The web checkout settles up front in $POLYGRAPH; the x402 rail takes an " +
        "authorization that is charged only once a grade lands, and a run the harness cannot complete " +
        "voids it, so nothing is charged. The fee buys the run, never the grade.",
    ),
};

function registerTools(server: McpServer): void {
  server.registerTool(
    "check_server",
    {
      title: "Check a server's published polygraph grade",
      description:
        "Read a server's published behavioral grade (A-F) from polygraph.so in under a second; " +
        "no execution. The pre-flight check before recommending or installing an MCP server. On a " +
        "miss it returns not_available (unevaluated: neither safe nor unsafe) with next steps.",
      inputSchema: { server_ref: z.string().min(1).max(512).describe(SERVER_REF_DESC) },
      outputSchema: CHECK_OUTPUT,
      annotations: { readOnlyHint: true, openWorldHint: true },
    },
    async ({ server_ref }) => {
      const c = await toolContext(server, "mcp-check", { max: 60, windowSeconds: 60 });
      if ("error" in c) return errResult(c.error);
      if (!c.allowed) return errResult(TOO_MANY);
      const r = await runCheck(server_ref, c.ctx);
      if (r.status === "error") return errResult(r.error);
      if (r.status === "not_available") {
        return dataResult(
          `${server_ref}: not_available. Unevaluated (neither safe nor unsafe). ` +
            `Request it with request_grade ($${PRIORITY_GRADE_PRICE_USD} fee, graded within 48h of payment), ` +
            `or grade it yourself: ${r.self_grade}`,
          { status: "not_available", server_ref, report_url: r.notify_url, self_grade: r.self_grade },
        );
      }
      const d = r.polygraph_detail;
      const cats = `C-01 ${d.c01} · C-02 ${d.c02} · C-03 ${d.c03}`;
      const ver = r.version_match === false ? ` (graded ${d.resolved_version}, not the current version)` : "";
      return dataResult(
        `${server_ref}: grade ${r.polygraph}${ver}. ${cats}. ` +
          `Report: https://polygraph.so/mcp/${server_ref}. A grade is a measurement, not a guarantee; reproduce it with the open harness.`,
        {
          status: "graded",
          server_ref,
          grade: r.polygraph,
          categories: { c01: d.c01, c02: d.c02, c03: d.c03 },
          current_version: r.current_version,
          version_match: r.version_match,
          report_url: `https://polygraph.so/mcp/${server_ref}`,
        },
      );
    },
  );

  server.registerTool(
    "list_servers",
    {
      title: "List servers with a published grade",
      description:
        "Servers with a published polygraph grade, sorted A-first then by ref. Returns up to " +
        "`limit` rows starting at `offset` (default limit 25, capped at 100 per call); `grade` " +
        "restricts to one letter. `summary` always covers the full graded corpus (a total plus " +
        "a count per grade), regardless of `grade`, `limit`, or `offset`.",
      inputSchema: LIST_INPUT,
      outputSchema: LIST_OUTPUT,
      annotations: { readOnlyHint: true, openWorldHint: true },
    },
    async ({ grade, limit, offset }) => {
      const c = await toolContext(server, "mcp-list", { max: 60, windowSeconds: 60 });
      if ("error" in c) return errResult(c.error);
      if (!c.allowed) return errResult(TOO_MANY);
      const effectiveLimit = Math.min(limit ?? 25, 100);
      const r = await runList(c.ctx, { grade, limit: effectiveLimit, offset });
      if ("error" in r) return errResult(r.error);
      const text =
        r.total === 0
          ? "No servers match."
          : r.servers.length === 0
            ? `Offset is past the end: ${r.total} matching server${r.total === 1 ? "" : "s"} ` +
              `(full corpus: ${r.summary.total}), none left to show at this offset.`
            : `${r.servers.length} of ${r.total} matching server${r.total === 1 ? "" : "s"} ` +
              `(full corpus: ${r.summary.total}):\n` +
              r.servers.map((s) => `${s.polygraph}  ${s.server_ref}`).join("\n");
      return dataResult(text, { total: r.total, servers: r.servers, summary: r.summary });
    },
  );

  server.registerTool(
    "request_grade",
    {
      title: "Request a polygraph grade for an MCP server",
      description:
        `Record a grade request with polygraph.so. Recording is free; only real, plausibly-MCP ` +
        `targets are accepted. Grading starts once the request's one-time $${PRIORITY_GRADE_PRICE_USD} ` +
        `USD fee is paid: payment.payUrl is the human/browser checkout (paid in $POLYGRAPH), and ` +
        `payment.x402Url is the agent rail, POST the same request body there with an x402-capable ` +
        `client. A bare POST to x402Url returns a 402 with the exact payment requirements; retry ` +
        `with an X-PAYMENT header. Asset is USDC on Base mainnet (eip155:8453). On the x402 rail ` +
        `settlement is deferred: the authorization is charged only once a grade lands, and a run the ` +
        `harness cannot complete voids it, so nothing is charged. Paying starts a 48h grading clock. The fee ` +
        `buys the run, never the grade. After paying, poll check_server with the same server_ref for ` +
        `the published result, or poll statusUrl for progress.`,
      inputSchema: { server_ref: z.string().min(1).max(512).describe(SERVER_REF_DESC) },
      outputSchema: REQUEST_OUTPUT,
      annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: true, openWorldHint: true },
    },
    async ({ server_ref }) => {
      const c = await toolContext(server, "mcp-grade-request", { max: 20, windowSeconds: 60 });
      if ("error" in c) return errResult(c.error);
      if (!c.allowed) return errResult(TOO_MANY);
      const r = await runGradeRequest({ serverRef: server_ref }, c.ctx);
      if (r.status === "error") return errResult(r.error);
      const statusUrl = r.requestId ? `${SITE_ORIGIN}/api/grade-requests/${r.requestId}/status` : null;
      const payment = { ...r.payment, network: "eip155:8453", asset: "USDC" };
      const pollHint = statusUrl ? ` or poll ${statusUrl}` : "";
      const lead = r.created ? "Recorded" : "Already recorded";
      const next = !payment.required
        ? `Already paid or authorized. Check back with check_server${pollHint}.`
        : payment.payUrl
          ? `Grading starts once the one-time $${payment.usdPrice} fee is paid. Pay at ${payment.payUrl}, ` +
            `or POST this request body with an X-PAYMENT header to ${payment.x402Url} ` +
            `($${payment.usdPrice} USDC on Base). On the x402 rail the fee settles only once a grade ` +
            `lands, so an incomplete run is never charged. Check back with check_server${pollHint}.`
          : `Check back with check_server${pollHint}.`;
      return dataResult(
        `${lead}: ${server_ref} (${r.demand} request${r.demand === 1 ? "" : "s"} so far). ${next}`,
        {
          status: "queued",
          server_ref,
          created: r.created,
          demand: r.demand,
          requestId: r.requestId,
          statusUrl,
          payment,
        },
      );
    },
  );
}

const handler = createMcpHandler(
  (server) => {
    registerTools(server);
  },
  { serverInfo: { name: "polygraph", version: "1.0.0" }, instructions: INSTRUCTIONS },
  { basePath: "/api", disableSse: true, maxDuration: 60 },
);

/** Wrap the mcp-handler entry so the client IP is available to tool handlers. */
async function withIp(request: Request): Promise<Response> {
  return ipStore.run(clientIp(request), () => handler(request));
}

export { withIp as GET, withIp as POST, withIp as DELETE };
