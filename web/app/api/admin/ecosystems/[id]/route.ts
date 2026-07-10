/**
 * PATCH /api/admin/ecosystems/[id] — set an ecosystem's monitoring price.
 *
 * Body: { monthly_price_usd: number | null }  — null reverts to the app default,
 * 0 comps the ecosystem (no payment required), anything else is USD/month.
 *
 * App-admin only (proxy gates /api/admin/*; the session check is depth).
 * Pricing is polygraph-set, never self-serve — this is where early deals and
 * comps for existing ecosystems are recorded.
 */

import { getSession } from "@/lib/session";
import { getSupabaseAdmin } from "@/lib/supabase";

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const session = await getSession();
  if (!session?.isAdmin) return Response.json({ error: "Forbidden" }, { status: 403 });

  let body: { monthly_price_usd?: unknown };
  try {
    body = (await request.json()) as typeof body;
  } catch {
    return Response.json({ error: "Invalid JSON" }, { status: 400 });
  }

  let price: number | null;
  if (body.monthly_price_usd === null) {
    price = null;
  } else if (
    typeof body.monthly_price_usd === "number" &&
    Number.isFinite(body.monthly_price_usd) &&
    body.monthly_price_usd >= 0 &&
    body.monthly_price_usd <= 100_000
  ) {
    price = body.monthly_price_usd;
  } else {
    return Response.json(
      { error: "monthly_price_usd must be null or a number between 0 and 100000." },
      { status: 400 },
    );
  }

  const db = getSupabaseAdmin();
  if (!db) return Response.json({ error: "Database not configured" }, { status: 503 });

  const { error } = await db.from("ecosystems").update({ monthly_price_usd: price }).eq("id", id);
  if (error) {
    console.error("[admin/ecosystems] price update failed:", error.message);
    return Response.json({ error: "Couldn't update the price." }, { status: 500 });
  }
  return Response.json({ ok: true, monthly_price_usd: price });
}
