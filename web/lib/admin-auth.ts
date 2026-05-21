/**
 * Admin auth: shared password + signed cookie.
 *
 * Both co-founders share one password. The cookie is HMAC-signed with
 * ADMIN_COOKIE_SECRET; verifying is timing-safe. There is no per-person
 * audit — this is a v0 internal tool. Upgrade to GitHub OAuth + allowlist
 * when a third person needs access (per admin-dashboard-brief).
 *
 * Password rotation: change ADMIN_PASSWORD on the server, redeploy. All
 * sessions remain valid until the existing 30-day cookies expire; if you
 * need them invalidated immediately, also rotate ADMIN_COOKIE_SECRET.
 */

import crypto from "node:crypto";

export const ADMIN_COOKIE_NAME = "polygraph_admin";
const COOKIE_MAX_AGE_S = 60 * 60 * 24 * 30; // 30 days

interface AdminEnv {
  password: string;
  secret: string;
}

function getEnv(): AdminEnv {
  const password = process.env.ADMIN_PASSWORD;
  const secret = process.env.ADMIN_COOKIE_SECRET;
  if (!password || !secret) {
    throw new Error(
      "ADMIN_PASSWORD and ADMIN_COOKIE_SECRET must be set for /admin.",
    );
  }
  if (secret.length < 32) {
    throw new Error("ADMIN_COOKIE_SECRET must be at least 32 chars.");
  }
  return { password, secret };
}

/** Constant-time string equality. Both inputs must be UTF-8 strings. */
function timingSafeEqualStr(a: string, b: string): boolean {
  const aBuf = Buffer.from(a, "utf8");
  const bBuf = Buffer.from(b, "utf8");
  if (aBuf.length !== bBuf.length) {
    // crypto.timingSafeEqual requires equal lengths. Still do a constant-time
    // compare against aBuf to keep timing flat even on length mismatch.
    crypto.timingSafeEqual(aBuf, aBuf);
    return false;
  }
  return crypto.timingSafeEqual(aBuf, bBuf);
}

export function verifyPassword(attempt: string): boolean {
  const { password } = getEnv();
  return timingSafeEqualStr(attempt, password);
}

/**
 * Cookie value: `<issuedAtSeconds>.<hexHmac>` where hmac = HMAC-SHA256(secret, issuedAtSeconds).
 *
 * We don't store the password or a user id — there's just one tier of
 * access. The HMAC proves the cookie was minted by the server within
 * COOKIE_MAX_AGE_S of `now`.
 */
function sign(payload: string, secret: string): string {
  return crypto.createHmac("sha256", secret).update(payload).digest("hex");
}

export function mintCookieValue(): string {
  const { secret } = getEnv();
  const issuedAt = Math.floor(Date.now() / 1000).toString(10);
  return `${issuedAt}.${sign(issuedAt, secret)}`;
}

export function isCookieValid(value: string | undefined | null): boolean {
  if (!value) return false;
  const dot = value.indexOf(".");
  if (dot <= 0 || dot === value.length - 1) return false;
  const issuedAt = value.slice(0, dot);
  const givenSig = value.slice(dot + 1);
  if (!/^\d+$/.test(issuedAt)) return false;

  let secret: string;
  try {
    secret = getEnv().secret;
  } catch {
    // Env missing — refuse access rather than throwing for every request.
    return false;
  }
  const expectedSig = sign(issuedAt, secret);
  // Length check before timingSafeEqual (which throws on mismatch).
  if (givenSig.length !== expectedSig.length) return false;
  if (
    !crypto.timingSafeEqual(
      Buffer.from(givenSig, "utf8"),
      Buffer.from(expectedSig, "utf8"),
    )
  ) {
    return false;
  }
  const issuedAtSec = Number.parseInt(issuedAt, 10);
  const ageSec = Math.floor(Date.now() / 1000) - issuedAtSec;
  // Allow up to 60s of clock skew into the future.
  if (ageSec < -60 || ageSec > COOKIE_MAX_AGE_S) return false;
  return true;
}

export const ADMIN_COOKIE_OPTIONS = {
  httpOnly: true,
  secure: process.env.NODE_ENV === "production",
  sameSite: "lax" as const,
  path: "/",
  maxAge: COOKIE_MAX_AGE_S,
};

/**
 * Server-side check used by protected pages and route handlers.
 * Returns true if the request carries a valid admin cookie.
 *
 * Importer note: requires `next/headers`, so only callable from RSC,
 * server actions, or route handlers — never from a client component.
 */
export async function hasValidAdminSession(): Promise<boolean> {
  const { cookies } = await import("next/headers");
  const store = await cookies();
  return isCookieValid(store.get(ADMIN_COOKIE_NAME)?.value);
}
