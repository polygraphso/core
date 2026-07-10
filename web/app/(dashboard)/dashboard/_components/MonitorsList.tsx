"use client";

/**
 * The monitor register: one hairline-divided row per monitored target, in the
 * same specimen-row grammar as the ecosystem console's entries list (grade
 * stamp, mono target, quiet uppercase controls). A paused monitor dims like a
 * hidden entry. All mutations are optimistic-or-refresh, matching the console.
 */

import { useState } from "react";
import { useRouter } from "next/navigation";
import { GRADE_HEX } from "@/lib/gradeColors";

export interface MonitorEntry {
  id: string;
  target: string;
  kind: "server" | "skill";
  unsubscribe_token: string;
  unsubscribed_at: string | null;
  created_at: string;
  last_notified_grade: string | null;
  last_notified_version: string | null;
  last_notified_at: string | null;
  alert_min_grade: "C" | "D" | "F" | null;
  currentGrade: string | null;
  currentVersion: string | null;
  /** The report link: /mcp/… for a server, /skill/… for a skill. */
  reportHref: string;
}

/** Servers carry a package/commit version; a skill's "version" is a commit sha,
 *  shown short. Returns the label to render next to the grade, or null. */
function versionLabel(kind: "server" | "skill", version: string | null): string | null {
  if (!version) return null;
  return kind === "skill" ? version.slice(0, 7) : `v${version}`;
}

function Stamp({ grade }: { grade: string | null }) {
  if (!grade) {
    return (
      <span
        className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-[3px] border hairline font-mono text-[13px] text-ink-faint"
        aria-label="ungraded"
      >
        —
      </span>
    );
  }
  return (
    <span
      className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-[3px] font-mono text-[15px] font-semibold text-parchment-50 shadow-[inset_0_0_0_1px_rgba(255,255,255,0.14)]"
      style={{ backgroundColor: GRADE_HEX[grade as keyof typeof GRADE_HEX] ?? "var(--color-ink-faint)" }}
      aria-label={`grade ${grade}`}
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

  const version = versionLabel(monitor.kind, monitor.currentVersion);

  return (
    <div className={`border-t hairline py-3 ${isActive ? "" : "opacity-55"}`}>
      <div className="flex items-start gap-3">
        <Stamp grade={monitor.currentGrade} />
        <div className="min-w-0 flex-1">
          <div className="flex items-baseline gap-2 flex-wrap">
            <a
              href={monitor.reportHref}
              className="font-mono text-[13px] text-ink font-medium hover:text-oxblood transition-colors break-all"
            >
              {monitor.target}
            </a>
            <span className="font-mono text-[10px] uppercase tracking-[0.12em] text-ink-faint">
              {monitor.kind === "skill" ? "skill" : "mcp"}
              {version ? ` · ${version}` : ""}
            </span>
            {!isActive ? (
              <span className="font-mono text-[10px] uppercase tracking-[0.12em] text-ink-faint border hairline rounded-full px-2 py-0.5">
                paused
              </span>
            ) : null}
          </div>

          {monitor.last_notified_at ? (
            <p className="mt-1 font-mono text-[11px] text-ink-faint">
              last alerted{" "}
              {monitor.last_notified_grade ? (
                <span className="text-ink-muted">{monitor.last_notified_grade}</span>
              ) : null}
              {versionLabel(monitor.kind, monitor.last_notified_version) ? (
                <> · {versionLabel(monitor.kind, monitor.last_notified_version)}</>
              ) : null}{" "}
              ·{" "}
              {new Date(monitor.last_notified_at).toLocaleDateString("en-US", {
                month: "short",
                day: "numeric",
                year: "numeric",
              })}
            </p>
          ) : null}

          {/* Controls — the console's quiet uppercase row. */}
          <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1 font-mono text-[10px] uppercase tracking-[0.12em]">
            <label htmlFor={`thr-${monitor.id}`} className="text-ink-faint">
              email me on
            </label>
            <select
              id={`thr-${monitor.id}`}
              aria-label="Alert threshold"
              value={minGrade ?? ""}
              onChange={(e) =>
                saveThreshold(e.target.value === "" ? null : (e.target.value as "C" | "D" | "F"))
              }
              disabled={busy || !isActive}
              className="font-mono text-[11px] normal-case tracking-normal border border-rule rounded-[3px] bg-parchment-50 px-2 py-1 text-ink focus:outline-none focus:border-ink disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <option value="">every regrade</option>
              <option value="C">C or worse</option>
              <option value="D">D or worse</option>
              <option value="F">F only</option>
            </select>
            <a href={monitor.reportHref} className="text-ink-muted hover:text-oxblood transition-colors">
              report ↗
            </a>
            <button
              type="button"
              onClick={toggleSubscription}
              disabled={busy}
              className="ml-auto text-ink-faint hover:text-oxblood transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {busy ? "…" : isActive ? "pause" : "resume"}
            </button>
          </div>

          {error ? (
            <p role="alert" className="mt-2 font-mono text-[11px] text-oxblood">
              {error}
            </p>
          ) : null}
        </div>
      </div>
    </div>
  );
}

export function MonitorsList({
  monitors,
  quota,
}: {
  monitors: MonitorEntry[];
  // max === null means uncapped (admins).
  quota: { used: number; max: number | null };
}) {
  const [key, setKey] = useState(0);

  if (monitors.length === 0) {
    return (
      <p className="text-ink-muted text-[14px] py-4">
        No monitors yet. Add an MCP server or a skill above to get started.
      </p>
    );
  }

  const servers = monitors.filter((m) => m.kind === "server");
  const skills = monitors.filter((m) => m.kind === "skill");

  const section = (label: string, rows: MonitorEntry[]) =>
    rows.length === 0 ? null : (
      <div className="mt-6">
        <h3 className="mb-2 font-mono text-[10px] uppercase tracking-[0.18em] text-ink-faint">
          {label} · {rows.length}
        </h3>
        <div>
          {rows.map((m) => (
            <MonitorRow key={m.id} monitor={m} onAction={() => setKey((k) => k + 1)} />
          ))}
        </div>
      </div>
    );

  return (
    <div>
      <p className="font-mono text-[10px] uppercase tracking-[0.12em] text-ink-faint">
        {quota.max === null
          ? `${quota.used} monitor${quota.used !== 1 ? "s" : ""}`
          : `${quota.used} of ${quota.max} slot${quota.max !== 1 ? "s" : ""} used`}
      </p>
      <div key={key}>
        {section("MCP servers", servers)}
        {section("Skills", skills)}
      </div>
    </div>
  );
}
