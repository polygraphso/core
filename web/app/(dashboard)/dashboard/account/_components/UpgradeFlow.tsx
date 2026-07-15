"use client";

/**
 * The plan checkout: pick indie/team and a term (monthly, or yearly at 12
 * months for the price of 10) → live quote → (optionally swap into
 * $POLYGRAPH) → approve → create the Sablier stream tagged to this user →
 * server verify → quota lifts. Same rail and the same shared island as
 * ecosystem activation; only the endpoints, the shape tag, and the copy
 * differ. Renewal = the next stream when this one runs out.
 */

import { useCallback, useEffect, useState } from "react";
import dynamic from "next/dynamic";
import {
  PLAN_PRICES_USD,
  PLAN_QUOTAS,
  planShapeTag,
  POLYGRAPH_TOKEN_SYMBOL,
  YEARLY_BILLED_MONTHS,
  type BillingTerm,
  type PlanId,
  type PlanQuote,
} from "@/lib/paymentConfig";
import { WalletIsland } from "@/app/_components/wallet/WalletIsland";
import { CancelStreamButton } from "@/app/_components/wallet/CancelStreamButton";
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

export interface UpgradeFlowProps {
  userId: string;
  currentPlan: PlanId | "free";
  /** The current plan's live stream, when on a paid plan — enables cancel. */
  active?: { streamId: number; lockup: string } | null;
  /**
   * An admin-stopped stream still running onchain: the plan is gone but the
   * payer should cancel to reclaim the unstreamed remainder.
   */
  stopped?: { streamId: number; lockup: string; endAt: string } | null;
}

export function UpgradeFlow(props: UpgradeFlowProps) {
  return (
    <WalletIsland>
      <UpgradeFlowInner {...props} />
    </WalletIsland>
  );
}

function UpgradeFlowInner({ userId, currentPlan, active, stopped }: UpgradeFlowProps) {
  const [plan, setPlan] = useState<PlanId>(currentPlan === "team" ? "team" : "indie");
  const [term, setTerm] = useState<BillingTerm>("monthly");
  const [quote, setQuote] = useState<PlanQuote | null>(null);
  const [quoteError, setQuoteError] = useState<string | null>(null);

  const fetchQuote = useCallback(async () => {
    setQuoteError(null);
    try {
      const res = await fetch(`/api/account/plan/quote?plan=${plan}&term=${term}`, {
        cache: "no-store",
      });
      const body = (await res.json()) as PlanQuote & { error?: string };
      if (!res.ok) throw new Error(body.error ?? `quote failed (${res.status})`);
      setQuote(body);
    } catch (e) {
      setQuote(null);
      setQuoteError(e instanceof Error ? e.message : String(e));
    }
  }, [plan, term]);

  useEffect(() => {
    void fetchQuote();
  }, [fetchQuote]);
  useEffect(() => {
    if (!quote) return;
    const t = setTimeout(() => void fetchQuote(), Math.max(1000, quote.expiresAt - Date.now()));
    return () => clearTimeout(t);
  }, [quote, fetchQuote]);

  const verify = useCallback(
    async (txHash: string): Promise<{ ok: true } | { ok: false; message: string }> => {
      const res = await fetch("/api/account/plan/verify", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ plan, txHash }),
      });
      const body = (await res.json()) as { ok?: boolean; error?: string };
      if (!res.ok || !body.ok) return { ok: false, message: body.error ?? "verification failed" };
      // Full navigation so the server re-reads the plan for the badge + quota.
      window.location.assign("/dashboard");
      return { ok: true };
    },
    [plan],
  );

  const card = (p: PlanId) => (
    <button
      type="button"
      onClick={() => setPlan(p)}
      aria-pressed={plan === p}
      className={`flex-1 min-w-[220px] rounded-[4px] border px-5 py-4 text-left transition-colors ${
        plan === p ? "border-ink bg-parchment-50" : "border-rule hover:border-ink/40"
      }`}
    >
      <p className="font-mono text-[10px] uppercase tracking-[0.18em] text-ink-faint mb-1.5">
        {p}
        {currentPlan === p ? " · current" : ""}
      </p>
      <p className="font-serif text-2xl text-ink">
        ${PLAN_PRICES_USD[p]} <span className="text-[15px] text-ink-muted">/ month</span>
      </p>
      {term === "yearly" ? (
        <p className="mt-0.5 font-mono text-[11px] text-ink-muted">
          ${(PLAN_PRICES_USD[p] * YEARLY_BILLED_MONTHS).toLocaleString("en-US")} / year
        </p>
      ) : null}
      <p className="mt-1.5 font-mono text-[11px] text-ink-muted">
        {PLAN_QUOTAS[p]} monitors · per-target thresholds · email alerts
      </p>
    </button>
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
    <div>
      {stopped ? (
        <div className="mb-6 border border-oxblood/40 rounded-[4px] px-5 py-3.5 flex flex-wrap items-center justify-between gap-x-6 gap-y-2">
          <p className="font-mono text-[12px] text-ink-muted max-w-xl">
            polygraph stopped this subscription. Your payment stream is still running until{" "}
            <span className="text-ink">
              {new Date(stopped.endAt).toLocaleDateString("en-US", {
                year: "numeric",
                month: "short",
                day: "numeric",
              })}
            </span>
            {" "}— cancel it to reclaim the unstreamed remainder.
          </p>
          <CancelStreamButton
            streamId={stopped.streamId}
            lockup={stopped.lockup}
            refreshUrl="/api/account/plan/refresh"
            label="Cancel stream"
            noun="the stream"
          />
        </div>
      ) : null}

      {active && currentPlan !== "free" ? (
        <div className="mb-6 border border-rule rounded-[4px] px-5 py-3.5 flex flex-wrap items-center justify-between gap-x-6 gap-y-2">
          <p className="font-mono text-[12px] text-ink-muted">
            You&rsquo;re on the <span className="text-ink uppercase">{currentPlan}</span> plan.
            Paying again below extends it; canceling drops you back to free.
          </p>
          <CancelStreamButton
            streamId={active.streamId}
            lockup={active.lockup}
            refreshUrl="/api/account/plan/refresh"
            label="Cancel plan"
            noun="the plan"
          />
        </div>
      ) : null}

      <div className="mb-6 flex flex-wrap gap-3">
        {card("indie")}
        {card("team")}
      </div>

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

      <div className="mb-6">
        <SwapWidget />
      </div>

      <StreamPayStep
        quote={quote}
        shapeTag={planShapeTag(userId)}
        verify={verify}
        idleLabel={`Stream ${POLYGRAPH_TOKEN_SYMBOL} for a ${term === "yearly" ? "year" : "month"}`}
        doneLabel="Plan active, back to monitors…"
        helper={
          <>
            Two transactions: an approval, then the payment stream. We verify it onchain (token,
            recipient, amount, duration) before the quota lifts. No custody: cancel anytime above
            and the unstreamed remainder returns to this wallet; the plan falls back to free when
            the stream stops. Renew by funding the next term&rsquo;s stream here. Yearly streams
            the discounted total linearly over 12 months; cancel mid-year and the unstreamed
            remainder returns at that rate.
          </>
        }
      />

      <ManualStreamVerify verify={verify} />
    </div>
  );
}
