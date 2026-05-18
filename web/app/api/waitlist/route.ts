import { NextResponse } from "next/server";

// v0 placeholder: validate, log, and respond.
// Swap the storage block for ConvertKit/Buttondown/Postgres before launch.

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;
const ALLOWED_ROLES = new Set([
  "",
  "developer",
  "security",
  "founder",
  "researcher",
  "other",
]);

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

  const { email, role, source } = (payload ?? {}) as {
    email?: unknown;
    role?: unknown;
    source?: unknown;
  };

  if (typeof email !== "string" || !EMAIL_RE.test(email) || email.length > 254) {
    return NextResponse.json(
      { ok: false, message: "Enter a valid email address." },
      { status: 400 },
    );
  }

  const safeRole =
    typeof role === "string" && ALLOWED_ROLES.has(role) ? role : "";
  const safeSource =
    typeof source === "string" && source.length <= 64 ? source : "unknown";

  // TODO(v1): persist to chosen email service.
  // For now, log so it shows up in dev/server logs.
  console.log(
    JSON.stringify({
      kind: "waitlist.signup",
      ts: new Date().toISOString(),
      email,
      role: safeRole,
      source: safeSource,
    }),
  );

  return NextResponse.json({ ok: true });
}
