/**
 * POST /api/grade-requests — add a server to the public grading queue.
 *
 * Body: { target: string, email: string, note?: string }
 *   target = registry ref (npm/… | pypi/… | github/…) or https:// MCP URL
 *
 * Free, anonymous-but-email-gated. Writes a grade_requests row (idempotent
 * on target+email) and returns the current demand for that target so the
 * UI can show "N people have asked for this."
 *
 * Contract: grade_requests migration (record_grade_request RPC). Rúben
 * drains the queue manually.
 */

import { NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabase";
import { parseGradeTarget } from "@/lib/gradeTarget";
import { enforceRateLimit, honeypotTripped } from "@/lib/rateLimit";
import { getSession } from "@/lib/session";

const TARGET_MAX_LEN = 512;
const NOTE_MAX_LEN = 2000;

export async function POST(request: Request) {
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

  // Proxy guarantees a session for this route; use it server-authoritatively.
  const session = await getSession();
  if (!session) {
    return NextResponse.json(
      { ok: false, message: "Sign in to request a grade." },
      { status: 401 },
    );
  }
  const normalizedEmail = session.email;

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

  // The RPC returns a single row: { created, demand }.
  const row = Array.isArray(data) ? data[0] : data;
  return NextResponse.json({
    ok: true,
    created: row?.created ?? true,
    demand: row?.demand ?? 1,
    target: parsed.target,
  });
}
