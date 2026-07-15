/**
 * GET /api/account/plan/quote?plan=indie|team&term=monthly|yearly — the live
 * upgrade quote: the plan's USD price for the chosen term (yearly bills 12
 * months as 10) converted to $POLYGRAPH at the current rate, plus the
 * addresses the create tx needs.
 *
 * Session-required (proxy matcher + explicit check): the quote itself is
 * harmless, but the checkout binds the stream to the signed-in user via the
 * shape tag, so an anonymous quote has nothing to pay for. Advisory like the
 * ecosystem quote — the verify route re-prices the deposit onchain.
 */

import { getSession } from "@/lib/session";
import { buildPlanQuote } from "@/lib/userPlans";
import { TREASURY_ADDRESS } from "@/lib/paymentConfig";

export async function GET(request: Request) {
  const session = await getSession();
  if (!session) return Response.json({ error: "Unauthorized" }, { status: 401 });

  const searchParams = new URL(request.url).searchParams;
  const plan = searchParams.get("plan");
  if (plan !== "indie" && plan !== "team") {
    return Response.json({ error: "plan must be indie or team" }, { status: 400 });
  }
  const term = searchParams.get("term") ?? "monthly";
  if (term !== "monthly" && term !== "yearly") {
    return Response.json({ error: "term must be monthly or yearly" }, { status: 400 });
  }

  if (!TREASURY_ADDRESS) {
    return Response.json(
      { error: "Payments aren't configured yet (treasury address unset). Email hello@polygraph.so." },
      { status: 503 },
    );
  }

  try {
    const quote = await buildPlanQuote(plan, term);
    return Response.json(quote);
  } catch (e) {
    console.error("[account/plan] quote failed:", e);
    return Response.json(
      { error: "Couldn't price $POLYGRAPH right now. Retry shortly." },
      { status: 503 },
    );
  }
}
