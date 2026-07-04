/**
 * POST /api/cli/grade-request — anonymous grade-queue intake for the CLI / MCP.
 *
 * The twin of /api/grade-requests, but for anonymous tool callers instead of
 * signed-in website visitors. An agent has no session and no inbox, so this
 * route takes NO email by default and instead records who asked via
 * `source` ('cli' | 'mcp') and `agent_id` (the MCP client's self-reported
 * name/version). Email is accepted but optional — a human at a terminal may
 * still want to be notified.
 *
 * Thin transport wrapper: parse/rate-limit here, then delegate to
 * `runGradeRequest` (lib/lookup), which the hosted MCP request_grade tool also
 * calls so the two surfaces can't drift.
 */

import { getSupabaseAdmin } from "@/lib/supabase";
import { enforceRateLimit } from "@/lib/rateLimit";
import { resolveAgentIdentity } from "@/lib/agentIdentity";
import { runGradeRequest } from "@/lib/lookup";

interface GradeRequestBody {
  server_ref?: unknown;
  email?: unknown;
  agent_id?: unknown;
  source?: unknown;
  agent_meta?: unknown;
}

export async function POST(request: Request) {
  const limited = await enforceRateLimit(request, "cli-grade-request", {
    max: 20,
    windowSeconds: 60,
  });
  if (limited) return limited;

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
    console.error("[cli/grade-request] Supabase is not configured");
    return Response.json({ error: "Request failed." }, { status: 500 });
  }

  const identity = resolveAgentIdentity({
    agentId: body.agent_id,
    source: body.source,
    agentMeta: body.agent_meta,
    userAgent: request.headers.get("user-agent"),
  });

  const email = typeof body.email === "string" ? body.email : null;
  const result = await runGradeRequest({ serverRef: body.server_ref, email }, { supabase, identity });
  if (result.status === "error") {
    return Response.json({ error: result.error }, { status: result.code });
  }
  return Response.json(result);
}
