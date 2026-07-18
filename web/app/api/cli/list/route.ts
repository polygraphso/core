/**
 * GET /api/cli/list — graded-server discovery.
 *
 * Anonymous; service-role DB access on the server side only. Returns every
 * server with a published polygraph grade (hosted_runs, status='complete',
 * published_at set) — the same source the website reads. Sorted by grade
 * (A first), then by server_ref. No query params: every graded server,
 * unpaged, matching the historical shape. Optional `grade` narrows to one
 * letter; `limit`/`offset` page the result; `summary` (total plus a count
 * per grade) always covers the full corpus regardless of those params.
 *
 * Thin transport wrapper over `runList` (lib/lookup), which the hosted MCP
 * list_servers tool also calls so the two surfaces can't drift.
 */

import { getSupabaseAdmin } from "@/lib/supabase";
import { resolveAgentIdentity } from "@/lib/agentIdentity";
import { runList, type ListOptions } from "@/lib/lookup";

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

  const gradeParam = params.get("grade");
  const limitParam = params.get("limit");
  const offsetParam = params.get("offset");
  const options: ListOptions = {};
  if (gradeParam !== null) options.grade = gradeParam as ListOptions["grade"];
  if (limitParam !== null) options.limit = Number(limitParam);
  if (offsetParam !== null) options.offset = Number(offsetParam);

  const result = await runList({ supabase, identity }, options);
  if ("error" in result) {
    return Response.json({ error: result.error }, { status: result.code });
  }
  return Response.json(result);
}
