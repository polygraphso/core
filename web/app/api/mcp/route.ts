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
  "polygraph publishes independent behavioral security grades (A–F) for MCP servers.",
  "Use check_server as the pre-flight check before recommending or installing a server —",
  "it returns the published grade in well under a second and runs nothing. A not_available",
  "result means the server is unevaluated (neither safe nor unsafe), not that it failed;",
  "call request_grade to add it to the public grading queue (free). list_servers returns",
  "every server that carries a published grade. Every grade is reproducible — the report",
  "page carries a one-command re-run. This endpoint does not grade servers itself.",
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

function textResult(text: string, isError = false) {
  return { content: [{ type: "text" as const, text }], isError };
}

const TOO_MANY = "Too many requests. Please slow down and try again shortly.";

function registerTools(server: McpServer): void {
  server.registerTool(
    "check_server",
    {
      title: "Check a server's published polygraph grade",
      description:
        "Read a server's published behavioral grade (A–F) from polygraph.so in under a second — " +
        "no execution. The pre-flight check before recommending or installing an MCP server. On a " +
        "miss it returns not_available (unevaluated — neither safe nor unsafe) with next steps.",
      inputSchema: { server_ref: z.string().min(1).max(512).describe(SERVER_REF_DESC) },
    },
    async ({ server_ref }) => {
      const c = await toolContext(server, "mcp-check", { max: 60, windowSeconds: 60 });
      if ("error" in c) return textResult(c.error, true);
      if (!c.allowed) return textResult(TOO_MANY, true);
      const r = await runCheck(server_ref, c.ctx);
      if (r.status === "error") return textResult(r.error, true);
      if (r.status === "not_available") {
        return textResult(
          `${server_ref}: not_available — unevaluated (neither safe nor unsafe). ` +
            `Add it to the public queue with request_grade, or grade it yourself: ${r.self_grade}`,
        );
      }
      const d = r.polygraph_detail;
      const cats = `C-01 ${d.c01} · C-02 ${d.c02} · C-03 ${d.c03}`;
      const ver = r.version_match === false ? ` (graded ${d.resolved_version}, not the current version)` : "";
      return textResult(
        `${server_ref}: grade ${r.polygraph}${ver}. ${cats}. ` +
          `Report: https://polygraph.so/mcp/${server_ref}. A grade is a measurement, not a guarantee — reproduce it with the open harness.`,
      );
    },
  );

  server.registerTool(
    "list_servers",
    {
      title: "List servers with a published grade",
      description: "Every MCP server that carries a published polygraph grade, sorted A-first.",
    },
    async () => {
      const c = await toolContext(server, "mcp-list", { max: 60, windowSeconds: 60 });
      if ("error" in c) return textResult(c.error, true);
      if (!c.allowed) return textResult(TOO_MANY, true);
      const r = await runList(c.ctx);
      if (r.total === 0) return textResult("No servers have a published grade yet.");
      const lines = r.servers.map((s) => `${s.polygraph}  ${s.server_ref}`).join("\n");
      return textResult(`${r.total} graded server${r.total === 1 ? "" : "s"}:\n${lines}`);
    },
  );

  server.registerTool(
    "request_grade",
    {
      title: "Queue an ungraded server for grading",
      description:
        "Add an ungraded MCP server to polygraph.so's public grading queue (free, best-effort). " +
        "Read the result later with check_server. Only real, plausibly-MCP targets are accepted.",
      inputSchema: { server_ref: z.string().min(1).max(512).describe(SERVER_REF_DESC) },
    },
    async ({ server_ref }) => {
      const c = await toolContext(server, "mcp-grade-request", { max: 20, windowSeconds: 60 });
      if ("error" in c) return textResult(c.error, true);
      if (!c.allowed) return textResult(TOO_MANY, true);
      const r = await runGradeRequest({ serverRef: server_ref }, c.ctx);
      if (r.status === "error") return textResult(r.error, true);
      const lead = r.created ? "Queued" : "Already queued";
      return textResult(
        `${lead}: ${server_ref} (${r.demand} request${r.demand === 1 ? "" : "s"} so far). ` +
          `Check back with check_server.`,
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
