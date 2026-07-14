"use client";

import { useMemo, useState, type ReactNode } from "react";
import Link from "next/link";
import { GRADE_HEX } from "@/lib/gradeColors";
import type { SkillIndexRow } from "@/lib/skillGrades";

// Skills resolve to A/B/D/F — no C band (mirrors lib/skillGrades).
const GRADE_ORDER = ["A", "B", "D", "F"] as const;

// The three static skill checks, with the column glyphs' source statuses.
const SKILL_CHECKS: Array<{ code: "S-01" | "S-03" | "S-04"; title: string }> = [
  { code: "S-01", title: "S-01 prompt-injection / context-poisoning" },
  { code: "S-03", title: "S-03 data-exfiltration instructions" },
  { code: "S-04", title: "S-04 dangerous bundled commands" },
];

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

/** Published skills graded by the static skill litmus, with client-side search + grade filter. */
export function SkillsTable({ rows }: { rows: SkillIndexRow[] }) {
  const [query, setQuery] = useState("");
  const [grade, setGrade] = useState<string | null>(null);

  const counts = useMemo(() => {
    const m = new Map<string, number>();
    for (const r of rows) m.set(r.grade, (m.get(r.grade) ?? 0) + 1);
    return m;
  }, [rows]);
  const presentGrades = useMemo(() => GRADE_ORDER.filter((g) => counts.has(g)), [counts]);

  const q = query.trim().toLowerCase();
  const filtered = useMemo(
    () =>
      rows.filter(
        (r) =>
          (!q || r.displayName.toLowerCase().includes(q) || r.ref.toLowerCase().includes(q)) &&
          (!grade || r.grade === grade),
      ),
    [rows, q, grade],
  );

  return (
    <div>
      {presentGrades.length > 1 ? (
        <div className="mb-3 flex flex-wrap items-center gap-1.5 font-mono text-[11px]">
          <span className="mr-1 uppercase tracking-[0.13em] text-[10px] text-ink-faint">
            Grade
          </span>
          <GradeChip active={grade === null} onClick={() => setGrade(null)}>
            All <span className="tabular text-ink-faint">{rows.length}</span>
          </GradeChip>
          {presentGrades.map((g) => (
            <GradeChip key={g} active={grade === g} onClick={() => setGrade(grade === g ? null : g)}>
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
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search skills…"
          aria-label="Search skills"
          className="w-full max-w-xs border-b hairline bg-transparent py-1.5 font-mono text-[12.5px] text-ink placeholder:text-ink-faint focus:border-oxblood focus:outline-none"
        />
        <span className="shrink-0 font-mono text-[11px] text-ink-faint tabular">
          {filtered.length} {filtered.length === 1 ? "skill" : "skills"}
          {filtered.length !== rows.length ? ` of ${rows.length}` : ""}
        </span>
      </div>

      {filtered.length === 0 ? (
        <p className="border-t hairline py-8 text-center font-mono text-[12px] text-ink-faint">
          No {grade ? `grade-${grade} ` : ""}skills
          {q ? <> match “{query.trim()}”</> : null}.
        </p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full min-w-[560px] border-collapse border-b border-ink/15 font-mono text-[13px]">
            <thead>
              <tr className="border-y border-ink/15 text-ink-faint uppercase tracking-[0.13em] text-[10.5px]">
                <th className="py-2.5 pr-5 font-normal text-left">Skill</th>
                <th className="py-2.5 pr-5 font-normal text-left w-16">Grade</th>
                <th className="py-2.5 pr-1 font-normal text-left w-40">
                  Checks
                </th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((row) => (
                <tr
                  key={row.ref}
                  className="group align-middle border-b border-rule-soft/60 transition-colors hover:bg-parchment-200/40"
                >
                  <td className="py-3.5 pr-5">
                    <Link
                      href={`/skill/${row.path}`}
                      className="break-all text-ink transition-colors group-hover:text-oxblood"
                    >
                      {row.displayName}
                    </Link>
                  </td>
                  <td className="py-3.5 pr-5">
                    <span
                      className="font-serif text-xl leading-none"
                      style={{ color: GRADE_HEX[row.grade] }}
                      aria-label={`Grade ${row.grade}`}
                    >
                      {row.grade}
                    </span>
                  </td>
                  <td className="py-3.5 pr-1">
                    <span className="flex gap-2.5" aria-label="skill checks">
                      {SKILL_CHECKS.map(({ code, title }, i) => {
                        const s = [row.s01, row.s03, row.s04][i];
                        return (
                          <span
                            key={code}
                            aria-label={`${code} ${s ?? "not run"}`}
                            title={`${title}: ${s ?? "not run"}`}
                            className="flex items-baseline gap-1"
                          >
                            <span className="text-[9px] tabular text-ink-faint">
                              {code.replace("S-", "S")}
                            </span>
                            <span
                              className="text-[15px] font-medium leading-none"
                              style={{ color: statusColor(s) }}
                            >
                              {statusGlyph(s)}
                            </span>
                          </span>
                        );
                      })}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
