"use client";

/**
 * The payment island: quote → (optionally swap into $POLYGRAPH) → approve →
 * create the 12-month Sablier stream → server verify → console unlocks.
 *
 * Wallet plumbing (wagmi + react-query) is mounted here, scoped to the
 * activation route. The tx sequence runs through @wagmi/core actions rather
 * than per-step hooks so approve → create → verify reads as one async flow.
 * Nothing signed client-side is trusted: the verify route re-reads the stream
 * onchain and re-prices the deposit.
 */

import { useCallback, useEffect, useMemo, useState } from "react";
import dynamic from "next/dynamic";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { WagmiProvider, useAccount, useConfig, useConnect, useDisconnect } from "wagmi";
import {
  readContract,
  switchChain,
  waitForTransactionReceipt,
  writeContract,
} from "@wagmi/core";
import { parseEventLogs } from "viem";
import {
  ERC20_ABI,
  PAYMENT_CHAIN_ID,
  POLYGRAPH_TOKEN_ADDRESS,
  POLYGRAPH_TOKEN_SYMBOL,
  SABLIER_LOCKUP_ABI,
  TERM_MONTHS,
  TERM_SECONDS,
  type PaymentQuote,
} from "@/lib/paymentConfig";
import { wagmiConfig } from "./wagmiConfig";

const SwapWidget = dynamic(() => import("./SwapWidget").then((m) => m.SwapWidget), {
  ssr: false,
  loading: () => (
    <p className="font-mono text-[12px] text-ink-faint py-8 text-center">Loading swap…</p>
  ),
});

const queryClient = new QueryClient();

export interface ActivateFlowProps {
  slug: string;
  /** Console URL when the visitor is a signed-in member; null for a client with no account. */
  consoleHref: string | null;
}

export function ActivateFlow(props: ActivateFlowProps) {
  return (
    <WagmiProvider config={wagmiConfig}>
      <QueryClientProvider client={queryClient}>
        <ActivateFlowInner {...props} />
      </QueryClientProvider>
    </WagmiProvider>
  );
}

type Step =
  | { id: "idle" }
  | { id: "approving" }
  | { id: "streaming" }
  | { id: "verifying" }
  | { id: "done" }
  | { id: "error"; message: string };

function ActivateFlowInner({ slug, consoleHref }: ActivateFlowProps) {
  const config = useConfig();
  const { address, isConnected, chainId } = useAccount();
  const { connect, connectors, isPending: connecting } = useConnect();
  const { disconnect } = useDisconnect();

  const [quote, setQuote] = useState<PaymentQuote | null>(null);
  const [quoteError, setQuoteError] = useState<string | null>(null);
  const [step, setStep] = useState<Step>({ id: "idle" });
  const [showSwap, setShowSwap] = useState(false);
  const [manualStreamId, setManualStreamId] = useState("");

  const busy = step.id === "approving" || step.id === "streaming" || step.id === "verifying";

  const fetchQuote = useCallback(async () => {
    setQuoteError(null);
    try {
      const res = await fetch(`/api/ecosystems/${slug}/payment/quote`, { cache: "no-store" });
      const body = (await res.json()) as PaymentQuote & { error?: string };
      if (!res.ok) throw new Error(body.error ?? `quote failed (${res.status})`);
      setQuote(body);
    } catch (e) {
      setQuote(null);
      setQuoteError(e instanceof Error ? e.message : String(e));
    }
  }, [slug]);

  // Live quote: fetch on mount, silently refresh when it expires.
  useEffect(() => {
    void fetchQuote();
  }, [fetchQuote]);
  useEffect(() => {
    if (!quote) return;
    const t = setTimeout(() => void fetchQuote(), Math.max(1000, quote.expiresAt - Date.now()));
    return () => clearTimeout(t);
  }, [quote, fetchQuote]);

  const verify = useCallback(
    async (streamId: number, txHash: string | null) => {
      setStep({ id: "verifying" });
      const res = await fetch(`/api/ecosystems/${slug}/payment/verify`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ streamId, txHash }),
      });
      const body = (await res.json()) as { ok?: boolean; error?: string };
      if (!res.ok || !body.ok) {
        setStep({ id: "error", message: body.error ?? "verification failed" });
        return;
      }
      setStep({ id: "done" });
      // Members go straight back to the console (full navigation so the server
      // gate re-evaluates); a client with no account gets the inline success.
      if (consoleHref) window.location.assign(consoleHref);
    },
    [slug, consoleHref],
  );

  const pay = useCallback(async () => {
    if (!quote || !address) return;
    try {
      if (chainId !== PAYMENT_CHAIN_ID) {
        await switchChain(config, { chainId: PAYMENT_CHAIN_ID });
      }
      const amount = BigInt(quote.tokenAmount);
      const token = quote.token as `0x${string}`;
      const lockup = quote.lockup as `0x${string}`;

      const balance = (await readContract(config, {
        abi: ERC20_ABI,
        address: token,
        functionName: "balanceOf",
        args: [address],
      })) as bigint;
      if (balance < amount) {
        setStep({
          id: "error",
          message: `This wallet holds ${formatTokens(balance)} ${POLYGRAPH_TOKEN_SYMBOL}; the stream needs ${formatTokens(amount)}. Use the swap above to top up, then retry.`,
        });
        return;
      }

      const allowance = (await readContract(config, {
        abi: ERC20_ABI,
        address: token,
        functionName: "allowance",
        args: [address, lockup],
      })) as bigint;
      if (allowance < amount) {
        setStep({ id: "approving" });
        const approveHash = await writeContract(config, {
          abi: ERC20_ABI,
          address: token,
          functionName: "approve",
          args: [lockup, amount],
          chainId: PAYMENT_CHAIN_ID,
        });
        await waitForTransactionReceipt(config, { hash: approveHash });
      }

      setStep({ id: "streaming" });
      const createHash = await writeContract(config, {
        abi: SABLIER_LOCKUP_ABI,
        address: lockup,
        functionName: "createWithDurationsLL",
        args: [
          {
            sender: address,
            recipient: quote.treasury as `0x${string}`,
            depositAmount: amount,
            token,
            cancelable: true,
            transferable: false,
            shape: "",
          },
          { start: BigInt(0), cliff: BigInt(0) },
          0, // granularity: 0 is Sablier's sentinel for per-second streaming
          { cliff: 0, total: TERM_SECONDS },
        ],
        value: BigInt(0),
        chainId: PAYMENT_CHAIN_ID,
      });
      const receipt = await waitForTransactionReceipt(config, { hash: createHash });
      const created = parseEventLogs({
        abi: SABLIER_LOCKUP_ABI,
        logs: receipt.logs,
        eventName: "CreateLockupLinearStream",
      });
      const streamId = created[0]?.args.streamId;
      if (streamId === undefined) {
        setStep({
          id: "error",
          message:
            "The stream transaction landed but its id couldn't be read from the receipt. Paste the stream id below to finish.",
        });
        return;
      }
      await verify(Number(streamId), createHash);
    } catch (e) {
      const message = e instanceof Error ? e.message : String(e);
      setStep({ id: "error", message: shortenTxError(message) });
    }
  }, [address, chainId, config, quote, verify]);

  return (
    <section id="activate" className="mb-16">
      <p className="section-label mb-4">Activate</p>

      {/* The commitment, priced live. */}
      <div className="border border-rule rounded-[4px] px-6 py-5 mb-6">
        {quote ? (
          <div className="flex flex-wrap items-baseline justify-between gap-x-6 gap-y-2">
            <div>
              <div className="font-serif text-2xl text-ink">
                ${quote.usdMonthly.toLocaleString("en-US")}/mo × {TERM_MONTHS} months = $
                {quote.usdTotal.toLocaleString("en-US")}
              </div>
              <div className="mt-1 font-mono text-[12px] text-ink-muted">
                ≈ {formatTokens(BigInt(quote.tokenAmount))} {POLYGRAPH_TOKEN_SYMBOL} at $
                {quote.tokenUsdRate.toPrecision(3)} — streamed continuously to the polygraph
                treasury, cancelable anytime.
              </div>
            </div>
            <div className="font-mono text-[11px] text-ink-faint">
              rate refreshes automatically
            </div>
          </div>
        ) : quoteError ? (
          <div className="flex items-baseline justify-between gap-4">
            <p className="text-[14px] text-ink-muted">{quoteError}</p>
            <button
              onClick={() => void fetchQuote()}
              className="font-mono text-[12px] uppercase tracking-[0.14em] text-oxblood hover:underline"
            >
              retry
            </button>
          </div>
        ) : (
          <p className="font-mono text-[12px] text-ink-faint">Pricing…</p>
        )}
      </div>

      {/* Step 1 — get the token (optional, collapsed by default). */}
      <div className="mb-6">
        <button
          onClick={() => setShowSwap((s) => !s)}
          className="font-mono text-[12px] uppercase tracking-[0.16em] text-ink-muted border-b hairline border-dotted pb-0.5 hover:text-oxblood transition-colors"
        >
          {showSwap ? "− hide swap" : `+ need ${POLYGRAPH_TOKEN_SYMBOL}? swap any token`}
        </button>
        {showSwap ? (
          <div className="mt-4 max-w-md">
            <SwapWidget />
          </div>
        ) : null}
      </div>

      {/* Step 2 — connect and stream. */}
      {!isConnected ? (
        <div className="flex flex-wrap items-center gap-3">
          {connectors.map((c) => (
            <button
              key={c.uid}
              disabled={connecting}
              onClick={() => connect({ connector: c })}
              className="inline-flex items-center gap-2 rounded-[3px] bg-ink px-5 py-3 font-mono text-sm tracking-wide text-parchment transition-colors hover:bg-oxblood disabled:opacity-50"
            >
              Connect {c.name === "Injected" ? "browser wallet" : c.name}
            </button>
          ))}
        </div>
      ) : (
        <div>
          <div className="mb-4 flex flex-wrap items-center gap-x-4 gap-y-2 font-mono text-[12px] text-ink-muted">
            <span>
              {address?.slice(0, 6)}…{address?.slice(-4)} on Base
            </span>
            <button
              onClick={() => disconnect()}
              className="text-ink-faint underline decoration-dotted hover:text-oxblood"
            >
              disconnect
            </button>
          </div>
          <button
            disabled={!quote || busy}
            onClick={() => void pay()}
            className="inline-flex items-center gap-2 rounded-[3px] bg-ink px-6 py-3.5 font-mono text-sm tracking-wide text-parchment transition-colors hover:bg-oxblood disabled:opacity-50"
          >
            {step.id === "approving"
              ? "Approving…"
              : step.id === "streaming"
                ? "Creating the stream…"
                : step.id === "verifying"
                  ? "Verifying onchain…"
                  : step.id === "done"
                    ? consoleHref
                      ? "Active — opening console…"
                      : "Monitoring active"
                    : `Stream ${POLYGRAPH_TOKEN_SYMBOL} for ${TERM_MONTHS} months`}
          </button>
          <p className="mt-3 text-[13px] leading-relaxed text-ink-faint max-w-xl">
            Two transactions: an approval, then the Sablier stream. We verify the stream onchain —
            token, recipient, amount, term — before the console unlocks. No custody: cancel from
            any Sablier interface and the unstreamed remainder returns to this wallet.
          </p>
        </div>
      )}

      {step.id === "done" && !consoleHref ? (
        <div className="mt-5 border-l-2 pl-4" style={{ borderColor: "var(--color-oxblood)" }}>
          <p className="text-[15px] leading-relaxed text-ink">
            The stream checked out — monitoring is active. Email{" "}
            <a href="mailto:hello@polygraph.so" className="underline decoration-dotted hover:text-oxblood">
              hello@polygraph.so
            </a>{" "}
            with your team&rsquo;s addresses and we&rsquo;ll invite them to the management console
            (entries, alert strategy, weekly CVE digest).
          </p>
        </div>
      ) : null}

      {step.id === "error" ? (
        <div className="mt-5 border-l-2 pl-4" style={{ borderColor: "var(--color-oxblood)" }}>
          <p className="text-[14px] leading-relaxed text-ink">{step.message}</p>
          <button
            onClick={() => setStep({ id: "idle" })}
            className="mt-1 font-mono text-[12px] uppercase tracking-[0.14em] text-oxblood hover:underline"
          >
            dismiss
          </button>
        </div>
      ) : null}

      {/* Recovery: a stream that exists but was never verified (tab closed, etc.). */}
      <div className="mt-10 border-t hairline pt-5">
        <p className="font-mono text-[11px] uppercase tracking-[0.16em] text-ink-faint mb-2">
          Already created a stream?
        </p>
        <div className="flex flex-wrap items-center gap-3">
          <input
            value={manualStreamId}
            onChange={(e) => setManualStreamId(e.target.value)}
            placeholder="Sablier stream id"
            inputMode="numeric"
            className="w-44 rounded-[3px] border border-rule bg-parchment-50 px-3 py-2 font-mono text-[13px] text-ink placeholder:text-ink-faint focus:outline-none focus:border-ink"
          />
          <button
            disabled={busy || !/^\d+$/.test(manualStreamId.trim())}
            onClick={() => void verify(Number(manualStreamId.trim()), null)}
            className="font-mono text-[12px] uppercase tracking-[0.14em] text-ink-muted border border-rule rounded-[3px] px-4 py-2 hover:text-oxblood hover:border-oxblood/40 transition-colors disabled:opacity-50"
          >
            verify it
          </button>
        </div>
      </div>
    </section>
  );
}

function formatTokens(raw: bigint): string {
  const whole = raw / BigInt("1000000000000000000"); // 18 decimals
  return new Intl.NumberFormat("en-US", { maximumFractionDigits: 0 }).format(whole);
}

/** Wallet errors arrive as multi-paragraph essays; keep the first line. */
function shortenTxError(message: string): string {
  const first = message.split("\n")[0]?.trim() ?? message;
  return first.length > 240 ? `${first.slice(0, 240)}…` : first;
}
