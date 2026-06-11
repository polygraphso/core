"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { WalletPay } from "./WalletPay";

// One component carries the whole post-submit lifecycle:
//   created  → payment instructions + tx-hash form
//   queued/running → status (polls every 10s)
//   complete → the report (grade, checks, fingerprint, disclosure)
//   failed   → failure reason + contact
//
// v1 payment UX is deliberately wallet-agnostic: send USDC on Base from
// any wallet, paste the tx hash. One-click wallet-connect comes later.

type RunStatus = "created" | "paid" | "queued" | "running" | "complete" | "failed";

interface PublicRun {
  id: string;
  target: string;
  target_kind: "registry_ref" | "remote_url";
  status: RunStatus;
  created_at: string;
  paid_at: string | null;
  payment_tx: string | null;
  grade: "A" | "B" | "D" | "F" | null;
  c01: string | null;
  c02: string | null;
  c03: string | null;
  tool_defs_fingerprint: string | null;
  methodology_version: string | null;
  rationale: string | null;
  failure_reason: string | null;
  ran_at: string | null;
  completed_at: string | null;
}

interface PaymentInfo {
  mode: "onchain" | "mock" | "disabled";
  treasury: string | null;
  price_units: string | null;
  price_display: string | null;
}

const GRADE_COLOR: Record<string, string> = {
  A: "var(--color-grade-a)",
  B: "var(--color-grade-b)",
  D: "var(--color-grade-d)",
  F: "var(--color-grade-f)",
};

const STATUS_LABEL: Record<RunStatus, string> = {
  created: "awaiting payment",
  paid: "paid",
  queued: "queued",
  running: "running litmus-v1",
  complete: "complete",
  failed: "failed",
};

const CHECK_LABELS: Array<[keyof PublicRun, string]> = [
  ["c01", "C-01 tool-output injection"],
  ["c02", "C-02 permission overreach"],
  ["c03", "C-03 sensitive-data handling"],
];

export function RunView({ runId }: { runId: string }) {
  const [run, setRun] = useState<PublicRun | null>(null);
  const [payment, setPayment] = useState<PaymentInfo | null>(null);
  const [loadError, setLoadError] = useState("");

  const load = useCallback(async () => {
    try {
      const res = await fetch(`/api/runs/${runId}`);
      const body = (await res.json()) as {
        ok: boolean;
        message?: string;
        run?: PublicRun;
        payment?: PaymentInfo | null;
      };
      if (!res.ok || !body.ok || !body.run) {
        throw new Error(body.message ?? "Couldn't load the run.");
      }
      setRun(body.run);
      setPayment(body.payment ?? null);
      setLoadError("");
    } catch (err) {
      setLoadError(
        err instanceof Error ? err.message : "Couldn't load the run.",
      );
    }
  }, [runId]);

  useEffect(() => {
    void load();
  }, [load]);

  // Poll while the run is in flight.
  useEffect(() => {
    if (!run) return;
    if (run.status === "complete" || run.status === "failed") return;
    const t = setInterval(() => void load(), 10_000);
    return () => clearInterval(t);
  }, [run, load]);

  if (loadError) {
    return (
      <p className="font-mono text-[13px] text-oxblood">{loadError}</p>
    );
  }
  if (!run) {
    return (
      <p className="font-mono text-[13px] text-ink-faint">Loading run…</p>
    );
  }

  return (
    <div>
      <header className="mb-10">
        <p className="section-label mb-4">
          Hosted run · {STATUS_LABEL[run.status]}
        </p>
        <h1 className="font-serif text-3xl md:text-4xl text-ink tracking-tight leading-[1.1] break-all">
          {run.target}
        </h1>
        <p className="mt-3 font-mono text-[11px] text-ink-faint uppercase tracking-[0.16em]">
          {run.target_kind === "remote_url"
            ? "remote server · grade ceiling B (egress unverifiable)"
            : "registry package · full sandbox"}
        </p>
      </header>

      {run.status === "created" && <PaymentStep run={run} payment={payment} onPaid={load} />}

      {(run.status === "paid" || run.status === "queued" || run.status === "running") && (
        <div className="border hairline bg-parchment-50 p-5 md:p-7">
          <p className="font-serif text-xl text-ink leading-snug">
            {run.status === "running"
              ? "The harness is running."
              : "Paid and queued."}
          </p>
          <p className="mt-2 text-ink-muted text-sm leading-relaxed">
            litmus-v1 runs take minutes once started. This page updates
            itself — and the report lives at this URL permanently, so it&rsquo;s
            safe to close and come back.
          </p>
        </div>
      )}

      {run.status === "failed" && (
        <div className="border hairline bg-parchment-50 p-5 md:p-7">
          <p className="font-serif text-xl text-ink leading-snug">
            The run failed to execute.
          </p>
          <p className="mt-2 text-ink-muted text-sm leading-relaxed">
            {run.failure_reason ?? "Harness error."} This is an execution
            failure, not a grade — we re-queue it for free. If it stays
            stuck, email{" "}
            <a className="text-ink hover:text-oxblood" href="mailto:hello@polygraph.so">
              hello@polygraph.so
            </a>{" "}
            with this URL.
          </p>
        </div>
      )}

      {run.status === "complete" && run.grade && <Report run={run} />}
    </div>
  );
}

function PaymentStep({
  run,
  payment,
  onPaid,
}: {
  run: PublicRun;
  payment: PaymentInfo | null;
  onPaid: () => void;
}) {
  const [txHash, setTxHash] = useState("");
  const [state, setState] = useState<"idle" | "submitting" | "error">("idle");
  const [message, setMessage] = useState("");
  // Guards the retry loop across re-renders and unmount.
  const cancelled = useRef(false);
  useEffect(() => {
    cancelled.current = false;
    return () => {
      cancelled.current = true;
    };
  }, []);

  const mode = payment?.mode ?? "disabled";

  // Submit a tx hash to the server, polling through the confirmation
  // window (the server demands MIN_CONFIRMATIONS; a fresh receipt has 1).
  const submitHash = useCallback(
    async (hash: string) => {
      setState("submitting");
      setMessage("");
      for (let attempt = 0; attempt < 24; attempt++) {
        if (cancelled.current) return;
        try {
          const res = await fetch(`/api/runs/${run.id}/pay`, {
            method: "POST",
            headers: { "content-type": "application/json" },
            body: JSON.stringify({ tx_hash: hash }),
          });
          const body = (await res.json()) as {
            ok: boolean;
            message?: string;
            retryable?: boolean;
          };
          if (res.ok && body.ok) {
            setState("idle");
            onPaid();
            return;
          }
          if (res.status === 402 && body.retryable) {
            setMessage(body.message ?? "Waiting for confirmations…");
            await new Promise((r) => setTimeout(r, 5_000));
            continue;
          }
          throw new Error(body.message ?? "Payment verification failed.");
        } catch (err) {
          setState("error");
          setMessage(
            err instanceof Error
              ? err.message
              : "Something went wrong. Try again.",
          );
          return;
        }
      }
      setState("error");
      setMessage(
        "Still unconfirmed after two minutes. Keep this page open and retry, or email hello@polygraph.so with your tx hash.",
      );
    },
    [run.id, onPaid],
  );

  async function submit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    await submitHash(txHash.trim());
  }

  if (mode === "disabled") {
    return (
      <div className="border hairline bg-parchment-50 p-5 md:p-7">
        <p className="font-serif text-xl text-ink leading-snug">
          Payments aren&rsquo;t open yet.
        </p>
        <p className="mt-2 text-ink-muted text-sm leading-relaxed">
          Your request is saved. We&rsquo;ll email you at the address you gave
          when checkout opens — this URL stays valid.
        </p>
      </div>
    );
  }

  return (
    <div className="border hairline bg-parchment-50">
      <div className="flex items-center justify-between px-4 py-2.5 border-b hairline font-mono text-[10.5px] uppercase tracking-[0.18em] text-ink-faint">
        <span>Payment — USDC on Base</span>
        <span>{payment?.price_display ?? ""}</span>
      </div>
      <div className="p-4 md:p-6 space-y-4">
        {mode === "onchain" &&
        payment?.treasury &&
        payment.price_units &&
        payment.price_display ? (
          <>
            <WalletPay
              treasury={payment.treasury}
              priceUnits={payment.price_units}
              priceDisplay={payment.price_display}
              busy={state === "submitting"}
              onTxConfirmed={(hash) => void submitHash(hash)}
            />

            <div className="pt-4 border-t hairline space-y-3">
              <p className="font-mono text-[11px] uppercase tracking-[0.16em] text-ink-faint">
                or — send manually from any wallet
              </p>
              <p className="font-mono text-[12px] text-ink-muted">
                Send <span className="text-ink">{payment.price_display}</span>{" "}
                (USDC, Base network) to:
              </p>
              <pre className="font-mono text-[12px] leading-6 text-ink bg-parchment border hairline px-4 py-3 whitespace-pre-wrap break-all">
                {payment.treasury}
              </pre>
              <form onSubmit={submit} className="space-y-3" noValidate>
                <label className="block">
                  <span className="font-mono text-[11px] uppercase tracking-[0.16em] text-ink-faint block mb-2">
                    then paste the transaction hash
                  </span>
                  <input
                    type="text"
                    autoComplete="off"
                    spellCheck={false}
                    placeholder="0x…"
                    value={txHash}
                    onChange={(e) => setTxHash(e.target.value)}
                    className="w-full bg-parchment border hairline px-3.5 py-2.5 font-mono text-sm text-ink placeholder:text-ink-faint focus:outline-none focus:border-ink transition-colors"
                  />
                </label>
                <button
                  type="submit"
                  disabled={state === "submitting"}
                  className="inline-flex items-center justify-center bg-ink text-parchment px-5 py-3 font-mono text-sm tracking-wide hover:bg-oxblood transition-colors disabled:opacity-60 disabled:cursor-not-allowed"
                >
                  {state === "submitting" ? "Verifying…" : "Verify payment"}
                </button>
              </form>
            </div>
          </>
        ) : (
          <form onSubmit={submit} noValidate>
            <button
              type="submit"
              disabled={state === "submitting"}
              className="inline-flex items-center justify-center bg-ink text-parchment px-5 py-3 font-mono text-sm tracking-wide hover:bg-oxblood transition-colors disabled:opacity-60"
            >
              {state === "submitting" ? "…" : "Mark paid (mock mode)"}
            </button>
          </form>
        )}
        {message && (
          <p
            role="status"
            className={`font-mono text-[12px] ${
              state === "error" ? "text-oxblood" : "text-ink-muted"
            }`}
          >
            {message}
          </p>
        )}
        <p className="font-mono text-[10.5px] text-ink-faint leading-relaxed">
          Reminder: payment buys the run, never the grade. The result
          publishes pass or fail, and the payment is disclosed on the report.
        </p>
      </div>
    </div>
  );
}

function Report({ run }: { run: PublicRun }) {
  return (
    <div className="space-y-6">
      <div className="border hairline bg-parchment-50">
        <div className="flex items-center justify-between px-4 py-2.5 border-b hairline font-mono text-[10.5px] uppercase tracking-[0.18em] text-ink-faint">
          <span>Report · {run.methodology_version ?? "litmus-v1"}</span>
          <span>{run.ran_at ? new Date(run.ran_at).toISOString().slice(0, 10) : ""}</span>
        </div>
        <div className="p-5 md:p-7 flex gap-6">
          <span
            className="font-serif text-7xl leading-none shrink-0"
            style={{ color: GRADE_COLOR[run.grade ?? "F"] }}
            aria-label={`Grade ${run.grade}`}
          >
            {run.grade}
          </span>
          <div className="min-w-0">
            <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-1.5 font-mono text-[12px] text-ink-muted">
              {CHECK_LABELS.map(([key, label]) => (
                <div key={key} className="contents">
                  <dt className="text-ink-faint">{label}</dt>
                  <dd className="text-ink break-all">{String(run[key] ?? "—")}</dd>
                </div>
              ))}
              {run.tool_defs_fingerprint && (
                <div className="contents">
                  <dt className="text-ink-faint">fingerprint</dt>
                  <dd className="text-ink break-all">
                    {run.tool_defs_fingerprint}
                  </dd>
                </div>
              )}
            </dl>
            {run.rationale && (
              <p className="mt-4 text-ink-muted text-sm leading-relaxed">
                {run.rationale}
              </p>
            )}
          </div>
        </div>
        <p className="px-5 md:px-7 pb-5 font-mono text-[10.5px] text-ink-faint leading-relaxed border-t hairline pt-3">
          Disclosure: this was a paid hosted run
          {run.payment_tx && !run.payment_tx.startsWith("mock-") ? (
            <>
              {" "}
              (tx{" "}
              <span className="text-ink-muted break-all">{run.payment_tx}</span>
              )
            </>
          ) : null}
          . Payment bought the run, not the grade — this result publishes
          regardless of outcome.
        </p>
      </div>

      <p className="font-mono text-[11px] text-ink-faint leading-relaxed">
        Re-runnable: the same target graded against the same methodology
        version reproduces these findings.{" "}
        <a
          href="/methodology"
          className="text-ink-muted border-b hairline border-dotted hover:text-oxblood transition-colors"
        >
          Read the litmus-v1 spec →
        </a>
      </p>
    </div>
  );
}
