/**
 * POST /api/manage/[slug]/payment/refresh — force an immediate onchain re-check
 * of the ecosystem's monitoring stream. Called by the cancel button right after
 * the cancel tx confirms, so the console reflects it without waiting out the
 * hourly gate. Admin/app-admin only; `requirePaid: false` because the whole
 * point is to reconcile a stream that may have just been canceled.
 */

import { guardManage } from "@/lib/manageApi";
import { reconcileEcosystemPayment } from "@/lib/ecosystemPayments";

export async function POST(_request: Request, { params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const guard = await guardManage(slug, { requireManage: true, requirePaid: false });
  if (guard instanceof Response) return guard;

  const status = await reconcileEcosystemPayment(guard.access.ecosystem.id);
  return Response.json({ ok: true, status });
}
