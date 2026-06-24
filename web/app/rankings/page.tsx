// web/app/rankings/page.tsx
import type { ReactNode } from "react";
import type { Metadata } from "next";
import Link from "next/link";
import { getSupabaseAdmin } from "@/lib/supabase";
import { GRADE_HEX, UNRATED_HEX } from "@/lib/gradeColors";
import {
  fetchTopRanked,
  fetchPublishedGradeDetailMap,
  mergeRankings,
  type RankingRow,
} from "@/lib/rankings";

export const metadata: Metadata = {
  title: "The MCP Security Index",
  description:
    "MCP servers graded for behavior with the open litmus harness, ranked by adoption. A grade is a measurement, not a guarantee — re-run it yourself.",
  alternates: { canonical: "/rankings" },
};

// Re-render at most every 10 min; a fresh score run or regrade surfaces within the window.
export const revalidate = 600;

// Upper bound on the adoption universe we pull; we then keep only graded servers.
// Comfortably covers the full scored set (~78 today).
const ADOPTION_UNIVERSE = 200;

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
 * caption on hover, focus, or tap (the trigger is focusable). `align` picks
 * which edge the caption anchors to so it doesn't overflow the table.
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

export default async function RankingsPage() {
  const db = getSupabaseAdmin();
  let rows: RankingRow[] = [];
  let lastRefreshed = "";
  if (db) {
    const [ranked, grades] = await Promise.all([
      // Pull the full scored set so every graded server is covered, then keep
      // only graded servers (below) — the index shows graded MCPs, ranked by adoption.
      fetchTopRanked(db, ADOPTION_UNIVERSE),
      fetchPublishedGradeDetailMap(db),
    ]);
    // Newest score timestamp across the ranked set — ISO strings compare lexically.
    lastRefreshed = ranked.reduce((max, r) => (r.computedAt > max ? r.computedAt : max), "");
    rows = mergeRankings(ranked, grades)
      .filter((r) => r.grade !== null)
      .map((r, i) => ({ ...r, rank: i + 1 }));
  }
  const refreshedDate = lastRefreshed ? lastRefreshed.slice(0, 10) : null;

  return (
    <main className="flex-1">
      <article className="mx-auto max-w-4xl px-6 pt-14 pb-24 md:pt-20 md:pb-32">
        <header className="mb-12">
          <p className="section-label mb-4">Index · litmus-v6 · adoption-ranked</p>
          <h1 className="font-serif text-4xl md:text-5xl text-ink tracking-tight leading-[1.05]">
            The MCP Security Index
          </h1>
          <p className="mt-5 font-serif italic text-ink-muted text-lg md:text-xl leading-snug max-w-2xl">
            MCP servers graded for behavior, ordered by adoption — what each server{" "}
            <em>does</em> when exercised the way an agent would.
          </p>
          <p className="mt-4 max-w-2xl text-ink-muted leading-relaxed text-sm">
            {rows.length > 0 ? (
              <>
                {rows.length} {rows.length === 1 ? "server" : "servers"} graded, ranked by adoption
                {refreshedDate ? <> · adoption data as of {refreshedDate}</> : null}. A grade is
                a measurement, not a guarantee; every grade links to a report you
                can re-run yourself.
              </>
            ) : (
              <>No graded servers yet. Check back shortly.</>
            )}
          </p>
        </header>

        {rows.length > 0 ? (
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
                      – not run): 01 tool-output injection · 02 egress overreach · 03
                      sensitive-data handling · 04 adversarial-input handling.
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
                {rows.map((row) => {
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
                                <span className="text-[9px] tabular text-ink-faint">
                                  {`0${i + 1}`}
                                </span>
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
        ) : null}

        {rows.length > 0 ? (
          <p className="mt-5 flex flex-wrap gap-x-5 gap-y-1 font-mono text-[11px] text-ink-faint leading-relaxed">
            <span>
              <span style={{ color: GRADE_HEX.A }}>✓</span> pass
            </span>
            <span>
              <span style={{ color: "var(--color-oxblood)" }}>✕</span> fail
            </span>
            <span>
              <span className="text-ink-faint">–</span> not run
            </span>
            <span className="text-ink-faint/80">
              C-01 tool-output injection · C-02 egress overreach · C-03 sensitive-data handling ·
              C-04 adversarial-input handling
            </span>
          </p>
        ) : null}

        <p className="mt-10 text-ink-faint text-xs leading-relaxed max-w-2xl">
          Ranked by the <span className="text-ink-muted">adoption score</span> (0–100, shown at
          right above monthly downloads) — a composite of downloads (npm / PyPI), GitHub stars,
          dependents and release velocity. It measures{" "}
          <span className="text-ink-muted">reach, not safety</span>: the litmus grade is the only
          safety verdict. Grades come from the open litmus harness; you can{" "}
          <Link href="/request" className="border-b hairline border-dotted hover:text-oxblood">
            request a grade
          </Link>{" "}
          for a server, or read the{" "}
          <Link href="/methodology" className="border-b hairline border-dotted hover:text-oxblood">
            methodology
          </Link>
          .
        </p>
      </article>
    </main>
  );
}
