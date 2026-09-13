import "server-only";
import { parseGradeTarget } from "@/lib/gradeTarget";
import { verifyRunnable, checkRegistryExists } from "@/lib/verifyRunnable";
import { gateKnownMcp, isCatalogedServer } from "@/lib/knownMcp";
import { recordAgentCall } from "@/lib/agentIdentity";
import { PRIORITY_GRADE_PRICE_USD } from "@/lib/paymentConfig";
import { SITE_ORIGIN } from "@/lib/site";
import {
  HOSTED_GRADING_DISABLED,
  HOSTED_GRADING_SUNSET_MESSAGE,
} from "@/lib/hostedGradingSunset";
import type { LookupContext, LookupError } from "./types";

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

/**
 * How grading is paid for, carried on every queued response so tool callers
 * (the litmus MCP tools, the CLI) can tell the user what happens next.
 * `required: false` = the fee is already paid and the 48h clock is running.
 */
export interface GradeRequestPaymentInfo {
  required: boolean;
  usdPrice: number;
  /** The web checkout for this request ($POLYGRAPH). */
  payUrl: string | null;
  /** The x402 endpoint ($1 USDC on Base) — POST the same body with payment. */
  x402Url: string;
}

export interface GradeRequestQueued {
  status: "queued";
  created: boolean;
  demand: number;
  requestId: string | null;
  payment: GradeRequestPaymentInfo;
}

export type GradeRequestResult = GradeRequestQueued | LookupError;

export interface GradeRequestInput {
  serverRef: string;
  /** Optional — a human at a terminal may want a notification; agents send none. */
  email?: string | null;
}

/**
 * Record a grade request. Shared by POST /api/cli/grade-request, the x402
 * endpoint, and the hosted MCP request_grade tool. Same gate as the human
 * funnel: only accept a target the harness could run (existing npm/pypi
 * package or https:// endpoint) that is plausibly an MCP server, so agents
 * can't fill the ledger with unrelated packages. Recording is free (it's the
 * demand signal); grading starts once the request's $1 fee is paid — the
 * response's `payment` says how.
 */
export async function runGradeRequest(
  input: GradeRequestInput,
  ctx: LookupContext,
): Promise<GradeRequestResult> {
  if (HOSTED_GRADING_DISABLED) {
    return { status: "error", code: 410, error: HOSTED_GRADING_SUNSET_MESSAGE };
  }

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

  // The RPC returns a single row: { created, demand } — no row id, so look the
  // request up for the payment link. Deterministic: one row per (target, email)
  // when an email was given, one email-less row per target otherwise.
  const requestQuery = supabase
    .from("grade_requests")
    .select("id, priority_paid_at")
    .eq("target", parsed.target);
  const { data: reqRow } = await (
    email ? requestQuery.eq("email", email) : requestQuery.is("email", null)
  ).maybeSingle();
  const requestId = (reqRow as { id?: string } | null)?.id ?? null;
  const paid = Boolean((reqRow as { priority_paid_at?: string | null } | null)?.priority_paid_at);

  const row = Array.isArray(data) ? data[0] : data;
  return {
    status: "queued",
    created: row?.created ?? true,
    demand: row?.demand ?? 1,
    requestId,
    payment: {
      required: !paid,
      usdPrice: PRIORITY_GRADE_PRICE_USD,
      payUrl: requestId ? `${SITE_ORIGIN}/request/priority/${requestId}` : null,
      x402Url: `${SITE_ORIGIN}/api/x402/grade-request`,
    },
  };
}
