/**
 * POST /api/admin/ecosystems/[id]/payment/stop — stop an ecosystem's active
 * monitoring subscription server-side. The manage console locks now; the
 * payer's Sablier stream keeps running until THEY cancel it (cancel is
 * sender-only). The activate flow captures no payer contact, so we notify
 * every active ecosystem member (the /manage notice is the payer-facing
 * fallback). Best-effort — the stop never blocks on mail; `notified` counts
 * the emails sent. App-admin only (proxy gates /api/admin/*; the session
 * check is depth).
 */

import { getSession } from "@/lib/session";
import { getEcosystemById, listMembers } from "@/lib/ecosystemData";
import { stopEcosystemPayment } from "@/lib/ecosystemPayments";
import {
  buildSubscriptionStoppedEmail,
  sendSubscriptionStoppedEmail,
} from "@/lib/subscriptionEmails";
import { SITE_ORIGIN } from "@/lib/site";

export async function POST(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const session = await getSession();
  if (!session?.isAdmin) return Response.json({ error: "Forbidden" }, { status: 403 });

  const ecosystem = await getEcosystemById(id);
  if (!ecosystem) return Response.json({ error: "Unknown ecosystem" }, { status: 404 });

  const stopped = await stopEcosystemPayment(id);
  if (!stopped) {
    return Response.json({ error: "No active subscription to stop." }, { status: 404 });
  }

  let notified = 0;
  try {
    const recipients = (await listMembers(id))
      .filter((m) => m.status === "active")
      .map((m) => m.email);
    if (recipients.length > 0) {
      const composed = buildSubscriptionStoppedEmail({
        kind: "ecosystem",
        label: `${ecosystem.name} monitoring`,
        endAt: stopped.end_at,
        manageUrl: `${SITE_ORIGIN}/manage/${ecosystem.slug}`,
      });
      await sendSubscriptionStoppedEmail(recipients, composed);
      notified = recipients.length;
    }
  } catch (e) {
    console.error("[admin/ecosystems/stop] notify failed", e);
  }

  return Response.json({
    ok: true,
    stopped: { streamId: stopped.stream_id, endAt: stopped.end_at },
    notified,
  });
}
