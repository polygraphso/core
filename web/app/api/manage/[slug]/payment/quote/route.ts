/**
 * GET /api/manage/[slug]/payment/quote — the live activation quote: the
 * ecosystem's USD-pegged price converted to $POLYGRAPH at the current
 * DexScreener rate, plus the addresses the create tx needs.
 *
 * Any member of the ecosystem may fetch it (requirePaid: false — this IS the
 * payment path). The quote is advisory: the verify route re-prices the deposit,
 * so nothing here is trusted later.
 */

import { guardManage } from "@/lib/manageApi";
import { buildPaymentQuote, getPaymentGate } from "@/lib/ecosystemPayments";
import { TREASURY_ADDRESS } from "@/lib/paymentConfig";

export async function GET(_request: Request, { params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const guard = await guardManage(slug, { requirePaid: false });
  if (guard instanceof Response) return guard;
  const { access } = guard;

  if (!TREASURY_ADDRESS) {
    return Response.json(
      { error: "Payments aren't configured yet (treasury address unset). Email hello@polygraph.so." },
      { status: 503 },
    );
  }

  const gate = await getPaymentGate(access.ecosystem);
  if (gate.status === "active") {
    return Response.json({ error: "Monitoring is already active." }, { status: 409 });
  }

  try {
    const quote = await buildPaymentQuote(access.ecosystem);
    return Response.json(quote);
  } catch (e) {
    console.error("[manage/payment] quote failed:", e);
    return Response.json(
      { error: "Couldn't price $POLYGRAPH right now. Retry shortly." },
      { status: 503 },
    );
  }
}
