"use client";

/**
 * Shown when polygraph stopped this ecosystem's subscription server-side but
 * the payment stream is still running onchain. Sablier's cancel is
 * sender-only, so only the wallet that created the stream can cancel it and
 * reclaim the unstreamed remainder — this notice carries that cancel button.
 * Sibling of MonitoringStatus: wraps its own WalletIsland.
 */

import { WalletIsland } from "@/app/_components/wallet/WalletIsland";
import { CancelStreamButton } from "@/app/_components/wallet/CancelStreamButton";

export function StoppedMonitoringNotice({
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
    <div className="mb-8 border border-oxblood/40 rounded-[4px] px-5 py-3.5 flex flex-wrap items-center justify-between gap-x-6 gap-y-2">
      <p className="font-mono text-[12px] text-ink-muted max-w-xl">
        polygraph stopped this subscription. The payment stream is still running until{" "}
        <span className="text-ink">
          {new Date(endAt).toLocaleDateString("en-US", { year: "numeric", month: "short", day: "numeric" })}
        </span>
        {" "}— the wallet that created it can cancel to reclaim the unstreamed remainder.
      </p>
      <WalletIsland>
        <CancelStreamButton
          streamId={streamId}
          lockup={lockup}
          refreshUrl={`/api/manage/${slug}/payment/refresh`}
          label="Cancel stream"
          noun="the stream"
        />
      </WalletIsland>
    </div>
  );
}
