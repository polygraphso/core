/**
 * POST /api/admin/login — verify the shared admin password (rate-limited),
 * set the signed session cookie, redirect to /admin. Failures redirect back
 * to the login page with a generic error (never reveals which part failed).
 *
 * Accepts an HTML form POST (application/x-www-form-urlencoded): field `password`.
 */
import { NextResponse } from "next/server";
import {
  signSession,
  checkPassword,
  ADMIN_COOKIE,
  ADMIN_SESSION_TTL_SECONDS,
} from "@/lib/adminAuth";
import { enforceRateLimit } from "@/lib/rateLimit";

function redirect(request: Request, to: string, status = 303) {
  return NextResponse.redirect(new URL(to, request.url), status);
}

export async function POST(request: Request) {
  // Throttle brute-force attempts per IP.
  const limited = await enforceRateLimit(request, "admin-login", {
    max: 5,
    windowSeconds: 60,
  });
  if (limited) return redirect(request, "/admin/login?error=rate");

  let password = "";
  try {
    const form = await request.formData();
    const raw = form.get("password");
    password = typeof raw === "string" ? raw : "";
  } catch {
    return redirect(request, "/admin/login?error=1");
  }

  if (!password || !(await checkPassword(password))) {
    return redirect(request, "/admin/login?error=1");
  }

  const token = await signSession(Math.floor(Date.now() / 1000));
  if (!token) {
    // ADMIN_PASSWORD unset on the server — can't issue a session.
    return redirect(request, "/admin/login?error=config");
  }

  const res = redirect(request, "/admin");
  res.cookies.set(ADMIN_COOKIE, token, {
    httpOnly: true,
    secure: true,
    sameSite: "lax",
    path: "/",
    maxAge: ADMIN_SESSION_TTL_SECONDS,
  });
  return res;
}
