/**
 * GET /api/ecosystems/[slug]/payment/quote?term=monthly|yearly — the live
 * activation quote: the ecosystem's USD-pegged price for the chosen term
 * (yearly bills 12 months as 10) converted to $POLYGRAPH at the current
 * DexScreener rate, plus the addresses the create tx needs.
 *
 * PUBLIC — the activation page is a link sent to prospective clients who may
 * have no account, and paying needs no session (the payment is wallet-based).
 * The quote is advisory: the verify route re-prices the deposit onchain, so
 * nothing here is trusted later.
 */

import { getEcosystemBySlug } from "@/lib/ecosystemData";
import { buildPaymentQuote, getPaymentGate } from "@/lib/ecosystemPayments";
import { TREASURY_ADDRESS } from "@/lib/paymentConfig";

export async function GET(request: Request, { params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const ecosystem = await getEcosystemBySlug(slug);
  if (!ecosystem) return Response.json({ error: "Unknown ecosystem" }, { status: 404 });

  const term = new URL(request.url).searchParams.get("term") ?? "monthly";
  if (term !== "monthly" && term !== "yearly") {
    return Response.json({ error: "term must be monthly or yearly" }, { status: 400 });
  }

  if (!TREASURY_ADDRESS) {
    return Response.json(
      { error: "Payments aren't configured yet (treasury address unset). Email hello@polygraph.so." },
      { status: 503 },
    );
  }

  const gate = await getPaymentGate(ecosystem);
  if (gate.status === "active") {
    return Response.json({ error: "Monitoring is already active." }, { status: 409 });
  }

  try {
    const quote = await buildPaymentQuote(ecosystem, term);
    return Response.json(quote);
  } catch (e) {
    console.error("[ecosystems/payment] quote failed:", e);
    return Response.json(
      { error: "Couldn't price $POLYGRAPH right now. Retry shortly." },
      { status: 503 },
    );
  }
}
