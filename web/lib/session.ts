import "server-only";
import { createServerSupabase } from "@/lib/supabaseServer";
import { getSupabaseAdmin } from "@/lib/supabase";

export interface PolygraphSession {
  userId: string;
  email: string;
  name: string | null;
  avatarUrl: string | null;
  isAdmin: boolean;
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
    const meta = (user.user_metadata ?? {}) as Record<string, unknown>;

    // app_metadata is set by the service role and included in the JWT issued
    // by Supabase — reliable across all sign-in methods, no extra DB query.
    const isAdmin =
      (user.app_metadata as Record<string, unknown>)?.is_admin === true;

    return {
      userId: user.id,
      email: user.email ?? "",
      name: (meta.full_name ?? meta.name ?? meta.user_name ?? null) as string | null,
      avatarUrl: (meta.avatar_url ?? null) as string | null,
      isAdmin,
    };
  } catch {
    return null;
  }
}
