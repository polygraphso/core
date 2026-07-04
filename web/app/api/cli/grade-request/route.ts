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
 * Best-effort enqueue only: writes a grade_requests row (deduped per target
 * for email-less requests) and returns the current demand. No synchronous
 * grading. Rúben drains the queue.
 *
 * Contract: record_grade_request RPC (see the grade_requests migrations).
 */

import { getSupabaseAdmin } from "@/lib/supabase";
import { parseGradeTarget } from "@/lib/gradeTarget";
import { verifyRunnable, checkRegistryExists } from "@/lib/verifyRunnable";
import { gateKnownMcp, isCatalogedServer } from "@/lib/knownMcp";
import { enforceRateLimit } from "@/lib/rateLimit";
import { recordAgentCall, resolveAgentIdentity } from "@/lib/agentIdentity";
import { fetchLatestRunOutcome, isBlockedByRecentFailure } from "@/lib/gradeability";

interface GradeRequestBody {
  server_ref?: unknown;
  email?: unknown;
  agent_id?: unknown;
  source?: unknown;
  agent_meta?: unknown;
}

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;
const AGENT_ID_MAX_LEN = 200;

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
  if (body.server_ref.length > 512) {
    return Response.json({ error: "server_ref is too long." }, { status: 400 });
  }

  const parsed = parseGradeTarget(body.server_ref.trim());
  if ("error" in parsed) {
    return Response.json({ error: parsed.error }, { status: 400 });
  }

  // Same gate as the human funnel: only queue a target the harness could run
  // (existing npm/pypi package or https:// endpoint)…
  const runnable = await verifyRunnable(parsed, checkRegistryExists);
  if (!runnable.ok) {
    return Response.json({ error: runnable.reason }, { status: 422 });
  }

  const supabase = getSupabaseAdmin();
  if (!supabase) {
    console.error("[cli/grade-request] Supabase is not configured");
    return Response.json({ error: "Request failed." }, { status: 500 });
  }

  // …and only if it's plausibly an MCP server (known catalog entry or an
  // mcp/server-named ref), so agents can't fill the queue with unrelated packages.
  const known = await gateKnownMcp(parsed, (ref) => isCatalogedServer(supabase, ref));
  if (!known.ok) {
    return Response.json({ error: known.reason }, { status: 422 });
  }

  // Known-recent failure: the harness already tried this target and it didn't
  // launch from its published form. Say so now instead of queueing a request
  // that would be declined an hour later.
  const verdict = isBlockedByRecentFailure(await fetchLatestRunOutcome(supabase, parsed.target));
  if (verdict.blocked) {
    return Response.json({ error: verdict.reason }, { status: 422 });
  }

  // Email is optional here. If present it must look like an email (the DB
  // enforces the same shape); a blank/absent value means "no notification".
  let email: string | null = null;
  if (typeof body.email === "string" && body.email.trim().length > 0) {
    const trimmed = body.email.trim();
    if (trimmed.length > 254 || !EMAIL_RE.test(trimmed)) {
      return Response.json({ error: "email is not a valid address." }, { status: 400 });
    }
    email = trimmed;
  }

  // Origin marker — anonymous callers are a tool ('cli') or an agent ('mcp'),
  // never the website ('web').
  const source = body.source === "mcp" ? "mcp" : "cli";

  // Who asked, when it's an agent. Best-effort, length-capped, never required.
  let agentId: string | null = null;
  if (typeof body.agent_id === "string" && body.agent_id.trim().length > 0) {
    agentId = body.agent_id.trim().slice(0, AGENT_ID_MAX_LEN);
  }

  const { data, error } = await supabase.rpc("record_grade_request", {
    p_target: parsed.target,
    p_target_kind: parsed.kind,
    p_email: email,
    p_note: null,
    p_source: source,
    p_agent_id: agentId,
  });

  if (error) {
    console.error("[cli/grade-request] record_grade_request failed:", error.message);
    return Response.json({ error: "Request failed." }, { status: 500 });
  }

  // Per-agent observability (registry + daily counters). Best-effort — the
  // queue write above already succeeded.
  await recordAgentCall(
    supabase,
    resolveAgentIdentity({
      agentId: body.agent_id,
      source: body.source,
      agentMeta: body.agent_meta,
      userAgent: request.headers.get("user-agent"),
    }),
    "grade_request",
  );

  // The RPC returns a single row: { created, demand }.
  const row = Array.isArray(data) ? data[0] : data;
  return Response.json({
    status: "queued",
    created: row?.created ?? true,
    demand: row?.demand ?? 1,
  });
}
