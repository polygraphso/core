"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export interface MonitorEntry {
  id: string;
  target: string;
  unsubscribe_token: string;
  unsubscribed_at: string | null;
  created_at: string;
  last_notified_grade: string | null;
  last_notified_version: string | null;
  last_notified_at: string | null;
  alert_min_grade: "C" | "D" | "F" | null;
  currentGrade: string | null;
  currentVersion: string | null;
  mcpPath: string;
}

function GradePill({ grade }: { grade: string | null }) {
  if (!grade) {
    return (
      <span className="inline-block font-mono text-[10px] uppercase tracking-widest text-ink-faint border hairline px-2 py-0.5">
        ungraded
      </span>
    );
  }
  const colorMap: Record<string, string> = {
    A: "#2f5132", B: "#4f6b36", C: "#a86b19", D: "#b85024", F: "#7a1f2b",
  };
  const color = colorMap[grade] ?? "#23201a";
  return (
    <span
      className="inline-block font-mono text-[11px] font-semibold px-2 py-0.5 text-parchment"
      style={{ backgroundColor: color }}
    >
      {grade}
    </span>
  );
}

function MonitorRow({ monitor, onAction }: { monitor: MonitorEntry; onAction: () => void }) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [minGrade, setMinGrade] = useState<"C" | "D" | "F" | null>(monitor.alert_min_grade);
  const router = useRouter();
  const isActive = !monitor.unsubscribed_at;

  async function saveThreshold(next: "C" | "D" | "F" | null) {
    const prev = minGrade;
    setMinGrade(next); // optimistic — the <select> is controlled by this state
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/monitor", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ monitor_id: monitor.id, min_grade: next }),
      });
      const body = (await res.json()) as { ok: boolean; message?: string };
      if (!body.ok) throw new Error(body.message ?? "Couldn't save your setting.");
      router.refresh();
    } catch (err) {
      setMinGrade(prev); // revert on failure
      setError(err instanceof Error ? err.message : "Something went wrong.");
    } finally {
      setBusy(false);
    }
  }

  async function toggleSubscription() {
    setBusy(true);
    setError(null);
    try {
      if (isActive) {
        // Unsubscribe via token
        const res = await fetch(
          `/api/monitor/unsubscribe?token=${encodeURIComponent(monitor.unsubscribe_token)}`,
          { method: "POST" },
        );
        const body = (await res.json()) as { ok: boolean; message?: string };
        if (!body.ok) throw new Error(body.message ?? "Couldn't unsubscribe.");
      } else {
        // Re-subscribe
        const res = await fetch("/api/monitor", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ server_ref: monitor.target }),
        });
        const body = (await res.json()) as { ok: boolean; message?: string; code?: string };
        if (!body.ok) throw new Error(body.message ?? "Couldn't re-subscribe.");
      }
      onAction();
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div
      className={`border hairline p-4 md:p-5 ${isActive ? "bg-parchment-50" : "bg-parchment opacity-60"}`}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <a
              href={`/mcp/${monitor.mcpPath}`}
              className="font-mono text-sm text-ink hover:text-oxblood transition-colors break-all"
            >
              {monitor.target}
            </a>
            {!isActive && (
              <span className="font-mono text-[10px] uppercase tracking-widest text-ink-faint border hairline px-1.5 py-0.5">
                paused
              </span>
            )}
          </div>
          <div className="mt-2 flex items-center gap-3 flex-wrap">
            <GradePill grade={monitor.currentGrade} />
            {monitor.currentVersion && (
              <span className="font-mono text-[11px] text-ink-faint">
                v{monitor.currentVersion}
              </span>
            )}
          </div>
          <div className="mt-3 flex items-center gap-2 flex-wrap">
            <label
              htmlFor={`thr-${monitor.id}`}
              className="font-mono text-[10px] uppercase tracking-[0.14em] text-ink-faint"
            >
              Email me on
            </label>
            <select
              id={`thr-${monitor.id}`}
              aria-label="Alert threshold"
              value={minGrade ?? ""}
              onChange={(e) =>
                saveThreshold(e.target.value === "" ? null : (e.target.value as "C" | "D" | "F"))
              }
              disabled={busy || !isActive}
              className="font-mono text-[11px] bg-parchment border hairline px-2 py-1 text-ink focus:outline-none focus:border-ink disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <option value="">every regrade</option>
              <option value="C">C or worse</option>
              <option value="D">D or worse</option>
              <option value="F">F only</option>
            </select>
          </div>
          {monitor.last_notified_at && (
            <p className="mt-2 font-mono text-[11px] text-ink-faint">
              Last alerted{" "}
              {monitor.last_notified_grade && (
                <span className="text-ink">{monitor.last_notified_grade}</span>
              )}{" "}
              {monitor.last_notified_version && (
                <>v{monitor.last_notified_version} · </>
              )}
              {new Date(monitor.last_notified_at).toLocaleDateString("en-US", {
                month: "short",
                day: "numeric",
                year: "numeric",
              })}
            </p>
          )}
          {error && (
            <p role="alert" className="mt-2 font-mono text-[11px] text-oxblood">
              {error}
            </p>
          )}
        </div>
        <button
          type="button"
          onClick={toggleSubscription}
          disabled={busy}
          className="shrink-0 font-mono text-[11px] uppercase tracking-[0.16em] text-ink-muted hover:text-oxblood transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {busy ? "…" : isActive ? "Pause" : "Resume"}
        </button>
      </div>
    </div>
  );
}

export function MonitorsList({
  monitors,
  quota,
}: {
  monitors: MonitorEntry[];
  quota: { used: number; max: number };
}) {
  const [key, setKey] = useState(0);

  if (monitors.length === 0) {
    return (
      <p className="font-mono text-[11px] text-ink-faint mt-4">
        No monitors yet. Enter a server above to get started.
      </p>
    );
  }

  return (
    <div className="grid gap-3">
      <div className="flex items-center justify-between">
        <p className="font-mono text-[11px] text-ink-faint uppercase tracking-widest">
          {quota.used} of {quota.max} slot{quota.max !== 1 ? "s" : ""} used
        </p>
      </div>
      <div key={key} className="grid gap-2">
        {monitors.map((m) => (
          <MonitorRow key={m.id} monitor={m} onAction={() => setKey((k) => k + 1)} />
        ))}
      </div>
    </div>
  );
}
