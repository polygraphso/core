/**
 * POST /api/account/plan/verify — attach a Sablier stream to the signed-in
 * user as their plan payment.
 *
 * Body: { plan: "indie"|"team", txHash: string } — the stream's CREATION
 * transaction. Session-required: the shape tag in the creation event must name
 * this user (planShapeTag), so a stream created for anyone else 422s. The
 * deposit is re-priced onchain for the claimed plan; claiming a pricier plan
 * than was paid for fails the deposit check. Idempotent for a stream already
 * attached to this user.
 */

import { getSession } from "@/lib/session";
import { verifyPlanStreamPayment } from "@/lib/userPlans";
import { PLAN_QUOTAS } from "@/lib/paymentConfig";

export async function POST(request: Request) {
  const session = await getSession();
  if (!session) return Response.json({ error: "Unauthorized" }, { status: 401 });

  let body: { plan?: unknown; txHash?: unknown };
  try {
    body = (await request.json()) as typeof body;
  } catch {
    return Response.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const plan = body.plan === "indie" || body.plan === "team" ? body.plan : null;
  if (!plan) return Response.json({ error: "plan must be indie or team" }, { status: 400 });

  const txHash =
    typeof body.txHash === "string" && /^0x[0-9a-fA-F]{64}$/.test(body.txHash)
      ? body.txHash
      : null;
  if (!txHash) {
    return Response.json({ error: "txHash must be a transaction hash." }, { status: 400 });
  }

  const result = await verifyPlanStreamPayment(session.userId, plan, txHash);
  if (!result.ok) return Response.json({ error: result.reason }, { status: 422 });
  return Response.json({
    ok: true,
    plan: result.payment.plan,
    quota: PLAN_QUOTAS[result.payment.plan],
    endAt: result.payment.end_at,
  });
}
