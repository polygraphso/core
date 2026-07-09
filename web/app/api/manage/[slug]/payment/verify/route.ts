/**
 * POST /api/manage/[slug]/payment/verify — attach a Sablier stream to the
 * ecosystem as its monitoring payment.
 *
 * Body: { streamId: number, txHash?: string }
 *
 * The stream is the proof: the route reads it onchain and requires the right
 * token, the treasury as recipient, a ~12-month term, and a deposit covering
 * the USD-pegged price at the current rate (5% tolerance). Nothing client-side
 * is trusted beyond the pointer. requirePaid: false — this IS the payment path;
 * idempotent for the stream already attached to this ecosystem.
 */

import { guardManage } from "@/lib/manageApi";
import { verifyStreamPayment } from "@/lib/ecosystemPayments";

export async function POST(request: Request, { params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const guard = await guardManage(slug, { requirePaid: false });
  if (guard instanceof Response) return guard;
  const { access } = guard;

  let body: { streamId?: unknown; txHash?: unknown };
  try {
    body = (await request.json()) as typeof body;
  } catch {
    return Response.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const streamId = typeof body.streamId === "number" ? body.streamId : Number(body.streamId);
  if (!Number.isInteger(streamId) || streamId < 0) {
    return Response.json({ error: "streamId must be a stream number." }, { status: 400 });
  }
  const txHash =
    typeof body.txHash === "string" && /^0x[0-9a-fA-F]{64}$/.test(body.txHash)
      ? body.txHash
      : null;

  const result = await verifyStreamPayment(access.ecosystem, streamId, txHash);
  if (!result.ok) return Response.json({ error: result.reason }, { status: 422 });
  return Response.json({
    ok: true,
    status: "active",
    endAt: result.payment.end_at,
  });
}
