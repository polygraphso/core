import { createClient, type SupabaseClient } from "@supabase/supabase-js";

let cached: SupabaseClient | null = null;

/**
 * Lazy singleton for the service-role Supabase client. Lazy so importing this
 * module (e.g. from a test or typecheck) doesn't fail when env isn't set;
 * the throw happens only when a caller actually needs the client.
 *
 * All polygraph DB access runs through the service-role key — bypasses RLS,
 * never exposed to the browser. See project_supabase_access memory.
 */
export function getSupabaseClient(): SupabaseClient {
  if (cached) return cached;

  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) {
    throw new Error(
      "SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY must be set. " +
      "Copy .env.example to .env at the repo root and fill in values.",
    );
  }

  cached = createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  return cached;
}
