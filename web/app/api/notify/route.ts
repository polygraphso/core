/**
 * POST /api/notify — per-server notify funnel.
 *
 * Two paths:
 *   1. Anonymous:  {server_ref, email} → notify_requests row keyed on email.
 *   2. Signed-in:  {server_ref}        → email resolved from Supabase
 *                                         session, row keyed on user_id.
 *
 * Idempotent on (server_ref, email_or_user_id) — handled by the partial
 * unique indexes + ON CONFLICT DO NOTHING inside record_notify_request.
 *
 * Contract: see core-contracts.md §"API surface" and onboarding-brief.md
 * §"Notify funnel (untracked servers)".
 */

import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import {
  ServerRefParseError,
  parseServerRef,
  serverKey,
} from "@/lib/identity";
import { getSession } from "@/lib/session";

const EMAIL_MAX_LEN = 254;
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

function getSupabase() {
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) {
    throw new Error(
      "SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY must be set on the server.",
    );
  }
  return createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
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

  const { server_ref, email } = (payload ?? {}) as {
    server_ref?: unknown;
    email?: unknown;
  };

  if (typeof server_ref !== "string" || server_ref.length === 0) {
    return NextResponse.json(
      { ok: false, message: "server_ref is required." },
      { status: 400 },
    );
  }
  if (server_ref.length > 512) {
    return NextResponse.json(
      { ok: false, message: "server_ref is too long." },
      { status: 400 },
    );
  }

  // Normalize to the versionless server_key form so {npm/foo@1.0.0} and
  // {npm/foo@1.0.1} dedupe to one row per requester. Same canonicalization
  // the CLI/check route applies.
  let normalizedRef: string;
  try {
    normalizedRef = serverKey(parseServerRef(server_ref));
  } catch (err) {
    if (err instanceof ServerRefParseError) {
      return NextResponse.json(
        { ok: false, message: err.message },
        { status: 400 },
      );
    }
    throw err;
  }

  const session = await getSession();

  // Resolve identity. Signed-in callers may omit email; we use the session's.
  // Anonymous callers must supply a valid email.
  let rpcEmail: string | null = null;
  let rpcUserId: string | null = null;

  if (session) {
    rpcUserId = session.userId;
  } else {
    if (typeof email !== "string") {
      return NextResponse.json(
        { ok: false, message: "Enter a valid email address." },
        { status: 400 },
      );
    }
    const normalized = email.trim().toLowerCase();
    if (
      normalized.length === 0 ||
      normalized.length > EMAIL_MAX_LEN ||
      !EMAIL_RE.test(normalized)
    ) {
      return NextResponse.json(
        { ok: false, message: "Enter a valid email address." },
        { status: 400 },
      );
    }
    rpcEmail = normalized;
  }

  try {
    const supabase = getSupabase();
    const { error } = await supabase.rpc("record_notify_request", {
      p_server_ref: normalizedRef,
      p_email: rpcEmail,
      p_user_id: rpcUserId,
    });
    if (error) {
      console.error("[notify] record_notify_request failed:", error.message);
      return NextResponse.json(
        {
          ok: false,
          message:
            "Couldn't save your request. Try again or email hello@polygraph.so.",
        },
        { status: 500 },
      );
    }
  } catch (err) {
    console.error(
      "[notify] supabase client init failed:",
      err instanceof Error ? err.message : String(err),
    );
    return NextResponse.json(
      {
        ok: false,
        message:
          "Couldn't save your request. Try again or email hello@polygraph.so.",
      },
      { status: 500 },
    );
  }

  return NextResponse.json({ ok: true });
}
