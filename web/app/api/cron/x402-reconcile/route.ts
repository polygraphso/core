/**
 * GET /api/cron/x402-reconcile — the sweep half of deferred x402 settlement.
 *
 * Most authorizations settle the moment the paying agent polls its statusUrl
 * (pollAndReconcile settles/voids inline). This endpoint covers the agent that
 * pays and never polls: it walks the open authorizations ('authorized'/
 * 'settling') and runs the same reconciler.
 *
 * No longer on a schedule. Hosted grading is sunset, so no new authorization
 * can be created and the sweep has nothing left to reach; it stays as a manual
 * drain. Requires CRON_SECRET (Authorization: Bearer <secret>).
 */

import { pollAndReconcile } from "@/lib/paidGrading";
import { openAuthorizationRequestIds } from "@/lib/x402Fee";

export async function GET(request: Request) {
  const secret = process.env.CRON_SECRET;
  if (!secret || request.headers.get("authorization") !== `Bearer ${secret}`) {
    return Response.json({ error: "unauthorized" }, { status: 401 });
  }

  const ids = await openAuthorizationRequestIds(25);
  const outcomes: Record<string, string> = {};
  for (const id of ids) {
    try {
      const progress = await pollAndReconcile(id);
      outcomes[id] = progress.state;
    } catch (e) {
      console.error("[x402-reconcile] reconcile failed", id, e);
      outcomes[id] = "error";
    }
  }
  return Response.json({ swept: ids.length, outcomes });
}
