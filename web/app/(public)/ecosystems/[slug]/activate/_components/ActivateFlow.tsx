"use client";

/**
 * The payment island: pick a term (monthly, or yearly at 12 months for the
 * price of 10) → quote → (optionally swap into $POLYGRAPH) → approve → create
 * the Sablier stream → server verify → monitoring starts. Renewal = the next
 * stream when this one runs out.
 *
 * Structure note: the LI.FI swap widget and the pay step share ONE wagmi tree
 * (the shared WalletIsland), so a wallet connected once works in both. The
 * quote/verify plumbing lives outside wallet state entirely — plain fetches.
 * Nothing signed client-side is trusted: the verify route re-reads the stream
 * onchain and re-prices the deposit. The connect/approve/stream mechanics live
 * in the shared StreamPayStep (also used by the plan upgrade flow).
 */

import { useCallback, useEffect, useState } from "react";
import dynamic from "next/dynamic";
import {
  paymentShapeTag,
  POLYGRAPH_TOKEN_SYMBOL,
  type BillingTerm,
  type PaymentQuote,
} from "@/lib/paymentConfig";
import { WalletIsland } from "@/app/_components/wallet/WalletIsland";
import {
  formatTokens,
  ManualStreamVerify,
  StreamPayStep,
} from "@/app/_components/wallet/StreamPayStep";

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

export interface ActivateFlowProps {
  slug: string;
  /** Console URL when the visitor is a signed-in member; null for a client with no account. */
  consoleHref: string | null;
}

export function ActivateFlow(props: ActivateFlowProps) {
  return (
    // ONE wagmi tree (the shared WalletIsland) around the whole flow — the
    // LI.FI widget detects it and reuses the same wallet session as the pay
    // step (external wallet management; see SwapWidget).
    <WalletIsland>
      <ActivateFlowInner {...props} />
    </WalletIsland>
  );
}

function ActivateFlowInner({ slug, consoleHref }: ActivateFlowProps) {
  const [term, setTerm] = useState<BillingTerm>("monthly");
  const [quote, setQuote] = useState<PaymentQuote | null>(null);
  const [quoteError, setQuoteError] = useState<string | null>(null);

  const fetchQuote = useCallback(async () => {
    setQuoteError(null);
    try {
      const res = await fetch(`/api/ecosystems/${slug}/payment/quote?term=${term}`, {
        cache: "no-store",
      });
      const body = (await res.json()) as PaymentQuote & { error?: string };
      if (!res.ok) throw new Error(body.error ?? `quote failed (${res.status})`);
      setQuote(body);
    } catch (e) {
      setQuote(null);
      setQuoteError(e instanceof Error ? e.message : String(e));
    }
  }, [slug, term]);

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

  const termOption = (t: BillingTerm, label: string) => (
    <button
      type="button"
      onClick={() => setTerm(t)}
      aria-pressed={term === t}
      className={`rounded-[3px] border px-3 py-1.5 font-mono text-[11px] uppercase tracking-[0.14em] transition-colors ${
        term === t ? "border-ink bg-parchment-50 text-ink" : "border-rule text-ink-muted hover:border-ink/40"
      }`}
    >
      {label}
    </button>
  );

  return (
    <section id="activate" className="mb-16">
      <p className="section-label mb-4">Activate</p>

      <div className="mb-6 flex flex-wrap items-center gap-2">
        {termOption("monthly", "monthly")}
        {termOption("yearly", "yearly · 12 months for the price of 10")}
      </div>

      {/* The commitment, priced live. */}
      <div className="border border-rule rounded-[4px] px-6 py-5 mb-6">
        {quote ? (
          <div className="flex flex-wrap items-baseline justify-between gap-x-6 gap-y-2">
            <div>
              <div className="font-serif text-2xl text-ink">
                ${quote.usdTotal.toLocaleString("en-US")} / {quote.term === "yearly" ? "year" : "month"}
              </div>
              <div className="mt-1 font-mono text-[12px] text-ink-muted">
                ≈ {formatTokens(BigInt(quote.tokenAmount))} {POLYGRAPH_TOKEN_SYMBOL} at $
                {quote.tokenUsdRate.toPrecision(3)} — streamed continuously to the polygraph
                treasury over the {quote.term === "yearly" ? "year" : "month"}, cancelable anytime
                {quote.term === "yearly" ? "; billed as 12 months for the price of 10" : ""}.
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
          see that file). Shares this flow's wagmi tree, so the wallet connected
          for the stream works in the swap too. */}
      <div className="mb-6">
        <SwapWidget />
      </div>

      {/* Step 2 — connect and stream. */}
      <StreamPayStep
        quote={quote}
        shapeTag={paymentShapeTag(slug)}
        verify={verify}
        idleLabel={`Stream ${POLYGRAPH_TOKEN_SYMBOL} for a ${term === "yearly" ? "year" : "month"}`}
        doneLabel={consoleHref ? "Active — opening console…" : "Monitoring active"}
        helper={
          <>
            Two transactions: an approval, then the payment stream. We verify it onchain (token,
            recipient, amount, duration) before monitoring starts. No custody: cancel anytime from
            the console and the unstreamed remainder returns to this wallet. Monitoring runs while
            the stream does; renew by funding the next term&rsquo;s stream here. Yearly streams the
            discounted total linearly over 12 months; cancel mid-year and the unstreamed remainder
            returns at that rate.
          </>
        }
        success={!consoleHref ? <SuccessNote /> : undefined}
      />

      <ManualStreamVerify verify={verify} success={!consoleHref ? <SuccessNote /> : undefined} />
    </section>
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
