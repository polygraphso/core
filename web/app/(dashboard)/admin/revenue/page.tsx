import type { Metadata } from "next";
import { getRevenueMetrics } from "@/lib/revenueMetrics";
import { formatUsd, buyLabel, shortWallet, type RevenueEntry } from "@/lib/revenueAggregate";
import { Panel, KpiCard, MiniBars, BarList, EmptyNote, RecentList } from "../_components/ui";

export const dynamic = "force-dynamic";
export const revalidate = 0;
export const metadata: Metadata = { title: "Revenue", robots: { index: false } };

/** Where a buy links: the paying user, else the ecosystem, else nowhere. */
function buyHref(e: RevenueEntry): string | undefined {
  if (e.userId) return `/admin/users/${e.userId}`;
  if (e.surface === "ecosystem" && e.label && e.label !== "—") return `/ecosystems/${e.label}`;
  return undefined;
}

/** Who paid: the user's email if we resolved one, else the shortened wallet. */
function buyWho(e: RevenueEntry): string | undefined {
  if (e.userEmail) return e.userEmail;
  return e.payer ? shortWallet(e.payer) : undefined;
}

export default async function RevenuePage() {
  const m = await getRevenueMetrics();

  return (
    <main className="w-full px-8 py-12">
      <div className="mb-8">
        <p className="section-label mb-1">Internal</p>
        <h1 className="font-serif text-2xl text-ink">Revenue</h1>
      </div>

      {!m ? (
        <EmptyNote>No revenue data (or Supabase not configured).</EmptyNote>
      ) : (
        <>
          {/* KPIs */}
          <div className="grid grid-cols-2 md:grid-cols-3 gap-3 mb-10">
            <KpiCard label="Booked (all-time)" value={m.totalBooked} format={formatUsd} sub="cash in, incl. prepaid streams" />
            <KpiCard label="MRR" value={m.mrr} format={formatUsd} sub={`${m.activeSubs.total} active subs`} />
            <KpiCard label="Booked this month" value={m.bookedThisMonth} format={formatUsd} />
            <KpiCard
              label="Active subs"
              value={m.activeSubs.total}
              sub={`${m.activeSubs.ecosystem} eco · ${m.activeSubs.indie} indie · ${m.activeSubs.team} team`}
            />
            <KpiCard label="Priority grades sold" value={m.prioritySold} sub="one-time" />
            <KpiCard
              label="Churned streams"
              value={m.churn.count}
              sub={m.churn.lostMrr > 0 ? `${formatUsd(m.churn.lostMrr)}/mo lost` : "no churn yet"}
            />
          </div>

          <div className="grid gap-6 md:grid-cols-2">
            {/* Latest buys */}
            <Panel
              label="§1"
              title="Latest buys"
              note="Every completed purchase across all surfaces, newest first."
            >
              <RecentList
                rows={m.recentBuys.map((e) => ({
                  primary: buyLabel(e),
                  secondary: buyWho(e),
                  meta: `${formatUsd(e.usd)} · ${e.at?.slice(0, 10) ?? "—"}`,
                  href: buyHref(e),
                }))}
                empty="No buys yet."
              />
            </Panel>

            {/* Booked revenue over time */}
            <Panel
              label="§2"
              title="Booked revenue"
              note="Cash in per day (last 30d). Prepaid streams count at their full deposit on the verify date."
            >
              <MiniBars data={m.bookedPerDay} format={formatUsd} />
            </Panel>

            {/* Revenue by surface */}
            <Panel label="§3" title="By surface" note="All-time booked $ per revenue line.">
              <BarList data={m.bySurface} format={formatUsd} empty="No revenue yet." />
            </Panel>

            {/* Active subscriptions */}
            <Panel
              label="§4"
              title="Active subscriptions"
              note="Streams still active with an end date in the future."
            >
              <BarList
                data={[
                  { key: "Ecosystem", count: m.activeSubs.ecosystem },
                  { key: "Pro · Indie", count: m.activeSubs.indie },
                  { key: "Pro · Team", count: m.activeSubs.team },
                ].filter((d) => d.count > 0)}
                empty="No active subscriptions."
              />
            </Panel>

            {/* Top payers */}
            <Panel label="§5" title="Top payers" note="Booked $ by paying wallet.">
              <BarList data={m.topPayers} format={formatUsd} empty="No payers yet." />
            </Panel>

            {/* Churn */}
            <Panel
              label="§6"
              title="Churn"
              note="Streams canceled onchain or lapsed past their end date."
            >
              <RecentList
                rows={m.churn.recent.map((e) => ({
                  primary: buyLabel(e),
                  secondary: e.status,
                  meta: e.monthly ? `${formatUsd(e.monthly)}/mo` : e.at?.slice(0, 10) ?? "—",
                }))}
                empty="No churn yet."
              />
            </Panel>
          </div>
        </>
      )}
    </main>
  );
}
