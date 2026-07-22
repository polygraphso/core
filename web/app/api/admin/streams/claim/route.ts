/**
 * POST /api/admin/streams/claim — withdraw a payment stream's withdrawable
 * balance to its recipient (the treasury), signed server-side by the ops key.
 *
 * App-admin only: gated by proxy.ts (/api/admin/* requires is_admin). The
 * private key never leaves the server; the client only ever sees the tx hash.
 *
 * Body: { kind: "ecosystem" | "plan", paymentId: string }
 */

import { getSession } from "@/lib/session";
import { claimStream } from "@/lib/streamClaims";

export async function POST(request: Request) {
  const session = await getSession();
  // Defense in depth — proxy already enforces is_admin on /api/admin/*.
  if (!session?.isAdmin) return Response.json({ error: "Forbidden" }, { status: 403 });

  let body: { kind?: unknown; paymentId?: unknown };
  try {
    body = (await request.json()) as typeof body;
  } catch {
    return Response.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const kind = body.kind === "ecosystem" || body.kind === "plan" ? body.kind : null;
  const paymentId = typeof body.paymentId === "string" ? body.paymentId : "";
  if (!kind || !paymentId) {
    return Response.json({ error: "kind and paymentId are required" }, { status: 400 });
  }

  const result = await claimStream(kind, paymentId);
  if (!result.ok) return Response.json({ error: result.reason }, { status: 409 });
  return Response.json({ txHash: result.txHash, amount: result.amount });
}
