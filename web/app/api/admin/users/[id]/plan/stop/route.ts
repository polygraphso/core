/**
 * POST /api/admin/users/[id]/plan/stop — stop a user's active plan server-side.
 * The quota gate closes now; the payer's Sablier stream keeps running until
 * THEY cancel it (cancel is sender-only), so we email them to cancel and
 * reclaim the unstreamed remainder. Notification is best-effort — the stop
 * itself never blocks on mail; `notified` in the response says whether it went
 * out. App-admin only (proxy gates /api/admin/*; the session check is depth).
 */

import { getSession } from "@/lib/session";
import { getSupabaseAdmin } from "@/lib/supabase";
import { stopPlanPayment } from "@/lib/userPlans";
import {
  buildSubscriptionStoppedEmail,
  sendSubscriptionStoppedEmail,
} from "@/lib/subscriptionEmails";
import { SITE_ORIGIN } from "@/lib/site";

export async function POST(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const session = await getSession();
  if (!session?.isAdmin) return Response.json({ error: "Forbidden" }, { status: 403 });

  const stopped = await stopPlanPayment(id);
  if (!stopped) {
    return Response.json({ error: "No active plan to stop." }, { status: 404 });
  }

  let notified = false;
  try {
    const db = getSupabaseAdmin();
    const email = db ? (await db.auth.admin.getUserById(id)).data.user?.email : null;
    if (email) {
      const composed = buildSubscriptionStoppedEmail({
        kind: "plan",
        label: `${stopped.plan} plan`,
        endAt: stopped.end_at,
        manageUrl: `${SITE_ORIGIN}/dashboard/account`,
      });
      await sendSubscriptionStoppedEmail(email, composed);
      notified = true;
    }
  } catch (e) {
    console.error("[admin/plan/stop] notify failed", e);
  }

  return Response.json({
    ok: true,
    stopped: { streamId: stopped.stream_id, endAt: stopped.end_at },
    notified,
  });
}
