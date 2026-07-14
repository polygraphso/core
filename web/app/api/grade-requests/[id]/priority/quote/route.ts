/**
 * GET /api/grade-requests/[id]/priority/quote — the one-time price to move a
 * queued request onto the 48h lane, converted to $POLYGRAPH at the current
 * rate. The /api/grade-requests funnel is public, so this route enforces
 * session + ownership itself (you can only quote your own request). The amount
 * carries unique dust so the transfer can be attributed exactly; pay it as-is.
 */

import { getSession } from "@/lib/session";
import { buildPriorityQuote, requestBelongsTo } from "@/lib/priorityPayments";
import { TREASURY_ADDRESS } from "@/lib/paymentConfig";

export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!/^[0-9a-f-]{36}$/.test(id)) {
    return Response.json({ error: "bad request id" }, { status: 400 });
  }
  const session = await getSession();
  if (!session) return Response.json({ error: "Unauthorized" }, { status: 401 });
  if (!(await requestBelongsTo(id, session.email))) {
    return Response.json({ error: "Not your request" }, { status: 403 });
  }
  if (!TREASURY_ADDRESS) {
    return Response.json(
      { error: "Payments aren't configured yet (treasury address unset). Email hello@polygraph.so." },
      { status: 503 },
    );
  }

  const result = await buildPriorityQuote(id);
  if (!result.ok) {
    // "already on the priority lane" / "already resolved" are conflicts, not
    // server errors; an unknown request is a 404.
    const status = result.reason === "unknown request" ? 404 : 409;
    return Response.json({ error: result.reason }, { status });
  }
  return Response.json(result.quote);
}
