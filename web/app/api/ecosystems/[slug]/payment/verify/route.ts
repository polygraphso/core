/**
 * POST /api/ecosystems/[slug]/payment/verify — attach a Sablier stream to the
 * ecosystem as its monitoring payment.
 *
 * Body: { txHash: string } — the stream's CREATION transaction.
 *
 * PUBLIC — a client can pay before they ever have an account; the wallet is
 * the identity. Safe without auth because the transaction is the proof: the
 * stream is derived from its creation event (never a client-supplied id), the
 * event's shape tag must name THIS ecosystem (so another client's stream can't
 * be claimed here), and the deposit must cover the monthly price for the
 * stream's duration at the current rate (5% tolerance). The only thing an
 * unauthenticated caller can do is pay for someone's monitoring. Idempotent
 * for a stream already attached to this ecosystem.
 */

import { getEcosystemBySlug } from "@/lib/ecosystemData";
import { verifyStreamPayment } from "@/lib/ecosystemPayments";

export async function POST(request: Request, { params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const ecosystem = await getEcosystemBySlug(slug);
  if (!ecosystem) return Response.json({ error: "Unknown ecosystem" }, { status: 404 });

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

  const result = await verifyStreamPayment(ecosystem, txHash);
  if (!result.ok) return Response.json({ error: result.reason }, { status: 422 });
  return Response.json({
    ok: true,
    status: "active",
    endAt: result.payment.end_at,
  });
}
