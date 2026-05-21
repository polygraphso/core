/**
 * POST /api/admin/login — accept shared password, set signed cookie.
 *
 * Form-encoded body so the login page can submit with no JS. Constant-time
 * password compare via crypto.timingSafeEqual (in admin-auth.ts). We log
 * success/failure with timestamp + remote IP if available; we do NOT log
 * the attempted password.
 */

import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import {
  ADMIN_COOKIE_NAME,
  ADMIN_COOKIE_OPTIONS,
  mintCookieValue,
  verifyPassword,
} from "@/lib/admin-auth";

function loginRedirect(url: URL, params: Record<string, string>): NextResponse {
  const target = new URL("/admin/login", url);
  for (const [k, v] of Object.entries(params)) target.searchParams.set(k, v);
  return NextResponse.redirect(target, { status: 303 });
}

export async function POST(request: Request) {
  const form = await request.formData();
  const password = form.get("password");
  const next = form.get("next");
  const requestUrl = new URL(request.url);

  // Preserve the requested deep-link across error redirects so a typo
  // doesn't dump the user back at /admin.
  const errParams: Record<string, string> = { e: "1" };
  if (typeof next === "string" && next.startsWith("/admin")) {
    errParams.next = next;
  }

  if (typeof password !== "string" || password.length === 0) {
    console.warn(`[admin/login] missing password @ ${new Date().toISOString()}`);
    return loginRedirect(requestUrl, errParams);
  }

  let ok: boolean;
  try {
    ok = verifyPassword(password);
  } catch (err) {
    console.error(
      "[admin/login] env misconfigured:",
      err instanceof Error ? err.message : String(err),
    );
    return loginRedirect(requestUrl, { ...errParams, e: "cfg" });
  }

  if (!ok) {
    console.warn(
      `[admin/login] failed attempt @ ${new Date().toISOString()} from ${
        request.headers.get("x-forwarded-for") ?? "?"
      }`,
    );
    return loginRedirect(requestUrl, errParams);
  }

  // Where to send the user post-login. Only same-origin paths are allowed.
  let dest = "/admin";
  if (typeof next === "string" && next.startsWith("/admin")) {
    dest = next;
  }

  const cookieStore = await cookies();
  cookieStore.set({
    name: ADMIN_COOKIE_NAME,
    value: mintCookieValue(),
    ...ADMIN_COOKIE_OPTIONS,
  });

  console.log(`[admin/login] success @ ${new Date().toISOString()}`);
  return NextResponse.redirect(new URL(dest, requestUrl), { status: 303 });
}
