/**
 * Supabase session reader for RSC + route handlers.
 *
 * Auth (GitHub OAuth) is on the onboarding-brief roadmap but isn't wired
 * into web/ yet — no /auth/callback, no sign-in surface. So this helper
 * intentionally returns null today. When auth lands, this is the single
 * place to swap in `@supabase/ssr`'s `createServerClient` + cookie-based
 * session lookup; the /notify page and /api/notify route will pick up
 * the signed-in branch with no further changes.
 *
 * Returning a typed shape (rather than `any` or just user-id) keeps the
 * callers honest: today they handle null, tomorrow they get email +
 * user_id from the same call.
 */

export interface PolygraphSession {
  userId: string;
  email: string;
}

export async function getSession(): Promise<PolygraphSession | null> {
  return null;
}
