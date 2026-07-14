"use client";

/**
 * The priority-grading checkout: fetch the one-time quote → (optionally swap
 * into $POLYGRAPH) → send ONE exact transfer to the treasury → server verify →
 * the request joins the 48h lane. Unlike the stream checkouts this is a single
 * ERC-20 transfer, so it uses its own pay step (no approve, no Sablier). The
 * exact amount — carrying unique dust — is what attributes the payment, so
 * nothing signed here is trusted: the verify route re-reads the tx onchain.
 */

import { useCallback, useEffect, useState } from "react";
import dynamic from "next/dynamic";
import { useAppKit } from "@reown/appkit/react";
import { useAccount, useConfig, useDisconnect } from "wagmi";
import { readContract, switchChain, waitForTransactionReceipt, writeContract } from "@wagmi/core";
import {
  ERC20_ABI,
  PAYMENT_CHAIN_ID,
  POLYGRAPH_TOKEN_SYMBOL,
  type PriorityQuote,
} from "@/lib/paymentConfig";
import { WalletIsland } from "@/app/_components/wallet/WalletIsland";
import { formatTokens } from "@/app/_components/wallet/StreamPayStep";

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

export function PriorityCheckout({ requestId }: { requestId: string }) {
  return (
    <WalletIsland>
      <PriorityCheckoutInner requestId={requestId} />
    </WalletIsland>
  );
}

type PayState =
  | { id: "idle" }
  | { id: "paying" }
  | { id: "verifying" }
  | { id: "done"; deadlineAt: string }
  | { id: "error"; message: string };

function PriorityCheckoutInner({ requestId }: { requestId: string }) {
  const config = useConfig();
  const { address, isConnected, chainId } = useAccount();
  const { open } = useAppKit();
  const { disconnect } = useDisconnect();

  const [quote, setQuote] = useState<PriorityQuote | null>(null);
  const [quoteError, setQuoteError] = useState<string | null>(null);
  const [pay, setPay] = useState<PayState>({ id: "idle" });
  const [manualTx, setManualTx] = useState("");
  const [manualState, setManualState] = useState<PayState>({ id: "idle" });

  const fetchQuote = useCallback(async () => {
    setQuoteError(null);
    try {
      const res = await fetch(`/api/grade-requests/${requestId}/priority/quote`, { cache: "no-store" });
      const body = (await res.json()) as PriorityQuote & { error?: string };
      if (!res.ok) throw new Error(body.error ?? `quote failed (${res.status})`);
      setQuote(body);
    } catch (e) {
      setQuote(null);
      setQuoteError(e instanceof Error ? e.message : String(e));
    }
  }, [requestId]);

  useEffect(() => {
    void fetchQuote();
  }, [fetchQuote]);
  useEffect(() => {
    if (!quote) return;
    const t = setTimeout(() => void fetchQuote(), Math.max(1000, quote.expiresAt - Date.now()));
    return () => clearTimeout(t);
  }, [quote, fetchQuote]);

  const verify = useCallback(
    async (txHash: string): Promise<{ ok: true; deadlineAt: string } | { ok: false; message: string }> => {
      const res = await fetch(`/api/grade-requests/${requestId}/priority/verify`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ txHash }),
      });
      const body = (await res.json()) as { ok?: boolean; error?: string; deadlineAt?: string };
      if (!res.ok || !body.ok) return { ok: false, message: body.error ?? "verification failed" };
      return { ok: true, deadlineAt: body.deadlineAt ?? "" };
    },
    [requestId],
  );

  const send = useCallback(async () => {
    if (!quote || !address) return;
    try {
      if (chainId !== PAYMENT_CHAIN_ID) {
        await switchChain(config, { chainId: PAYMENT_CHAIN_ID });
      }
      const amount = BigInt(quote.tokenAmount);
      const token = quote.token as `0x${string}`;

      const balance = (await readContract(config, {
        abi: ERC20_ABI,
        address: token,
        functionName: "balanceOf",
        args: [address],
      })) as bigint;
      if (balance < amount) {
        setPay({
          id: "error",
          message: `This wallet holds ${formatTokens(balance)} ${POLYGRAPH_TOKEN_SYMBOL}; the fee is ${formatTokens(amount)}. Use the swap above to top up, then retry.`,
        });
        return;
      }

      setPay({ id: "paying" });
      const txHash = await writeContract(config, {
        abi: ERC20_ABI,
        address: token,
        functionName: "transfer",
        args: [quote.treasury as `0x${string}`, amount],
        chainId: PAYMENT_CHAIN_ID,
      });
      await waitForTransactionReceipt(config, { hash: txHash });
      setPay({ id: "verifying" });
      const r = await verify(txHash);
      setPay(r.ok ? { id: "done", deadlineAt: r.deadlineAt } : { id: "error", message: r.message });
    } catch (e) {
      const message = e instanceof Error ? e.message.split("\n")[0] : String(e);
      setPay({ id: "error", message: message.slice(0, 240) });
    }
  }, [address, chainId, config, quote, verify]);

  if (pay.id === "done") return <DoneNote deadlineAt={pay.deadlineAt} />;
  if (manualState.id === "done") return <DoneNote deadlineAt={manualState.deadlineAt} />;

  const busy = pay.id === "paying" || pay.id === "verifying";

  return (
    <div>
      {/* Price, live. */}
      <div className="border border-rule rounded-[4px] px-6 py-5 mb-6">
        {quote ? (
          <div className="flex flex-wrap items-baseline justify-between gap-x-6 gap-y-2">
            <div>
              <div className="font-serif text-2xl text-ink">
                ${quote.usdPrice.toLocaleString("en-US")}{" "}
                <span className="text-[15px] text-ink-muted">one-time · 48h</span>
              </div>
              <div className="mt-1 font-mono text-[12px] text-ink-muted">
                pay exactly {quote.tokenAmountDisplay.toLocaleString("en-US", { maximumFractionDigits: 4 })}{" "}
                {POLYGRAPH_TOKEN_SYMBOL} at ${quote.tokenUsdRate.toPrecision(3)} — the amount is exact
                on purpose (it&rsquo;s how we match your payment).
              </div>
            </div>
            <div className="font-mono text-[11px] text-ink-faint">rate refreshes automatically</div>
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

      {/* Step 1 — top up into $POLYGRAPH if needed. */}
      <div className="mb-6">
        <SwapWidget />
      </div>

      {/* Step 2 — pay. */}
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
            onClick={() => void send()}
            className="inline-flex items-center gap-2 rounded-[3px] bg-ink px-6 py-3.5 font-mono text-sm tracking-wide text-parchment transition-colors hover:bg-oxblood disabled:opacity-50"
          >
            {pay.id === "paying"
              ? "Sending…"
              : pay.id === "verifying"
                ? "Verifying onchain…"
                : `Pay ${POLYGRAPH_TOKEN_SYMBOL} for the 48h lane`}
          </button>
          <p className="mt-3 text-[13px] leading-relaxed text-ink-faint max-w-xl">
            One transfer of the exact amount above. We verify it onchain before the request moves up.
            Priority buys turnaround, never the grade: the battery, thresholds, and publication path
            are identical to the free queue. Remote-only servers still cap at B.
          </p>
        </div>
      )}

      {pay.id === "error" ? (
        <div className="mt-5 border-l-2 pl-4" style={{ borderColor: "var(--color-oxblood)" }}>
          <p className="text-[14px] leading-relaxed text-ink">{pay.message}</p>
          <button
            onClick={() => setPay({ id: "idle" })}
            className="mt-1 font-mono text-[12px] uppercase tracking-[0.14em] text-oxblood hover:underline"
          >
            dismiss
          </button>
        </div>
      ) : null}

      {/* Recovery: a paid transfer whose verify never ran. */}
      <div className="mt-10 border-t hairline pt-5">
        <p className="font-mono text-[11px] uppercase tracking-[0.16em] text-ink-faint mb-2">
          Paid but it didn&rsquo;t register?
        </p>
        <div className="flex flex-wrap items-center gap-3">
          <input
            value={manualTx}
            onChange={(e) => setManualTx(e.target.value)}
            placeholder="transfer tx hash (0x…)"
            spellCheck={false}
            className="w-96 max-w-full rounded-[3px] border border-rule bg-parchment-50 px-3 py-2 font-mono text-[13px] text-ink placeholder:text-ink-faint focus:outline-none focus:border-ink"
          />
          <button
            disabled={manualState.id === "verifying" || !/^0x[0-9a-fA-F]{64}$/.test(manualTx.trim())}
            onClick={async () => {
              setManualState({ id: "verifying" });
              const r = await verify(manualTx.trim());
              setManualState(r.ok ? { id: "done", deadlineAt: r.deadlineAt } : { id: "error", message: r.message });
            }}
            className="font-mono text-[12px] uppercase tracking-[0.14em] text-ink-muted border border-rule rounded-[3px] px-4 py-2 hover:text-oxblood hover:border-oxblood/40 transition-colors disabled:opacity-50"
          >
            {manualState.id === "verifying" ? "verifying…" : "verify it"}
          </button>
        </div>
        {manualState.id === "error" ? (
          <p className="mt-2 text-[13px] text-ink leading-relaxed max-w-xl">{manualState.message}</p>
        ) : null}
      </div>
    </div>
  );
}

function DoneNote({ deadlineAt }: { deadlineAt: string }) {
  const when = deadlineAt
    ? new Date(deadlineAt).toLocaleString("en-US", {
        month: "short",
        day: "numeric",
        hour: "numeric",
        minute: "2-digit",
      })
    : null;
  return (
    <div className="border-l-2 pl-4" style={{ borderColor: "var(--color-oxblood)" }}>
      <p className="text-[15px] leading-relaxed text-ink">
        Payment verified — your request is on the 48-hour lane
        {when ? (
          <>
            , graded by <span className="font-mono">{when}</span>
          </>
        ) : null}
        . We&rsquo;ll email you when the grade publishes. Questions:{" "}
        <a href="mailto:hello@polygraph.so" className="underline decoration-dotted hover:text-oxblood">
          hello@polygraph.so
        </a>
        .
      </p>
    </div>
  );
}
