/**
 * GET /api/grade-requests/[id]/priority/quote — the one-time $1 grading fee
 * for a queued request, converted to $POLYGRAPH at the current rate. Public:
 * the request uuid is the capability (paying someone else's request just
 * gifts them the fee), so no session is required — rate limiting is the abuse
 * gate. The amount carries unique dust so the transfer can be attributed
 * exactly; pay it as-is.
 */

import { enforceRateLimit } from "@/lib/rateLimit";
import { buildPriorityQuote } from "@/lib/priorityPayments";
import { TREASURY_ADDRESS } from "@/lib/paymentConfig";
import { hostedGradingGoneResponse, HOSTED_GRADING_DISABLED } from "@/lib/hostedGradingSunset";

export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  if (HOSTED_GRADING_DISABLED) return hostedGradingGoneResponse();

  const { id } = await params;
  if (!/^[0-9a-f-]{36}$/.test(id)) {
    return Response.json({ error: "bad request id" }, { status: 400 });
  }
  const limited = await enforceRateLimit(request, "priority-quote", {
    max: 10,
    windowSeconds: 60,
  });
  if (limited) return limited;
  if (!TREASURY_ADDRESS) {
    return Response.json(
      { error: "Payments aren't configured yet (treasury address unset). Email hello@polygraph.so." },
      { status: 503 },
    );
  }

  const result = await buildPriorityQuote(id);
  if (!result.ok) {
    // "already paid" / "already resolved" are conflicts, not server errors;
    // an unknown request is a 404.
    const status = result.reason === "unknown request" ? 404 : 409;
    return Response.json({ error: result.reason }, { status });
  }
  return Response.json(result.quote);
}
