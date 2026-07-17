import type { Metadata } from "next";
import { getPublicRevenue, getTokenStats, getVestingStatus } from "@/lib/transparencyReads";
import { RevenuePanel, TokenPanel, VestingPanel } from "./_components/panels";
import { BuyPanel } from "./_components/BuyPanel";

// Server-rendered so the figures are indexable; ISR keeps the onchain + revenue
// reads off the request hot path. Each panel is independently fault-isolated, so
// a flaky RPC degrades one tile rather than 500-ing the page.
export const revalidate = 300;

export const metadata: Metadata = {
  title: "Transparency",
  description:
    "Where the money is: $POLYGRAPH supply and treasury, the team's onchain vesting lock, and booked revenue across every paid surface, read live from Base.",
  alternates: { canonical: "/transparency" },
};

export default async function TransparencyPage() {
  // Revenue (Supabase) and vesting (RPC) hit different backends — fetch in
  // parallel. Token stats need the team-locked figure and share the RPC, so
  // they run after vesting (the public Base RPC rate-limits parallel bursts).
  const [revenue, vesting] = await Promise.all([getPublicRevenue(), getVestingStatus()]);
  const token = await getTokenStats(vesting?.locked ?? null);

  return (
    <div className="mx-auto max-w-4xl">
      <header className="mb-10 max-w-2xl">
        <p className="section-label mb-4">Transparency</p>
        <h1 className="font-serif text-4xl md:text-5xl text-ink tracking-tight leading-[1.05]">
          Where the money is.
        </h1>
        <p className="mt-5 font-serif italic text-ink-muted text-lg md:text-xl leading-snug">
          The team&apos;s tokens are locked in a public contract, the treasury sits at an address you
          can open, and every dollar of revenue settles onchain. Here it is, read live. Not a report
          we typed up.
        </p>
      </header>

      <div className="grid gap-5">
        <TokenPanel stats={token} />
        <VestingPanel vesting={vesting} />
        <RevenuePanel revenue={revenue} />
        <BuyPanel />
      </div>
    </div>
  );
}
