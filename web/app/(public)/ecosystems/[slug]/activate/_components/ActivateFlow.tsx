"use client";

/**
 * The payment island: quote → (optionally swap into $POLYGRAPH) → approve →
 * create a one-month Sablier stream → server verify → monitoring starts.
 * Renewal = the next stream when this one runs out.
 *
 * Structure note: the LI.FI swap widget and the AppKit/wagmi pay step are
 * DELIBERATELY separate React trees. Both libraries sync connectors into
 * whatever wagmi config they find in context, and sharing one config makes
 * AppKit's connector watcher choke on LI.FI's entries (observed live:
 * "connector.getProvider is not a function" once a wallet extension announces
 * itself). So wagmi wraps only the pay step, the widget self-hosts its own
 * stack, and the quote/verify plumbing lives outside both — plain fetches.
 * Nothing signed client-side is trusted: the verify route re-reads the stream
 * onchain and re-prices the deposit.
 */

import { useCallback, useEffect, useState } from "react";
import dynamic from "next/dynamic";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { createAppKit, useAppKit } from "@reown/appkit/react";
import { WagmiProvider, useAccount, useConfig, useDisconnect } from "wagmi";
import {
  readContract,
  switchChain,
  waitForTransactionReceipt,
  writeContract,
} from "@wagmi/core";
import {
  ERC20_ABI,
  MONTH_SECONDS,
  PAYMENT_CHAIN_ID,
  paymentShapeTag,
  POLYGRAPH_TOKEN_ADDRESS,
  POLYGRAPH_TOKEN_SYMBOL,
  SABLIER_LOCKUP_ABI,
  type PaymentQuote,
} from "@/lib/paymentConfig";
import { appkitMetadata, appkitNetworks, reownProjectId, wagmiAdapter } from "./appkitConfig";

// Module level per the AppKit pattern — runs once on import, never per render.
if (reownProjectId) {
  createAppKit({
    adapters: [wagmiAdapter],
    networks: appkitNetworks,
    projectId: reownProjectId,
    metadata: appkitMetadata,
    features: { analytics: false, email: false, socials: false },
    themeMode: "light",
    themeVariables: {
      "--w3m-accent": "#7a1f2b",
      "--w3m-font-family": "'IBM Plex Sans', system-ui, sans-serif",
    },
  });
}

const SwapWidget = dynamic(() => import("./SwapWidget").then((m) => m.SwapWidget), {
  ssr: false,
  loading: () => (
    <p className="font-mono text-[12px] uppercase tracking-[0.16em] text-ink-faint">
      loading swap…
    </p>
  ),
});

const queryClient = new QueryClient();

export interface ActivateFlowProps {
  slug: string;
  /** Console URL when the visitor is a signed-in member; null for a client with no account. */
  consoleHref: string | null;
}

type VerifyState = { id: "idle" } | { id: "verifying" } | { id: "done" } | { id: "error"; message: string };

export function ActivateFlow({ slug, consoleHref }: ActivateFlowProps) {
  const [quote, setQuote] = useState<PaymentQuote | null>(null);
  const [quoteError, setQuoteError] = useState<string | null>(null);
  const [manualTxHash, setManualTxHash] = useState("");
  const [manualState, setManualState] = useState<VerifyState>({ id: "idle" });

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

  // Shared by the pay step (after its tx) and the manual recovery input. Plain
  // fetch, no wallet involvement: the tx hash is the whole input.
  const verify = useCallback(
    async (txHash: string): Promise<{ ok: true } | { ok: false; message: string }> => {
      const res = await fetch(`/api/ecosystems/${slug}/payment/verify`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ txHash }),
      });
      const body = (await res.json()) as { ok?: boolean; error?: string };
      if (!res.ok || !body.ok) return { ok: false, message: body.error ?? "verification failed" };
      // Members go straight back to the console (full navigation so the server
      // gate re-evaluates); a client with no account gets the inline success.
      if (consoleHref) window.location.assign(consoleHref);
      return { ok: true };
    },
    [slug, consoleHref],
  );

  return (
    <section id="activate" className="mb-16">
      <p className="section-label mb-4">Activate</p>

      {/* The commitment, priced live. */}
      <div className="border border-rule rounded-[4px] px-6 py-5 mb-6">
        {quote ? (
          <div className="flex flex-wrap items-baseline justify-between gap-x-6 gap-y-2">
            <div>
              <div className="font-serif text-2xl text-ink">
                ${quote.usdMonthly.toLocaleString("en-US")} / month
              </div>
              <div className="mt-1 font-mono text-[12px] text-ink-muted">
                ≈ {formatTokens(BigInt(quote.tokenAmount))} {POLYGRAPH_TOKEN_SYMBOL} at $
                {quote.tokenUsdRate.toPrecision(3)} — streamed continuously to the polygraph
                treasury over the month, cancelable anytime.
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

      {/* Step 1 — get the token. The button + LI.FI drawer live in SwapWidget
          (drawer on purpose: inline, the widget's autofocus scrolls the page —
          see that file). Own tree: no wagmi context above it, so LI.FI manages
          wallets independently of the pay step. */}
      <div className="mb-6">
        <SwapWidget />
      </div>

      {/* Step 2 — connect and stream (the only wagmi tree on the page). */}
      <WagmiProvider config={wagmiAdapter.wagmiConfig} reconnectOnMount={false}>
        <QueryClientProvider client={queryClient}>
          <PayStep slug={slug} consoleHref={consoleHref} quote={quote} verify={verify} />
        </QueryClientProvider>
      </WagmiProvider>

      {/* Recovery: a payment made here whose verify never ran (tab closed
          mid-flow, network blip). Takes the creation TRANSACTION, not a stream
          id — the server derives the stream from it and requires this
          ecosystem's tag, so someone else's stream can't be claimed here. */}
      <div className="mt-10 border-t hairline pt-5">
        <p className="font-mono text-[11px] uppercase tracking-[0.16em] text-ink-faint mb-2">
          Paid here but it didn&rsquo;t register?
        </p>
        <div className="flex flex-wrap items-center gap-3">
          <input
            value={manualTxHash}
            onChange={(e) => setManualTxHash(e.target.value)}
            placeholder="stream creation tx hash (0x…)"
            spellCheck={false}
            className="w-96 max-w-full rounded-[3px] border border-rule bg-parchment-50 px-3 py-2 font-mono text-[13px] text-ink placeholder:text-ink-faint focus:outline-none focus:border-ink"
          />
          <button
            disabled={manualState.id === "verifying" || !/^0x[0-9a-fA-F]{64}$/.test(manualTxHash.trim())}
            onClick={async () => {
              setManualState({ id: "verifying" });
              const r = await verify(manualTxHash.trim());
              setManualState(r.ok ? { id: "done" } : { id: "error", message: r.message });
            }}
            className="font-mono text-[12px] uppercase tracking-[0.14em] text-ink-muted border border-rule rounded-[3px] px-4 py-2 hover:text-oxblood hover:border-oxblood/40 transition-colors disabled:opacity-50"
          >
            {manualState.id === "verifying" ? "verifying…" : "verify it"}
          </button>
        </div>
        {manualState.id === "error" ? (
          <p className="mt-2 text-[13px] text-ink leading-relaxed max-w-xl">{manualState.message}</p>
        ) : null}
        {manualState.id === "done" && !consoleHref ? <SuccessNote /> : null}
      </div>
    </section>
  );
}

type Step =
  | { id: "idle" }
  | { id: "approving" }
  | { id: "streaming" }
  | { id: "verifying" }
  | { id: "done" }
  | { id: "error"; message: string };

function PayStep({
  slug,
  consoleHref,
  quote,
  verify,
}: ActivateFlowProps & {
  quote: PaymentQuote | null;
  verify: (txHash: string) => Promise<{ ok: true } | { ok: false; message: string }>;
}) {
  const config = useConfig();
  const { address, isConnected, chainId } = useAccount();
  const { open } = useAppKit();
  const { disconnect } = useDisconnect();
  const [step, setStep] = useState<Step>({ id: "idle" });

  const busy = step.id === "approving" || step.id === "streaming" || step.id === "verifying";

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
            // Binds the stream to THIS ecosystem; the verify route requires it
            // back from the creation event.
            shape: paymentShapeTag(slug),
          },
          { start: BigInt(0), cliff: BigInt(0) },
          0, // granularity: 0 is Sablier's sentinel for per-second streaming
          { cliff: 0, total: MONTH_SECONDS },
        ],
        value: BigInt(0),
        chainId: PAYMENT_CHAIN_ID,
      });
      await waitForTransactionReceipt(config, { hash: createHash });
      setStep({ id: "verifying" });
      const r = await verify(createHash);
      setStep(r.ok ? { id: "done" } : { id: "error", message: r.message });
    } catch (e) {
      const message = e instanceof Error ? e.message : String(e);
      setStep({ id: "error", message: shortenTxError(message) });
    }
  }, [address, chainId, config, quote, slug, verify]);

  return (
    <div>
      {!isConnected ? (
        <button
          onClick={() => void open()}
          className="inline-flex items-center gap-2 rounded-[3px] bg-ink px-6 py-3.5 font-mono text-sm tracking-wide text-parchment transition-colors hover:bg-oxblood"
        >
          Connect wallet
        </button>
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
                    : `Stream ${POLYGRAPH_TOKEN_SYMBOL} for a month`}
          </button>
          <p className="mt-3 text-[13px] leading-relaxed text-ink-faint max-w-xl">
            Two transactions: an approval, then the Sablier stream. We verify the stream onchain —
            token, recipient, amount, duration — before monitoring starts. No custody: cancel from
            any Sablier interface and the unstreamed remainder returns to this wallet. Monitoring
            runs while the stream does; renew by creating the next month&rsquo;s stream here (a
            longer stream at the same monthly rate prepays more months).
          </p>
        </div>
      )}

      {step.id === "done" && !consoleHref ? <SuccessNote /> : null}

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
    </div>
  );
}

function SuccessNote() {
  return (
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
