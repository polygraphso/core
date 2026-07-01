/**
 * /auth/callback — unified handler for both auth methods.
 *
 * GitHub OAuth arrives as ?code=…   → exchangeCodeForSession
 * Email magic-link arrives as ?token_hash=…&type=email → verifyOtp
 *
 * Both write session cookies via the SSR client, then redirect to ?next
 * (defaulting to /dashboard). An invalid code/token still redirects — the
 * proxy will then bounce unauthenticated users to /login again.
 */

import { NextResponse } from "next/server";
import { createServerSupabase } from "@/lib/supabaseServer";

export const dynamic = "force-dynamic";

export async function GET(request: Request): Promise<Response> {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get("code");
  const tokenHash = searchParams.get("token_hash");
  const type = searchParams.get("type");
  const next = searchParams.get("next") ?? "/dashboard";

  // Reject open-redirect: only allow same-origin relative paths
  const safeNext = next.startsWith("/") ? next : "/dashboard";

  const supabase = await createServerSupabase();

  if (code) {
    await supabase.auth.exchangeCodeForSession(code);
  } else if (tokenHash && type === "email") {
    await supabase.auth.verifyOtp({ token_hash: tokenHash, type: "email" });
  }

  return NextResponse.redirect(new URL(safeNext, origin));
}
