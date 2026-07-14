/**
 * POST /api/account/delete — hard-delete the caller's own account.
 *
 * Session-gated by the proxy (/api/account/:path*). Deletes the Supabase auth
 * user via the service role, which cascades every user-scoped row: profiles,
 * monitors, user_plan_payments, notify_requests, and ecosystem_members all have
 * `on delete cascade`; ecosystems they created survive (created_by → null).
 *
 * Note: an active plan's Sablier stream is onchain and independent of this DB,
 * so it keeps running after deletion — the UI warns the user to cancel it
 * first. Grade requests are email-keyed (a public-queue artifact), not
 * user-scoped, so they are intentionally left in place.
 */

import { getSession } from "@/lib/session";
import { getSupabaseAdmin } from "@/lib/supabase";

export async function POST() {
  const session = await getSession();
  if (!session) return Response.json({ error: "Unauthorized" }, { status: 401 });

  const db = getSupabaseAdmin();
  if (!db) return Response.json({ error: "Account service unavailable." }, { status: 503 });

  const { error } = await db.auth.admin.deleteUser(session.userId);
  if (error) {
    console.error("[account/delete] deleteUser failed:", error.message);
    return Response.json(
      { error: "Couldn't delete the account. Try again or email hello@polygraph.so." },
      { status: 500 },
    );
  }

  return Response.json({ ok: true });
}
