"use client";

/**
 * The buy CTA: the shared LI.FI SwapWidget (already pinned to $POLYGRAPH-on-Base)
 * wrapped in the wallet island, dynamically imported so no wallet JS loads until
 * this page renders. The evidence above is the pitch; this is the button.
 */

import dynamic from "next/dynamic";
import { WalletIsland } from "@/app/_components/wallet/WalletIsland";

const SwapWidget = dynamic(
  () => import("@/app/_components/wallet/SwapWidget").then((m) => m.SwapWidget),
  {
    ssr: false,
    loading: () => (
      <p className="font-mono text-[12px] uppercase tracking-[0.16em] text-ink-faint">
        loading swap…
      </p>
    ),
  },
);

export function BuyPanel() {
  return (
    <section className="rounded-[4px] border hairline bg-parchment-50 p-6">
      <div className="grid items-center gap-6 md:grid-cols-[1fr_auto]">
        <div>
          <p className="section-label mb-1">§4 · Acquire</p>
          <h2 className="font-serif text-xl text-ink leading-tight">Buy $POLYGRAPH</h2>
          <p className="mt-1.5 max-w-xl text-[13px] text-ink-muted leading-relaxed">
            The team is locked, the treasury is onchain, and the revenue is real and reproducible.
            Pay in whatever you hold on any major chain, and it routes to $POLYGRAPH on Base without
            leaving the page.
          </p>
          <p className="mt-3 font-mono text-[10.5px] text-ink-faint leading-relaxed">
            The token funds the work; it never moves a grade. Not investment advice.
          </p>
        </div>
        <div className="md:pl-8">
          <WalletIsland>
            <SwapWidget variant="button" label="Buy $POLYGRAPH" />
          </WalletIsland>
        </div>
      </div>
    </section>
  );
}
