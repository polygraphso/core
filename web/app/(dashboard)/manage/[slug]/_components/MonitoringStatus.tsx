"use client";

/**
 * The console's monitoring/billing line: "active until <date>" plus a cancel
 * action for managers. Wraps its own WalletIsland so the cancel button can
 * reach the wallet; renders nothing heavy until a manager opens the cancel
 * flow. Only shown when there's a real stream (comped ecosystems have none).
 */

import { WalletIsland } from "@/app/_components/wallet/WalletIsland";
import { CancelStreamButton } from "@/app/_components/wallet/CancelStreamButton";

export function MonitoringStatus({
  slug,
  streamId,
  lockup,
  endAt,
}: {
  slug: string;
  streamId: number;
  lockup: string;
  endAt: string;
}) {
  return (
    <div className="mb-8 border border-rule rounded-[4px] px-5 py-3.5 flex flex-wrap items-center justify-between gap-x-6 gap-y-2">
      <p className="font-mono text-[12px] text-ink-muted">
        Monitoring active until{" "}
        <span className="text-ink">
          {new Date(endAt).toLocaleDateString("en-US", { year: "numeric", month: "short", day: "numeric" })}
        </span>
        . Renews when you fund the next month.
      </p>
      <WalletIsland>
        <CancelStreamButton
          streamId={streamId}
          lockup={lockup}
          refreshUrl={`/api/manage/${slug}/payment/refresh`}
          label="Cancel monitoring"
          noun="monitoring"
        />
      </WalletIsland>
    </div>
  );
}
