/**
 * GET /api/cron/x402-reconcile — the sweep half of deferred x402 settlement.
 *
 * Most authorizations settle the moment the paying agent polls its statusUrl
 * (pollAndReconcile settles/voids inline). This cron covers the agent that
 * pays and never polls: every 10 minutes it walks the open authorizations
 * ('authorized'/'settling') and runs the same reconciler, so a finished run
 * settles (or a failed one voids) well inside the authorization window.
 *
 * Vercel cron auth: requires CRON_SECRET (Authorization: Bearer <secret>).
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
