import "server-only";
import { createServerSupabase } from "@/lib/supabaseServer";

export interface PolygraphSession {
  userId: string;
  email: string;
}

/**
 * Returns the current Supabase session for RSC + route handlers.
 *
 * Uses getUser() (not getSession()) — re-validates the JWT server-side so
 * the userId is trustworthy. getSession() trusts the cookie payload and can
 * be spoofed; all userId-filtered reads depend on this distinction.
 */
export async function getSession(): Promise<PolygraphSession | null> {
  try {
    const supabase = await createServerSupabase();
    const {
      data: { user },
      error,
    } = await supabase.auth.getUser();
    if (error || !user) return null;
    return { userId: user.id, email: user.email ?? "" };
  } catch {
    return null;
  }
}
