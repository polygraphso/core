/**
 * POST /api/grade-requests/[id]/priority/verify — record the priority payment.
 *
 * Body: { txHash } — the transfer transaction. Session-gated by the proxy.
 * Safe because the payment is bound by the exact quoted amount (unique among
 * open quotes): the tx must carry a $POLYGRAPH Transfer of exactly that amount
 * to the treasury. Idempotent for a tx already recorded on this request.
 */

import { verifyTransferPayment } from "@/lib/priorityPayments";

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!/^[0-9a-f-]{36}$/.test(id)) {
    return Response.json({ error: "bad request id" }, { status: 400 });
  }

  let body: { txHash?: unknown };
  try {
    body = (await request.json()) as typeof body;
  } catch {
    return Response.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const txHash =
    typeof body.txHash === "string" && /^0x[0-9a-fA-F]{64}$/.test(body.txHash)
      ? body.txHash
      : null;
  if (!txHash) {
    return Response.json({ error: "txHash must be a transaction hash." }, { status: 400 });
  }

  const result = await verifyTransferPayment(id, txHash);
  if (!result.ok) return Response.json({ error: result.reason }, { status: 422 });
  return Response.json({ ok: true, deadlineAt: result.deadlineAt });
}
