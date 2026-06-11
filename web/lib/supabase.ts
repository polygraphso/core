import { createClient, type SupabaseClient } from "@supabase/supabase-js";

let cached: SupabaseClient | null = null;

/**
 * Lazy service-role client (server-only). Returns null when unconfigured so
 * server components and routes can render a safe fallback instead of throwing.
 */
export function getSupabaseAdmin(): SupabaseClient | null {
  if (cached) return cached;
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) return null;
  cached = createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  return cached;
}
