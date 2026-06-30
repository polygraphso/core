/**
 * Admin-dashboard auth: a signed session cookie + constant-time password
 * check. Uses the Web Crypto API exclusively (no node:crypto) so the verify
 * path runs unchanged in Edge middleware AND Node route handlers.
 *
 * The cookie never contains the password. Token format:
 *   `${expiresAt}.${hmac}`  where hmac = HMAC-SHA256("v1.${expiresAt}", ADMIN_PASSWORD)
 * Verifying recomputes the HMAC and constant-time-compares.
 *
 * Revocation model: the session-signing key and the login password are
 * intentionally the SAME secret (ADMIN_PASSWORD). Rotating ADMIN_PASSWORD
 * therefore invalidates every live session AND changes the password in one
 * move — "change the password to lock everyone out." There is no separate
 * per-session revocation, by design.
 *
 * Note: checkPassword HMACs its input with a fixed constant only to make the
 * comparison length-blind — this is NOT password hashing/stretching. That's
 * acceptable here because ADMIN_PASSWORD is a high-entropy env-var secret, not
 * a user-chosen DB password that would need a slow KDF.
 *
 * NEVER import this from a client component — it reads ADMIN_PASSWORD.
 */

export const ADMIN_COOKIE = "pg_admin";
export const ADMIN_SESSION_TTL_SECONDS = 60 * 60 * 24 * 30; // 30 days

const encoder = new TextEncoder();

function getSecret(): string | null {
  return process.env.ADMIN_PASSWORD || null;
}

function toHex(buf: ArrayBuffer): string {
  return Array.from(new Uint8Array(buf))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

async function hmacHex(message: string, secret: string): Promise<string> {
  const key = await crypto.subtle.importKey(
    "raw",
    encoder.encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const sig = await crypto.subtle.sign("HMAC", key, encoder.encode(message));
  return toHex(sig);
}

/** Constant-time compare of two equal-length hex strings. */
function timingSafeEqualHex(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let mismatch = 0;
  for (let i = 0; i < a.length; i++) {
    mismatch |= a.charCodeAt(i) ^ b.charCodeAt(i);
  }
  return mismatch === 0;
}

/** Produce a signed token, or null if ADMIN_PASSWORD is unset. */
export async function signSession(nowSeconds: number): Promise<string | null> {
  const secret = getSecret();
  if (!secret) return null;
  const expiresAt = nowSeconds + ADMIN_SESSION_TTL_SECONDS;
  const sig = await hmacHex(`v1.${expiresAt}`, secret);
  return `${expiresAt}.${sig}`;
}

/** True iff `token` is well-formed, unexpired, and validly signed. */
export async function verifySession(
  token: string | undefined,
  nowSeconds: number,
): Promise<boolean> {
  const secret = getSecret();
  if (!secret || !token) return false;
  const dot = token.indexOf(".");
  if (dot <= 0) return false;
  const expiresAtStr = token.slice(0, dot);
  const sig = token.slice(dot + 1);
  const expiresAt = Number(expiresAtStr);
  if (!Number.isFinite(expiresAt) || expiresAt <= nowSeconds) return false;
  const expected = await hmacHex(`v1.${expiresAtStr}`, secret);
  return timingSafeEqualHex(sig, expected);
}

/** Constant-time check of a submitted password against ADMIN_PASSWORD. */
export async function checkPassword(input: string): Promise<boolean> {
  const secret = getSecret();
  if (!secret) return false;
  // Hash both sides to fixed-length digests so the compare is length-blind.
  // This is NOT password hashing/stretching; it's fine because ADMIN_PASSWORD
  // is a high-entropy env-var secret, not a user-chosen password.
  const a = await hmacHex(input, "pg-pw-compare");
  const b = await hmacHex(secret, "pg-pw-compare");
  return timingSafeEqualHex(a, b);
}
