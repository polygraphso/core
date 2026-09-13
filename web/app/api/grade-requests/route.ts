/**
 * POST /api/grade-requests — record a grade request.
 *
 * Body: { target: string, email: string, note?: string }
 *   target = registry ref (npm/… | pypi/… | github/…) or https:// MCP URL
 *
 * Recording is anonymous-but-email-gated and free — it's the demand signal.
 * Grading starts once the request's $1 fee is paid (the response carries
 * requestId + paid so the form can route to the checkout). Idempotent on
 * target+email; returns the current demand for the target so the UI can show
 * "N people have asked for this."
 *
 * Contract: grade_requests migration (record_grade_request RPC). Rúben
 * drains the paid queue manually.
 */

import { NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabase";
import { parseGradeTarget } from "@/lib/gradeTarget";
import { verifyRunnable, checkRegistryExists } from "@/lib/verifyRunnable";
import { gateKnownMcp, isCatalogedServer } from "@/lib/knownMcp";
import { enforceRateLimit, honeypotTripped } from "@/lib/rateLimit";
import { getSession } from "@/lib/session";
import { fetchLatestRunOutcome, isBlockedByRecentFailure } from "@/lib/gradeability";
import {
  HOSTED_GRADING_DISABLED,
  HOSTED_GRADING_SUNSET_MESSAGE,
} from "@/lib/hostedGradingSunset";

const TARGET_MAX_LEN = 512;
const NOTE_MAX_LEN = 2000;
const EMAIL_MAX_LEN = 254;
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

export async function POST(request: Request) {
  if (HOSTED_GRADING_DISABLED) {
    return NextResponse.json({ ok: false, message: HOSTED_GRADING_SUNSET_MESSAGE }, { status: 410 });
  }

  const limited = await enforceRateLimit(request, "grade-requests", { max: 10, windowSeconds: 60 });
  if (limited) return limited;

  let payload: unknown;
  try {
    payload = await request.json();
  } catch {
    return NextResponse.json(
      { ok: false, message: "Invalid JSON body." },
      { status: 400 },
    );
  }

  const { target, email, note, company } = (payload ?? {}) as {
    target?: unknown;
    email?: unknown;
    note?: unknown;
    company?: unknown;
  };

  // Honeypot: a hidden field real users leave blank. A bot that fills it gets a
  // silent success and no write — no signal that it was caught.
  if (honeypotTripped(company)) {
    return NextResponse.json({ ok: true, created: false, demand: 0 });
  }

  if (typeof target !== "string" || target.trim().length === 0) {
    return NextResponse.json(
      { ok: false, message: "A server is required." },
      { status: 400 },
    );
  }
  if (target.length > TARGET_MAX_LEN) {
    return NextResponse.json(
      { ok: false, message: `That's too long (${TARGET_MAX_LEN}-char max).` },
      { status: 400 },
    );
  }

  const parsed = parseGradeTarget(target.trim());
  if ("error" in parsed) {
    return NextResponse.json(
      { ok: false, message: parsed.error },
      { status: 400 },
    );
  }

  // Only queue targets the harness could actually run: an https:// endpoint,
  // or an npm/pypi package that exists. A bare github repo (or a typo) isn't a
  // runnable target — reject it here rather than parking dead rows in the queue.
  const runnable = await verifyRunnable(parsed, checkRegistryExists);
  if (!runnable.ok) {
    return NextResponse.json(
      { ok: false, message: runnable.reason },
      { status: 422 },
    );
  }

  const supabase = getSupabaseAdmin();
  if (!supabase) {
    console.error("[grade-requests] Supabase is not configured");
    return NextResponse.json(
      {
        ok: false,
        message:
          "Couldn't save your request. Try again or email hello@polygraph.so.",
      },
      { status: 500 },
    );
  }

  // The queue is MCP-only. verifyRunnable proved it's a real package; this
  // proves it's plausibly an MCP server (a known catalog entry, or an
  // mcp/server-named ref) so a real-but-unrelated package or a typo doesn't
  // become a dead grade request.
  const known = await gateKnownMcp(parsed, (ref) => isCatalogedServer(supabase, ref));
  if (!known.ok) {
    return NextResponse.json({ ok: false, message: known.reason }, { status: 422 });
  }

  // Known-recent failure: the harness already tried this target and it didn't
  // launch from its published form. Say so now instead of queueing a request
  // that would be declined an hour later.
  const verdict = isBlockedByRecentFailure(await fetchLatestRunOutcome(supabase, parsed.target));
  if (verdict.blocked) {
    return NextResponse.json({ ok: false, message: verdict.reason }, { status: 422 });
  }

  // Anonymous-but-email-gated: a signed-in session's email wins (server-
  // authoritative), an anonymous request must carry a valid email of its own.
  // The route is public — rate limit + honeypot above are the abuse gates.
  const session = await getSession();
  let normalizedEmail: string;
  if (session) {
    normalizedEmail = session.email;
  } else {
    if (typeof email !== "string") {
      return NextResponse.json(
        { ok: false, message: "Enter a valid email address." },
        { status: 400 },
      );
    }
    normalizedEmail = email.trim().toLowerCase();
    if (
      normalizedEmail.length === 0 ||
      normalizedEmail.length > EMAIL_MAX_LEN ||
      !EMAIL_RE.test(normalizedEmail)
    ) {
      return NextResponse.json(
        { ok: false, message: "Enter a valid email address." },
        { status: 400 },
      );
    }
  }

  // Optional note, trimmed and length-guarded; empty string → null.
  let normalizedNote: string | null = null;
  if (typeof note === "string" && note.trim().length > 0) {
    if (note.length > NOTE_MAX_LEN) {
      return NextResponse.json(
        { ok: false, message: `Note is too long (${NOTE_MAX_LEN}-char max).` },
        { status: 400 },
      );
    }
    normalizedNote = note.trim();
  }

  const { data, error } = await supabase.rpc("record_grade_request", {
    p_target: parsed.target,
    p_target_kind: parsed.kind,
    p_email: normalizedEmail,
    p_note: normalizedNote,
  });

  if (error) {
    console.error("[grade-requests] record_grade_request failed:", error.message);
    return NextResponse.json(
      {
        ok: false,
        message:
          "Couldn't save your request. Try again or email hello@polygraph.so.",
      },
      { status: 500 },
    );
  }

  // The RPC returns a single row: { created, demand } — no row id, so look it
  // up (unique on target+email) for the checkout link.
  const row = Array.isArray(data) ? data[0] : data;
  const { data: reqRow } = await supabase
    .from("grade_requests")
    .select("id, priority_paid_at")
    .eq("target", parsed.target)
    .eq("email", normalizedEmail)
    .maybeSingle();

  return NextResponse.json({
    ok: true,
    created: row?.created ?? true,
    demand: row?.demand ?? 1,
    target: parsed.target,
    requestId: (reqRow as { id?: string } | null)?.id ?? null,
    paid: Boolean((reqRow as { priority_paid_at?: string | null } | null)?.priority_paid_at),
  });
}
