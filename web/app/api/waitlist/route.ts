import { NextResponse } from "next/server";
import { withApiLogging } from "@/lib/api-logging";
import { getSupabase } from "@/lib/supabase-server";

// Practical max from RFC 5321; longer addresses are not deliverable in
// practice and the regex below assumes a bounded input.
const EMAIL_MAX_LEN = 254;
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

const ALLOWED_ROLES = new Set([
  "",
  "developer",
  "security",
  "founder",
  "researcher",
  "other",
]);

async function handlePOST(request: Request): Promise<Response> {
  let payload: unknown;
  try {
    payload = await request.json();
  } catch {
    return NextResponse.json(
      { ok: false, message: "Invalid JSON body." },
      { status: 400 },
    );
  }

  const { email, role, source } = (payload ?? {}) as {
    email?: unknown;
    role?: unknown;
    source?: unknown;
  };

  if (typeof email !== "string") {
    return NextResponse.json(
      { ok: false, message: "Enter a valid email address." },
      { status: 400 },
    );
  }
  const normalizedEmail = email.trim().toLowerCase();
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

  const safeRole =
    typeof role === "string" && ALLOWED_ROLES.has(role) ? role : "";
  const safeSource =
    typeof source === "string" && source.length <= 64 ? source : "unknown";

  try {
    const supabase = getSupabase();
    const { error } = await supabase.rpc("record_waitlist_signup", {
      p_email: normalizedEmail,
      p_role: safeRole,
      p_source: safeSource,
    });
    if (error) {
      console.error("[waitlist] record_waitlist_signup failed:", error.message);
      return NextResponse.json(
        { ok: false, message: "Could not subscribe. Try again." },
        { status: 500 },
      );
    }
  } catch (err) {
    console.error(
      "[waitlist] supabase client init failed:",
      err instanceof Error ? err.message : String(err),
    );
    return NextResponse.json(
      { ok: false, message: "Could not subscribe. Try again." },
      { status: 500 },
    );
  }

  return NextResponse.json({ ok: true });
}

export const POST = withApiLogging("/api/waitlist", handlePOST);
