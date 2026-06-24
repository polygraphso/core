// web/app/rankings/page.tsx
import type { Metadata } from "next";
import Link from "next/link";
import { getSupabaseAdmin } from "@/lib/supabase";
import { GRADE_HEX } from "@/lib/gradeColors";
import {
  fetchTopRanked,
  fetchPublishedGradeDetailMap,
  mergeRankings,
  type RankingRow,
} from "@/lib/rankings";
import { RankingsTable } from "./_components/RankingsTable";

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

        {rows.length > 0 ? <RankingsTable rows={rows} /> : null}

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
