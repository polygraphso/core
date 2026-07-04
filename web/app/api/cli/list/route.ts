/**
 * GET /api/cli/list — graded-server discovery.
 *
 * Anonymous; service-role DB access on the server side only. Returns every
 * server with a published polygraph grade (hosted_runs, status='complete',
 * published_at set) — the same source the website reads. Sorted by grade
 * (A first), then by server_ref.
 *
 * Thin transport wrapper over `runList` (lib/lookup), which the hosted MCP
 * list_servers tool also calls so the two surfaces can't drift.
 */

import { getSupabaseAdmin } from "@/lib/supabase";
import { resolveAgentIdentity } from "@/lib/agentIdentity";
import { runList } from "@/lib/lookup";

export async function GET(request: Request) {
  const supabase = getSupabaseAdmin();
  if (!supabase) {
    console.error("[cli/list] Supabase is not configured");
    return Response.json({ error: "Lookup failed." }, { status: 500 });
  }

  // GET → identity rides on query params (our clients send ?source=…&agent_id=…);
  // raw callers fall back to User-Agent.
  const params = new URL(request.url).searchParams;
  const identity = resolveAgentIdentity({
    agentId: params.get("agent_id") ?? undefined,
    source: params.get("source") ?? undefined,
    userAgent: request.headers.get("user-agent"),
  });

  const body = await runList({ supabase, identity });
  return Response.json(body);
}
