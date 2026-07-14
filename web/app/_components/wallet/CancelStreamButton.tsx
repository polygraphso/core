"use client";

/**
 * Cancel an active payment stream from the UI. The stream's `cancel(streamId)`
 * is sender-only, so the payer connects the same wallet they paid with and
 * signs; the contract refunds the unstreamed remainder. Afterwards we POST to
 * `refreshUrl` so the server re-reads the stream status onchain and flips the
 * payment row immediately (instead of waiting out the lazy hourly re-check).
 * Must render inside WalletIsland.
 */

import { useCallback, useState } from "react";
import { useRouter } from "next/navigation";
import { useAppKit } from "@reown/appkit/react";
import { useAccount, useConfig } from "wagmi";
import { switchChain, waitForTransactionReceipt, writeContract } from "@wagmi/core";
import { PAYMENT_CHAIN_ID, SABLIER_LOCKUP_ABI } from "@/lib/paymentConfig";

type State =
  | { id: "idle" }
  | { id: "confirming" }
  | { id: "canceling" }
  | { id: "refreshing" }
  | { id: "done" }
  | { id: "error"; message: string };

export function CancelStreamButton({
  streamId,
  lockup,
  refreshUrl,
  label = "Cancel",
  noun = "the subscription",
}: {
  streamId: number;
  lockup: string;
  /** POST-ed after the cancel tx confirms to force the server to reconcile. */
  refreshUrl: string;
  label?: string;
  noun?: string;
}) {
  const config = useConfig();
  const { isConnected, chainId } = useAccount();
  const { open } = useAppKit();
  const router = useRouter();
  const [state, setState] = useState<State>({ id: "idle" });

  const cancel = useCallback(async () => {
    try {
      if (!isConnected) {
        await open();
        return;
      }
      if (chainId !== PAYMENT_CHAIN_ID) {
        await switchChain(config, { chainId: PAYMENT_CHAIN_ID });
      }
      setState({ id: "canceling" });
      const hash = await writeContract(config, {
        abi: SABLIER_LOCKUP_ABI,
        address: lockup as `0x${string}`,
        functionName: "cancel",
        args: [BigInt(streamId)],
        chainId: PAYMENT_CHAIN_ID,
      });
      await waitForTransactionReceipt(config, { hash });
      setState({ id: "refreshing" });
      await fetch(refreshUrl, { method: "POST" }).catch(() => {});
      setState({ id: "done" });
      router.refresh();
    } catch (e) {
      const raw = e instanceof Error ? e.message.split("\n")[0] : String(e);
      // The common failure: a wallet that isn't the stream sender. Say so.
      const message = /not the (sender|stream)|unauthor|caller/i.test(raw)
        ? "That wallet didn't create this stream. Connect the wallet you paid with, then cancel."
        : raw.slice(0, 200);
      setState({ id: "error", message });
    }
  }, [isConnected, chainId, config, lockup, streamId, refreshUrl, open, router]);

  const busy = state.id === "canceling" || state.id === "refreshing";

  if (state.id === "done") {
    return (
      <p className="font-mono text-[11px] text-ink-muted">
        Canceled. The unstreamed remainder returns to your wallet; {noun} stops.
      </p>
    );
  }

  return (
    <div>
      {state.id === "idle" || state.id === "error" ? (
        <button
          onClick={() => setState({ id: "confirming" })}
          className="font-mono text-[11px] uppercase tracking-[0.12em] text-ink-faint underline decoration-dotted underline-offset-2 hover:text-oxblood transition-colors"
        >
          {label}
        </button>
      ) : null}

      {state.id === "confirming" ? (
        <div className="flex flex-wrap items-center gap-3">
          <span className="font-mono text-[11px] text-ink-muted">Cancel {noun}?</span>
          <button
            onClick={() => void cancel()}
            className="font-mono text-[11px] uppercase tracking-[0.12em] text-oxblood hover:underline"
          >
            {isConnected ? "Confirm cancel" : "Connect wallet"}
          </button>
          <button
            onClick={() => setState({ id: "idle" })}
            className="font-mono text-[11px] uppercase tracking-[0.12em] text-ink-faint hover:text-ink"
          >
            Keep it
          </button>
        </div>
      ) : null}

      {busy ? (
        <span className="font-mono text-[11px] text-ink-muted">
          {state.id === "canceling" ? "Canceling onchain…" : "Updating…"}
        </span>
      ) : null}

      {state.id === "error" ? (
        <p className="mt-1.5 font-mono text-[11px] text-oxblood max-w-md leading-relaxed">
          {state.message}
        </p>
      ) : null}
    </div>
  );
}
