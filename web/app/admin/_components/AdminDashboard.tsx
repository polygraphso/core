"use client";

/**
 * Client-side wrapper around the metrics payload. Handles:
 *   - Refresh button (re-fetches /api/admin/metrics)
 *   - Rescore button (POST /api/admin/rescore, polls metrics for status)
 *   - Confirmation modal on rescore click
 *   - Disable-while-running guard
 *
 * Everything else is a plain table. No charts in v0 — see brief.
 */

import { useCallback, useEffect, useRef, useState } from "react";
import type { AdminMetrics } from "@/lib/admin-metrics";

interface Props {
  initial: AdminMetrics;
}

function fmtInt(n: number | null | undefined): string {
  if (n === null || n === undefined) return "—";
  return n.toLocaleString("en-US");
}

function fmtAgo(iso: string | null | undefined, now: number): string {
  if (!iso) return "—";
  const then = Date.parse(iso);
  if (Number.isNaN(then)) return "—";
  const diffSec = Math.max(0, Math.floor((now - then) / 1000));
  if (diffSec < 60) return `${diffSec}s ago`;
  const m = Math.floor(diffSec / 60);
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 48) return `${h}h ago`;
  const d = Math.floor(h / 24);
  return `${d}d ago`;
}

function fmtTime(iso: string | null | undefined): string {
  if (!iso) return "—";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "—";
  return d.toISOString().replace("T", " ").slice(0, 19) + " UTC";
}

export function AdminDashboard({ initial }: Props) {
  const [metrics, setMetrics] = useState<AdminMetrics>(initial);
  const [refreshing, setRefreshing] = useState(false);
  const [rescoring, setRescoring] = useState(false);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);
  const [now, setNow] = useState<number>(Date.now());

  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const refresh = useCallback(async () => {
    setRefreshing(true);
    setActionError(null);
    try {
      const res = await fetch("/api/admin/metrics", { cache: "no-store" });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const body = (await res.json()) as AdminMetrics;
      setMetrics(body);
    } catch (err) {
      setActionError(`Refresh failed: ${err instanceof Error ? err.message : String(err)}`);
    } finally {
      setRefreshing(false);
    }
  }, []);

  // Tick the "Xs ago" labels. 15s is enough resolution for an admin tool
  // and avoids re-rendering the whole table every second.
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 15000);
    return () => clearInterval(t);
  }, []);

  // Poll for run status when a rescore is in flight.
  useEffect(() => {
    const inFlight = metrics.rescore.in_progress;
    if (!inFlight) {
      if (pollRef.current) {
        clearInterval(pollRef.current);
        pollRef.current = null;
      }
      return;
    }
    if (pollRef.current) return;
    pollRef.current = setInterval(() => {
      void refresh();
    }, 4000);
    return () => {
      if (pollRef.current) {
        clearInterval(pollRef.current);
        pollRef.current = null;
      }
    };
  }, [metrics.rescore.in_progress, refresh]);

  const triggerRescore = async () => {
    setRescoring(true);
    setActionError(null);
    try {
      const res = await fetch("/api/admin/rescore", { method: "POST" });
      if (!res.ok && res.status !== 202) {
        const body = await res.text();
        throw new Error(`${res.status}: ${body.slice(0, 200)}`);
      }
      await refresh();
    } catch (err) {
      setActionError(`Rescore failed: ${err instanceof Error ? err.message : String(err)}`);
    } finally {
      setRescoring(false);
      setConfirmOpen(false);
    }
  };

  const rescoreLabel = (() => {
    const last = metrics.rescore.last;
    if (!last) return "Idle — no run on record.";
    if (last.status === "queued") return `Queued (started ${fmtAgo(last.started_at, now)}).`;
    if (last.status === "running") return `Running (started ${fmtAgo(last.started_at, now)}).`;
    if (last.status === "failed") {
      return `Failed at ${fmtTime(last.finished_at)} — ${last.error_message ?? "see logs"}.`;
    }
    return `Idle — last run completed ${fmtAgo(last.finished_at, now)}.`;
  })();

  return (
    <main className="max-w-5xl mx-auto px-6 py-10">
      <header className="flex items-baseline justify-between border-b border-[var(--color-rule)] pb-4 mb-8">
        <div>
          <h1 className="font-serif text-2xl">polygraph admin</h1>
          <p className="text-xs font-mono text-[var(--color-ink-muted)] mt-1">
            generated_at: {fmtTime(metrics.generated_at)}
          </p>
        </div>
        <div className="flex gap-2 items-center">
          <button
            onClick={refresh}
            disabled={refreshing}
            className="border border-[var(--color-rule)] px-3 py-1.5 text-sm font-mono hover:bg-[var(--color-parchment-200)] disabled:opacity-50"
          >
            {refreshing ? "refreshing…" : "refresh"}
          </button>
          <form action="/api/admin/logout" method="post">
            <button
              type="submit"
              className="border border-[var(--color-rule)] px-3 py-1.5 text-sm font-mono hover:bg-[var(--color-parchment-200)]"
            >
              sign out
            </button>
          </form>
        </div>
      </header>

      {actionError ? (
        <div className="mb-6 border border-[var(--color-oxblood)] bg-[#fff5f4] px-4 py-2 text-sm font-mono text-[var(--color-oxblood)]">
          {actionError}
        </div>
      ) : null}

      {metrics.errors.length > 0 ? (
        <details className="mb-6 border border-[var(--color-rule)] bg-[var(--color-parchment-200)] px-4 py-2 text-xs font-mono">
          <summary className="cursor-pointer">
            {metrics.errors.length} source error{metrics.errors.length === 1 ? "" : "s"}
          </summary>
          <ul className="mt-2 ml-4 list-disc">
            {metrics.errors.map((e, i) => (
              <li key={i}>{e}</li>
            ))}
          </ul>
        </details>
      ) : null}

      <Section title="Tracked servers">
        <KV k="total" v={fmtInt(metrics.servers.total)} />
        {metrics.servers.by_registry.length > 0 ? (
          <Table
            headers={["registry", "count"]}
            rows={metrics.servers.by_registry.map((r) => [r.registry, fmtInt(r.count)])}
          />
        ) : null}
        {metrics.servers.by_tier.length > 0 ? (
          <Table
            headers={["tier", "count"]}
            rows={metrics.servers.by_tier.map((r) => [r.tier ?? "(no tier)", fmtInt(r.count)])}
          />
        ) : null}
      </Section>

      <Section title="npm downloads">
        <Table
          headers={["package", "7d", "30d", "all-time"]}
          rows={metrics.npm.map((r) => [
            r.package,
            fmtInt(r.last_7d),
            fmtInt(r.last_30d),
            fmtInt(r.all_time),
          ])}
        />
      </Section>

      <Section title="Email subscriptions">
        {metrics.email_subscriptions ? (
          <>
            <KV k="total" v={fmtInt(metrics.email_subscriptions.total)} />
            <KV k="source" v={metrics.email_subscriptions.source} />
          </>
        ) : (
          <p className="text-sm font-mono text-[var(--color-ink-muted)]">
            pending — wire when subscription source is integrated.
          </p>
        )}
      </Section>

      <Section title="API calls">
        <Table
          headers={["window", "count"]}
          rows={[
            ["24h", fmtInt(metrics.api_calls.total_24h)],
            ["7d", fmtInt(metrics.api_calls.total_7d)],
            ["30d", fmtInt(metrics.api_calls.total_30d)],
          ]}
        />
      </Section>

      <Section title="API calls per route">
        {metrics.api_calls.per_route.length === 0 ? (
          <p className="text-sm font-mono text-[var(--color-ink-muted)]">
            no requests logged yet — api_logs is empty.
          </p>
        ) : (
          <Table
            headers={["route", "24h", "7d", "30d"]}
            rows={metrics.api_calls.per_route.map((r) => [
              r.route,
              fmtInt(r.count_24h),
              fmtInt(r.count_7d),
              fmtInt(r.count_30d),
            ])}
          />
        )}
      </Section>

      <Section title="Rescore">
        <p className="text-sm font-mono mb-3">{rescoreLabel}</p>
        <button
          onClick={() => setConfirmOpen(true)}
          disabled={metrics.rescore.in_progress || rescoring}
          className="bg-[var(--color-ink)] text-[var(--color-parchment)] px-3 py-1.5 text-sm font-mono hover:bg-[var(--color-oxblood)] disabled:opacity-40 disabled:cursor-not-allowed"
        >
          {metrics.rescore.in_progress ? "running…" : "rescore now"}
        </button>
      </Section>

      <footer className="mt-12 border-t border-[var(--color-rule)] pt-4 text-xs font-mono text-[var(--color-ink-muted)]">
        <p>
          Shared password — no per-person audit. Rotate via ADMIN_PASSWORD env var
          + redeploy. Upgrade to GitHub OAuth + allowlist when a third person needs
          access.
        </p>
      </footer>

      {confirmOpen ? (
        <div
          className="fixed inset-0 bg-[rgba(22,21,18,0.6)] flex items-center justify-center px-6"
          onClick={() => setConfirmOpen(false)}
        >
          <div
            className="bg-[var(--color-parchment-50)] border border-[var(--color-rule)] p-6 max-w-md w-full"
            onClick={(e) => e.stopPropagation()}
          >
            <h2 className="font-serif text-lg mb-2">Confirm rescore</h2>
            <p className="text-sm mb-4">
              This kicks off a full rescore — takes ~5–10 minutes. Continue?
            </p>
            <div className="flex gap-2 justify-end">
              <button
                onClick={() => setConfirmOpen(false)}
                disabled={rescoring}
                className="border border-[var(--color-rule)] px-3 py-1.5 text-sm font-mono"
              >
                cancel
              </button>
              <button
                onClick={triggerRescore}
                disabled={rescoring}
                className="bg-[var(--color-ink)] text-[var(--color-parchment)] px-3 py-1.5 text-sm font-mono hover:bg-[var(--color-oxblood)] disabled:opacity-40"
              >
                {rescoring ? "kicking off…" : "continue"}
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </main>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="mb-10">
      <h2 className="font-serif text-lg mb-3 border-b border-[var(--color-rule-soft)] pb-1">
        {title}
      </h2>
      <div className="space-y-2">{children}</div>
    </section>
  );
}

function KV({ k, v }: { k: string; v: string }) {
  return (
    <div className="flex gap-3 text-sm font-mono">
      <span className="text-[var(--color-ink-muted)] min-w-[120px]">{k}</span>
      <span>{v}</span>
    </div>
  );
}

function Table({ headers, rows }: { headers: string[]; rows: Array<Array<string>> }) {
  return (
    <table className="w-full text-sm font-mono border-collapse">
      <thead>
        <tr className="border-b border-[var(--color-rule)]">
          {headers.map((h) => (
            <th key={h} className="text-left py-1.5 px-2 text-xs uppercase tracking-wide text-[var(--color-ink-muted)] font-medium">
              {h}
            </th>
          ))}
        </tr>
      </thead>
      <tbody>
        {rows.map((row, i) => (
          <tr key={i} className="border-b border-[var(--color-rule-soft)]">
            {row.map((cell, j) => (
              <td key={j} className="py-1.5 px-2">
                {cell}
              </td>
            ))}
          </tr>
        ))}
      </tbody>
    </table>
  );
}
