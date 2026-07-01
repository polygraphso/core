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
import { enforceRateLimit, honeypotTripped } from "@/lib/rateLimit";

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
  const limited = await enforceRateLimit(request, "notify", { max: 12, windowSeconds: 60 });
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

  const { server_ref, email, company } = (payload ?? {}) as {
    server_ref?: unknown;
    email?: unknown;
    company?: unknown;
  };

  // Honeypot: hidden field; a bot that fills it gets a silent ok and no write.
  if (honeypotTripped(company)) {
    return NextResponse.json({ ok: true });
  }

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

  // Proxy guarantees a Supabase session for this route.
  const session = await getSession();
  if (!session) {
    return NextResponse.json(
      { ok: false, message: "Sign in to request notifications." },
      { status: 401 },
    );
  }

  try {
    const supabase = getSupabase();
    const { error } = await supabase.rpc("record_notify_request", {
      p_server_ref: normalizedRef,
      p_email: null,
      p_user_id: session.userId,
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
