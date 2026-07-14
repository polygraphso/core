/**
 * POST /api/account/plan/refresh — force an immediate onchain re-check of the
 * caller's plan stream. Called by the cancel button right after the cancel tx
 * confirms, so the dashboard reflects it without waiting out the hourly gate.
 * Session-gated by the proxy (/api/account/:path*). Reads truth from the chain,
 * so it can only reconcile the caller's own plan to reality.
 */

import { getSession } from "@/lib/session";
import { reconcileUserPlan } from "@/lib/userPlans";

export async function POST() {
  const session = await getSession();
  if (!session) return Response.json({ error: "Unauthorized" }, { status: 401 });

  const state = await reconcileUserPlan(session.userId);
  return Response.json({ ok: true, plan: state.plan, quota: state.quota, endAt: state.endAt });
}
