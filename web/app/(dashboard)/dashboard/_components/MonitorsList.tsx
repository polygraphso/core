"use client";

/**
 * The monitor register: a dense, columned table (grade stamp · target · version ·
 * last alert · alert threshold · controls) in the same specimen grammar as the
 * ecosystem console. From `lg` up it reads as a table with a column header; below
 * that each row reflows to a stacked card. A paused monitor dims. All mutations
 * are optimistic-or-refresh.
 */

import { useState, type ReactNode } from "react";
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

// One column template, shared by the header and every row so they stay aligned.
const COLS = "lg:grid lg:grid-cols-[28px_minmax(140px,1fr)_78px_118px_132px_72px] lg:gap-x-3 lg:items-center";

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
        className="inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-[3px] border hairline font-mono text-[13px] text-ink-faint"
        aria-label="ungraded"
      >
        —
      </span>
    );
  }
  return (
    <span
      className="inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-[3px] font-mono text-[13px] font-semibold text-parchment-50 shadow-[inset_0_0_0_1px_rgba(255,255,255,0.14)]"
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
        const res = await fetch(
          `/api/monitor/unsubscribe?token=${encodeURIComponent(monitor.unsubscribe_token)}`,
          { method: "POST" },
        );
        const body = (await res.json()) as { ok: boolean; message?: string };
        if (!body.ok) throw new Error(body.message ?? "Couldn't unsubscribe.");
      } else {
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
  const lastAlertDate = monitor.last_notified_at
    ? new Date(monitor.last_notified_at).toLocaleDateString("en-US", { month: "short", day: "numeric" })
    : null;

  return (
    <div
      className={`border-t hairline py-3 lg:py-2.5 flex flex-wrap items-center gap-x-3 gap-y-2 ${COLS} lg:gap-y-0 ${
        isActive ? "" : "opacity-55"
      }`}
    >
      <Stamp grade={monitor.currentGrade} />

      <div className="min-w-0 basis-[calc(100%-2.5rem)] lg:basis-auto">
        <a
          href={monitor.reportHref}
          className="block truncate font-mono text-[12px] font-medium text-ink hover:text-oxblood transition-colors"
          title={monitor.target}
        >
          {monitor.target}
        </a>
        {!isActive ? (
          <span className="lg:hidden mt-0.5 inline-block font-mono text-[9px] uppercase tracking-[0.12em] text-ink-faint border hairline rounded-full px-1.5 py-0.5">
            paused
          </span>
        ) : null}
      </div>

      <span className="font-mono text-[11px] text-ink-muted tabular">
        {version ?? <span className="text-ink-faint">—</span>}
      </span>

      <span className="font-mono text-[10px] text-ink-faint">
        {lastAlertDate ? (
          <>
            {lastAlertDate}
            {monitor.last_notified_grade ? (
              <>
                {" · "}
                <span className="text-ink-muted">{monitor.last_notified_grade}</span>
              </>
            ) : null}
          </>
        ) : (
          "—"
        )}
      </span>

      <select
        aria-label="Alert threshold"
        value={minGrade ?? ""}
        onChange={(e) =>
          saveThreshold(e.target.value === "" ? null : (e.target.value as "C" | "D" | "F"))
        }
        disabled={busy || !isActive}
        className="w-auto lg:w-full font-mono text-[11px] border border-rule rounded-[3px] bg-parchment-50 px-2 py-1 text-ink focus:outline-none focus:border-ink disabled:opacity-50 disabled:cursor-not-allowed"
      >
        <option value="">every regrade</option>
        <option value="C">C or worse</option>
        <option value="D">D or worse</option>
        <option value="F">F only</option>
      </select>

      <div className="ml-auto lg:ml-0 flex items-center gap-3 lg:flex-col lg:items-end lg:gap-1 font-mono text-[9px] uppercase tracking-[0.1em]">
        <a href={monitor.reportHref} className="text-ink-muted hover:text-oxblood transition-colors">
          report ↗
        </a>
        <button
          type="button"
          onClick={toggleSubscription}
          disabled={busy}
          className="text-ink-faint hover:text-oxblood transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {busy ? "…" : isActive ? "pause" : "resume"}
        </button>
      </div>

      {error ? (
        <p role="alert" className="basis-full lg:col-span-6 font-mono text-[11px] text-oxblood">
          {error}
        </p>
      ) : null}
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

  const servers = monitors.filter((m) => m.kind === "server");
  const skills = monitors.filter((m) => m.kind === "skill");

  const quotaLabel =
    quota.max === null
      ? `${quota.used} active · uncapped`
      : `${quota.used} of ${quota.max} slot${quota.max !== 1 ? "s" : ""} used`;

  const section = (label: string, rows: MonitorEntry[]) =>
    rows.length === 0 ? null : (
      <>
        <p className="pt-3.5 pb-1 font-mono text-[10px] uppercase tracking-[0.18em] text-ink-faint">
          {label} · {rows.length}
        </p>
        {rows.map((m) => (
          <MonitorRow key={m.id} monitor={m} onAction={() => setKey((k) => k + 1)} />
        ))}
      </>
    );

  return (
    <section className="min-w-0">
      <div className="mb-0.5 flex items-baseline justify-between gap-4">
        <p className="font-mono text-[10px] uppercase tracking-[0.18em] text-ink-faint">Your monitors</p>
        <span className="font-mono text-[10px] uppercase tracking-[0.12em] text-ink-faint tabular">
          {quotaLabel}
        </span>
      </div>

      {monitors.length === 0 ? (
        <p className="border-t hairline py-6 text-ink-muted text-[14px]">
          No monitors yet. Add an MCP server or a skill to get started.
        </p>
      ) : (
        <>
          {/* Column header — table from lg up; below that rows reflow to cards. */}
          <div className={`hidden ${COLS} border-b hairline pb-2 pt-1`}>
            <span />
            <HeadCell>Target</HeadCell>
            <HeadCell>Version</HeadCell>
            <HeadCell>Last alert</HeadCell>
            <HeadCell>Email me on</HeadCell>
            <span />
          </div>
          <div key={key}>
            {section("MCP servers", servers)}
            {section("Skills", skills)}
          </div>
        </>
      )}
    </section>
  );
}

function HeadCell({ children }: { children: ReactNode }) {
  return (
    <span className="font-mono text-[9px] uppercase tracking-[0.14em] text-ink-faint">{children}</span>
  );
}
