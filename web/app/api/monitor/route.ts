/**
 * POST /api/monitor — subscribe to new-version regrade alerts for one server.
 *
 * Two paths (mirrors /api/notify):
 *   1. Anonymous:  {server_ref, email} → monitors row keyed on email.
 *   2. Signed-in:  {server_ref}        → email from the Supabase session, keyed
 *                                         on user_id.
 *
 * Idempotent on (target, email_or_user_id) via record_monitor's ON CONFLICT.
 *
 * v1 only accepts npm/pypi registry refs — the targets with a version stream the
 * alert engine can detect. Remote URLs (rejected by parseServerRef) and github
 * refs are turned away so we never create a monitor that can physically never
 * fire.
 */

import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import {
  ServerRefParseError,
  parseServerRef,
  serverKey,
} from "@/lib/identity";
import { getSession } from "@/lib/session";
import { enforceRateLimit, honeypotTripped } from "@/lib/rateLimit";

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
  const limited = await enforceRateLimit(request, "monitor", { max: 12, windowSeconds: 60 });
  if (limited) return limited;

  let payload: unknown;
  try {
    payload = await request.json();
  } catch {
    return NextResponse.json({ ok: false, message: "Invalid JSON body." }, { status: 400 });
  }

  const { server_ref, email, company } = (payload ?? {}) as {
    server_ref?: unknown;
    email?: unknown;
    company?: unknown;
  };

  // Honeypot: a bot that fills the hidden field gets a silent ok and no write.
  if (honeypotTripped(company)) {
    return NextResponse.json({ ok: true });
  }

  if (typeof server_ref !== "string" || server_ref.length === 0) {
    return NextResponse.json({ ok: false, message: "server_ref is required." }, { status: 400 });
  }
  if (server_ref.length > 512) {
    return NextResponse.json({ ok: false, message: "server_ref is too long." }, { status: 400 });
  }

  // Normalize to the versionless server_key form AND gate on a monitorable
  // registry (npm/pypi). parseServerRef rejects remote URLs; we additionally
  // reject github refs (no first-class version stream).
  let normalizedRef: string;
  try {
    const parsed = parseServerRef(server_ref);
    if (parsed.registry !== "npm" && parsed.registry !== "pypi") {
      return NextResponse.json(
        {
          ok: false,
          message:
            "Monitoring is available for npm and pypi servers — they're the ones with a version stream we can watch.",
        },
        { status: 400 },
      );
    }
    normalizedRef = serverKey(parsed);
  } catch (err) {
    if (err instanceof ServerRefParseError) {
      return NextResponse.json({ ok: false, message: err.message }, { status: 400 });
    }
    throw err;
  }

  const session = await getSession();

  let rpcEmail: string | null = null;
  let rpcUserId: string | null = null;

  if (session) {
    rpcUserId = session.userId;
  } else {
    if (typeof email !== "string") {
      return NextResponse.json({ ok: false, message: "Enter a valid email address." }, { status: 400 });
    }
    const normalized = email.trim().toLowerCase();
    if (
      normalized.length === 0 ||
      normalized.length > EMAIL_MAX_LEN ||
      !EMAIL_RE.test(normalized)
    ) {
      return NextResponse.json({ ok: false, message: "Enter a valid email address." }, { status: 400 });
    }
    rpcEmail = normalized;
  }

  try {
    const supabase = getSupabase();
    const { error } = await supabase.rpc("record_monitor", {
      p_target: normalizedRef,
      p_email: rpcEmail,
      p_user_id: rpcUserId,
    });
    if (error) {
      console.error("[monitor] record_monitor failed:", error.message);
      return NextResponse.json(
        {
          ok: false,
          message: "Couldn't save your subscription. Try again or email hello@polygraph.so.",
        },
        { status: 500 },
      );
    }
  } catch (err) {
    console.error(
      "[monitor] supabase client init failed:",
      err instanceof Error ? err.message : String(err),
    );
    return NextResponse.json(
      {
        ok: false,
        message: "Couldn't save your subscription. Try again or email hello@polygraph.so.",
      },
      { status: 500 },
    );
  }

  return NextResponse.json({ ok: true });
}
