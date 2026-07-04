import "server-only";
import { parseGradeTarget } from "@/lib/gradeTarget";
import { verifyRunnable, checkRegistryExists } from "@/lib/verifyRunnable";
import { gateKnownMcp, isCatalogedServer } from "@/lib/knownMcp";
import { recordAgentCall } from "@/lib/agentIdentity";
import type { LookupContext, LookupError } from "./types";

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

export interface GradeRequestQueued {
  status: "queued";
  created: boolean;
  demand: number;
}

export type GradeRequestResult = GradeRequestQueued | LookupError;

export interface GradeRequestInput {
  serverRef: string;
  /** Optional — a human at a terminal may want a notification; agents send none. */
  email?: string | null;
}

/**
 * Enqueue a grade request. Shared by POST /api/cli/grade-request and the hosted
 * MCP request_grade tool. Same gate as the human funnel: only queue a target the
 * harness could run (existing npm/pypi package or https:// endpoint) that is
 * plausibly an MCP server, so agents can't fill the queue with unrelated packages.
 * Best-effort enqueue only; Rúben drains the queue.
 */
export async function runGradeRequest(
  input: GradeRequestInput,
  ctx: LookupContext,
): Promise<GradeRequestResult> {
  const serverRef = input.serverRef;
  if (serverRef.length === 0) {
    return { status: "error", code: 400, error: "server_ref is required." };
  }
  if (serverRef.length > 512) {
    return { status: "error", code: 400, error: "server_ref is too long." };
  }

  const parsed = parseGradeTarget(serverRef.trim());
  if ("error" in parsed) {
    return { status: "error", code: 400, error: parsed.error };
  }

  const runnable = await verifyRunnable(parsed, checkRegistryExists);
  if (!runnable.ok) {
    return { status: "error", code: 422, error: runnable.reason };
  }

  const { supabase } = ctx;
  const known = await gateKnownMcp(parsed, (ref) => isCatalogedServer(supabase, ref));
  if (!known.ok) {
    return { status: "error", code: 422, error: known.reason };
  }

  // Email is optional. If present it must look like an email (the DB enforces
  // the same shape); a blank/absent value means "no notification".
  let email: string | null = null;
  if (typeof input.email === "string" && input.email.trim().length > 0) {
    const trimmed = input.email.trim();
    if (trimmed.length > 254 || !EMAIL_RE.test(trimmed)) {
      return { status: "error", code: 400, error: "email is not a valid address." };
    }
    email = trimmed;
  }

  // Origin marker + who asked, derived from the resolved caller identity:
  // 'mcp' for the hosted endpoint / litmus tools, else 'cli'. Raw callers carry
  // no explicit agent_id (their identity is a normalized User-Agent), so record
  // null rather than the ua: key — matching the pre-refactor route behavior.
  const source = ctx.identity.source === "mcp" ? "mcp" : "cli";
  const agentId = ctx.identity.source === "raw" ? null : ctx.identity.agentId;

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
    return { status: "error", code: 500, error: "Request failed." };
  }

  // Per-agent observability. Best-effort — the queue write already succeeded.
  await recordAgentCall(supabase, ctx.identity, "grade_request");

  // The RPC returns a single row: { created, demand }.
  const row = Array.isArray(data) ? data[0] : data;
  return {
    status: "queued",
    created: row?.created ?? true,
    demand: row?.demand ?? 1,
  };
}
