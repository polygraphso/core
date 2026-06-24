"use client";

import { useMemo, useState, type ReactNode } from "react";
import Link from "next/link";
import { GRADE_HEX, UNRATED_HEX } from "@/lib/gradeColors";
import type { RankingRow } from "@/lib/rankings";

const PAGE_SIZE = 20;
const GRADE_ORDER = ["A", "B", "C", "D", "F"] as const;

function statusColor(status: string | null): string {
  if (status === "pass") return GRADE_HEX.A;
  if (!status || status.startsWith("skip")) return "var(--color-ink-faint)";
  return "var(--color-oxblood)";
}

function statusGlyph(status: string | null): string {
  if (status === "pass") return "✓";
  if (!status || status.startsWith("skip")) return "–";
  return "✕";
}

/**
 * CSS-only tooltip (no JS): a dotted-underlined trigger that reveals a dark
 * caption on hover, focus, or tap. `align` picks which edge it anchors to.
 */
function InfoTip({
  label,
  children,
  align = "left",
}: {
  label: string;
  children: ReactNode;
  align?: "left" | "right";
}) {
  return (
    <span className="group/tip relative inline-block">
      <span
        tabIndex={0}
        className="cursor-help border-b border-dotted border-ink-faint/60 outline-none"
      >
        {label}
      </span>
      <span
        role="tooltip"
        className={`pointer-events-none absolute top-full z-20 mt-2 hidden w-60 rounded-sm border border-ink/30 bg-ink px-3 py-2 text-left font-sans text-[11px] font-normal normal-case tracking-normal leading-snug text-parchment shadow-lg group-hover/tip:block group-focus-within/tip:block ${
          align === "right" ? "right-0" : "left-0"
        }`}
      >
        {children}
      </span>
    </span>
  );
}

/** A grade filter pill: the letter in its grade color + the count in that grade. */
function GradeChip({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={`rounded-sm border px-2.5 py-1 leading-none transition-colors ${
        active
          ? "border-oxblood text-oxblood font-medium"
          : "hairline text-ink-muted hover:border-oxblood hover:text-oxblood"
      }`}
    >
      {children}
    </button>
  );
}

/** Graded servers ranked by adoption, with client-side search + grade filter + pagination. */
export function RankingsTable({ rows }: { rows: RankingRow[] }) {
  const [query, setQuery] = useState("");
  const [grade, setGrade] = useState<string | null>(null);
  const [page, setPage] = useState(0);

  // Grade distribution across the full set — powers the filter pills and makes
  // the spread legible at a glance (an all-A list reads as a stated fact, not a
  // missing feature). Only grades that actually occur get a pill.
  const counts = useMemo(() => {
    const m = new Map<string, number>();
    for (const r of rows) if (r.grade) m.set(r.grade, (m.get(r.grade) ?? 0) + 1);
    return m;
  }, [rows]);
  const presentGrades = useMemo(() => GRADE_ORDER.filter((g) => counts.has(g)), [counts]);

  const q = query.trim().toLowerCase();
  const filtered = useMemo(
    () =>
      rows.filter(
        (r) =>
          (!q || r.serverKey.toLowerCase().includes(q)) && (!grade || r.grade === grade),
      ),
    [rows, q, grade],
  );
  const pageCount = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const current = Math.min(page, pageCount - 1);
  const pageRows = filtered.slice(current * PAGE_SIZE, current * PAGE_SIZE + PAGE_SIZE);

  return (
    <div>
      {presentGrades.length > 1 ? (
        <div className="mb-3 flex flex-wrap items-center gap-1.5 font-mono text-[11px]">
          <span className="mr-1 uppercase tracking-[0.13em] text-[10px] text-ink-faint">
            Grade
          </span>
          <GradeChip
            active={grade === null}
            onClick={() => {
              setGrade(null);
              setPage(0);
            }}
          >
            All <span className="tabular text-ink-faint">{rows.length}</span>
          </GradeChip>
          {presentGrades.map((g) => (
            <GradeChip
              key={g}
              active={grade === g}
              onClick={() => {
                setGrade(grade === g ? null : g);
                setPage(0);
              }}
            >
              <span style={{ color: GRADE_HEX[g] }}>{g}</span>{" "}
              <span className="tabular text-ink-faint">{counts.get(g)}</span>
            </GradeChip>
          ))}
        </div>
      ) : null}

      <div className="mb-4 flex items-baseline justify-between gap-4">
        <input
          type="search"
          value={query}
          onChange={(e) => {
            setQuery(e.target.value);
            setPage(0);
          }}
          placeholder="Search servers…"
          aria-label="Search servers"
          className="w-full max-w-xs border-b hairline bg-transparent py-1.5 font-mono text-[12.5px] text-ink placeholder:text-ink-faint focus:border-oxblood focus:outline-none"
        />
        <span className="shrink-0 font-mono text-[11px] text-ink-faint tabular">
          {filtered.length} {filtered.length === 1 ? "server" : "servers"}
          {filtered.length !== rows.length ? ` of ${rows.length}` : ""}
        </span>
      </div>

      {filtered.length === 0 ? (
        <p className="border-t hairline py-8 text-center font-mono text-[12px] text-ink-faint">
          No {grade ? `grade-${grade} ` : ""}servers
          {q ? <> match “{query.trim()}”</> : null}.
        </p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full border-collapse border-b border-ink/15 font-mono text-[13px]">
            <thead>
              <tr className="border-y border-ink/15 text-ink-faint uppercase tracking-[0.13em] text-[10.5px]">
                <th className="py-2.5 pl-1 pr-4 font-normal text-right w-12">#</th>
                <th className="py-2.5 pr-5 font-normal text-left">Server</th>
                <th className="py-2.5 pr-5 font-normal text-left w-16">Grade</th>
                <th className="py-2.5 pr-5 font-normal text-left w-32">
                  <InfoTip label="Checks" align="left">
                    <span className="font-semibold">Per-category checks</span> (✓ pass · ✕ fail ·
                    – not run): 01 tool-output injection · 02 egress overreach · 03 sensitive-data
                    handling · 04 adversarial-input handling.
                  </InfoTip>
                </th>
                <th className="py-2.5 pr-1 font-normal text-right w-28">
                  <InfoTip label="Adoption" align="right">
                    <span className="font-semibold">Adoption score (0–100)</span> — downloads,
                    stars, dependents and release velocity, normalized across tracked servers.
                    Reach, not safety; the grade is the verdict. The figure below is monthly
                    downloads.
                  </InfoTip>
                </th>
              </tr>
            </thead>
            <tbody>
              {pageRows.map((row) => {
                const graded = row.grade !== null;
                return (
                  <tr
                    key={row.serverKey}
                    className="group align-middle border-b border-rule-soft/60 transition-colors hover:bg-parchment-200/40"
                  >
                    <td className="py-3.5 pl-1 pr-4 text-right tabular text-ink-faint">
                      {row.rank}
                    </td>
                    <td className="py-3.5 pr-5">
                      <Link
                        href={`/mcp/${row.serverKey}`}
                        className={`break-all transition-colors group-hover:text-oxblood ${
                          graded ? "text-ink" : "text-ink-muted"
                        }`}
                      >
                        {row.serverKey}
                      </Link>
                    </td>
                    <td className="py-3.5 pr-5">
                      {graded ? (
                        <span
                          className="font-serif text-xl leading-none"
                          style={{ color: GRADE_HEX[row.grade!] }}
                          aria-label={`Grade ${row.grade}`}
                        >
                          {row.grade}
                        </span>
                      ) : (
                        <Link
                          href="/request"
                          className="text-[11px] tracking-wide transition-colors hover:text-oxblood"
                          style={{ color: UNRATED_HEX }}
                        >
                          request
                        </Link>
                      )}
                    </td>
                    <td className="py-3.5 pr-5">
                      {graded ? (
                        <span className="flex gap-2.5" aria-label="category checks">
                          {[row.c01, row.c02, row.c03, row.c04].map((s, i) => (
                            <span
                              key={i}
                              aria-label={`${["C-01", "C-02", "C-03", "C-04"][i]} ${s ?? "not run"}`}
                              title={`${
                                [
                                  "C-01 tool-output injection",
                                  "C-02 egress overreach",
                                  "C-03 sensitive-data handling",
                                  "C-04 adversarial-input handling",
                                ][i]
                              }: ${s ?? "not run"}`}
                              className="flex items-baseline gap-1"
                            >
                              <span className="text-[9px] tabular text-ink-faint">{`0${i + 1}`}</span>
                              <span
                                className="text-[15px] font-medium leading-none"
                                style={{ color: statusColor(s) }}
                              >
                                {statusGlyph(s)}
                              </span>
                            </span>
                          ))}
                        </span>
                      ) : (
                        <span className="text-ink-faint/40" aria-hidden>
                          —
                        </span>
                      )}
                    </td>
                    <td className="py-3.5 pr-1 text-right whitespace-nowrap leading-tight">
                      <span className="tabular text-ink">{Math.round(row.adoptionScore)}</span>
                      <span className="tabular text-[10px] text-ink-faint">/100</span>
                      <span className="block tabular text-[10.5px] text-ink-faint">
                        {row.adoptionSignal}
                      </span>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {pageCount > 1 ? (
        <div className="mt-6 flex items-center justify-between font-mono text-[11px]">
          <button
            type="button"
            onClick={() => setPage(current - 1)}
            disabled={current === 0}
            className="border hairline px-3 py-1.5 text-ink-muted transition-colors enabled:hover:border-oxblood enabled:hover:text-oxblood disabled:cursor-not-allowed disabled:opacity-40"
          >
            ← Prev
          </button>
          <span className="text-ink-faint tabular">
            Page {current + 1} of {pageCount}
          </span>
          <button
            type="button"
            onClick={() => setPage(current + 1)}
            disabled={current >= pageCount - 1}
            className="border hairline px-3 py-1.5 text-ink-muted transition-colors enabled:hover:border-oxblood enabled:hover:text-oxblood disabled:cursor-not-allowed disabled:opacity-40"
          >
            Next →
          </button>
        </div>
      ) : null}
    </div>
  );
}
