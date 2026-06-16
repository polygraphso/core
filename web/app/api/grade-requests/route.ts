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
import { ServerRefParseError, parseServerRef, serverKey } from "@/lib/identity";

const EMAIL_MAX_LEN = 254;
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;
const TARGET_MAX_LEN = 512;
const NOTE_MAX_LEN = 2000;

function parseTarget(
  raw: string,
): { target: string; kind: "registry_ref" | "remote_url" } | { error: string } {
  if (raw.startsWith("https://")) {
    try {
      const url = new URL(raw);
      if (url.protocol !== "https:") throw new Error("not https");
      return { target: url.toString(), kind: "remote_url" };
    } catch {
      return { error: "Enter a valid https:// MCP URL." };
    }
  }
  try {
    return { target: serverKey(parseServerRef(raw)), kind: "registry_ref" };
  } catch (err) {
    if (err instanceof ServerRefParseError) {
      return {
        error:
          "Enter a registry ref (npm/…, pypi/…, github/owner/repo) or an https:// MCP URL.",
      };
    }
    throw err;
  }
}

export async function POST(request: Request) {
  let payload: unknown;
  try {
    payload = await request.json();
  } catch {
    return NextResponse.json(
      { ok: false, message: "Invalid JSON body." },
      { status: 400 },
    );
  }

  const { target, email, note } = (payload ?? {}) as {
    target?: unknown;
    email?: unknown;
    note?: unknown;
  };

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

  const parsed = parseTarget(target.trim());
  if ("error" in parsed) {
    return NextResponse.json(
      { ok: false, message: parsed.error },
      { status: 400 },
    );
  }

  const normalizedEmail =
    typeof email === "string" ? email.trim().toLowerCase() : "";
  if (
    normalizedEmail.length === 0 ||
    normalizedEmail.length > EMAIL_MAX_LEN ||
    !EMAIL_RE.test(normalizedEmail)
  ) {
    return NextResponse.json(
      { ok: false, message: "Enter a valid email — it's how you'll hear back." },
      { status: 400 },
    );
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
