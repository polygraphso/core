/**
 * POST /api/cli/check — grade lookup.
 *
 * Anonymous; service-role DB access on the server side only. The CLI sends
 * a registry-prefixed server_ref; we return its published polygraph grade
 * from hosted_runs (the same source the website reads), or — when there's
 * no published grade — bump the demand counter and return a notify URL.
 *
 * Thin transport wrapper: parse/rate-limit here, then delegate the lookup to
 * `runCheck` (lib/lookup), which the hosted MCP check_server tool also calls so
 * the two surfaces can't drift.
 */

import { getSupabaseAdmin } from "@/lib/supabase";
import { enforceRateLimit } from "@/lib/rateLimit";
import { resolveAgentIdentity } from "@/lib/agentIdentity";
import { runCheck } from "@/lib/lookup";

interface CheckRequest {
  server_ref?: unknown;
  /** Optional caller identity — sent by the polygraph MCP tools ('mcp') and
   *  the polygraphso CLI ('cli'); raw callers fall back to their User-Agent. */
  source?: unknown;
  agent_id?: unknown;
  agent_meta?: unknown;
}

export async function POST(request: Request) {
  // Higher ceiling than the email routes: legitimate CLI usage checks many refs.
  const limited = await enforceRateLimit(request, "cli-check", { max: 60, windowSeconds: 60 });
  if (limited) return limited;

  let body: CheckRequest;
  try {
    body = (await request.json()) as CheckRequest;
  } catch {
    return Response.json({ error: "Invalid JSON body." }, { status: 400 });
  }

  if (typeof body.server_ref !== "string" || body.server_ref.length === 0) {
    return Response.json({ error: "server_ref is required." }, { status: 400 });
  }

  const supabase = getSupabaseAdmin();
  if (!supabase) {
    console.error("[cli/check] Supabase is not configured");
    return Response.json({ error: "Lookup failed." }, { status: 500 });
  }

  const identity = resolveAgentIdentity({
    agentId: body.agent_id,
    source: body.source,
    agentMeta: body.agent_meta,
    userAgent: request.headers.get("user-agent"),
  });

  const result = await runCheck(body.server_ref, { supabase, identity });
  if (result.status === "error") {
    return Response.json({ error: result.error }, { status: result.code });
  }
  return Response.json(result);
}
