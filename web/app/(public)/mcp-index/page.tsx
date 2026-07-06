// web/app/(public)/mcp-index/page.tsx
import type { Metadata } from "next";
import { getSupabaseAdmin } from "@/lib/supabase";
import {
  fetchTopRanked,
  fetchPublishedGradeDetailMap,
  fetchPublishedRemoteGrades,
  mergeRankings,
  type RankingRow,
} from "@/lib/rankings";
import { fetchPublishedSkillGrades, type SkillIndexRow } from "@/lib/skillGrades";
import { GradesIndex } from "./_components/GradesIndex";

export const metadata: Metadata = {
  // Keep the established brand/SEO title even though the page now also indexes
  // skills — "MCP Security Index" is the flagship surface; skills are a tab.
  title: "The MCP Security Index",
  description:
    "MCP servers and Agent Skills graded with the open litmus harness — servers for behavior (ranked by adoption), skills for static safety. A grade is a measurement, not a guarantee; re-run it yourself.",
  alternates: { canonical: "/mcp-index" },
};

// Re-render at most every 10 min; a fresh score run or regrade surfaces within the window.
export const revalidate = 600;

// Upper bound on the adoption universe we pull. We pull the whole scored set and
// then keep only the servers that carry a published grade (see below), so this
// just needs to comfortably cover the full tracked set (which now exceeds 200 as
// we widen coverage — keep this well above it so no graded server is hidden).
const ADOPTION_UNIVERSE = 1000;

export default async function RankingsPage() {
  const db = getSupabaseAdmin();
  let rows: RankingRow[] = [];
  let skillRows: SkillIndexRow[] = [];
  let lastRefreshed = "";
  if (db) {
    const [ranked, grades, remote, skills] = await Promise.all([
      // Pull the full scored set — the index shows every adoption-ranked server,
      // graded or not (ungraded rows become a "request a grade" CTA in place).
      fetchTopRanked(db, ADOPTION_UNIVERSE),
      fetchPublishedGradeDetailMap(db),
      fetchPublishedRemoteGrades(db),
      fetchPublishedSkillGrades(db),
    ]);
    skillRows = skills;
    // Newest score timestamp across the ranked set — ISO strings compare lexically.
    lastRefreshed = ranked.reduce((max, r) => (r.computedAt > max ? r.computedAt : max), "");
    // Show only servers that carry a published grade. Most of the adoption
    // universe can't be graded from a public reference — servers that need an
    // API key or a local runtime just to boot (slack, postgres, figma, …) would
    // otherwise fill the table with dead "request" rows. The top-of-page
    // "Request a grade" CTA still covers anything ungraded. Ordered by adoption —
    // filter, don't re-sort — then renumber the survivors 1..N so the rank column
    // reads cleanly.
    const registryRows = mergeRankings(ranked, grades)
      .filter((r) => r.grade !== null)
      .map((r, i) => ({ ...r, rank: i + 1 }));
    // Remote/hosted endpoints carry no adoption rank — append them after the
    // adoption-ranked registry servers (the table shows "—" for their rank + adoption).
    const remoteRows = remote.map((r, i) => ({ ...r, rank: registryRows.length + i + 1 }));
    rows = [...registryRows, ...remoteRows];
  }
  const refreshedDate = lastRefreshed ? lastRefreshed.slice(0, 10) : null;
  const liveCount = rows.filter((r) => r.remote).length;
  const gradedCount = rows.filter((r) => !r.remote && r.grade !== null).length;
  const ungradedCount = rows.filter((r) => !r.remote && r.grade === null).length;
  const registryCount = gradedCount + ungradedCount;
  const skillCount = skillRows.length;
  const empty = rows.length === 0 && skillCount === 0;

  return (
      <article>
        <header className="mb-12">
          <p className="section-label mb-4">Index · litmus-v14</p>
          <h1 className="font-serif text-4xl md:text-5xl text-ink tracking-tight leading-[1.05]">
            The Polygraph Index
          </h1>
          <p className="mt-5 font-serif italic text-ink-muted text-lg md:text-xl leading-snug max-w-2xl">
            Every grade we publish — MCP servers tested for behavior and ordered by adoption, Agent
            Skills scanned for safety. What each one <em>does</em>, not what its README claims.
          </p>
          <p className="mt-4 max-w-2xl text-ink-muted leading-relaxed text-sm">
            {empty ? (
              <>No grades published yet. Check back shortly.</>
            ) : (
              <>
                {registryCount > 0 ? (
                  ungradedCount > 0 ? (
                    <>
                      {gradedCount} of {registryCount} adoption-ranked MCP servers carry a published
                      grade. The rest aren&rsquo;t graded from a public reference yet — some need
                      authenticated access, others are still queued; request one and we&rsquo;ll run
                      it
                    </>
                  ) : (
                    <>
                      {registryCount} MCP {registryCount === 1 ? "server" : "servers"} graded, ranked
                      by adoption
                    </>
                  )
                ) : null}
                {liveCount > 0 ? (
                  <>
                    {" "}
                    · {liveCount} live {liveCount === 1 ? "endpoint" : "endpoints"} (hosted, egress
                    unverified)
                  </>
                ) : null}
                {skillCount > 0 ? (
                  <>
                    {" "}
                    · {skillCount} {skillCount === 1 ? "skill" : "skills"} scanned
                  </>
                ) : null}
                {refreshedDate ? <> · adoption data as of {refreshedDate}</> : null}. A grade is a
                measurement, not a guarantee; you can re-run the open harness yourself.
              </>
            )}
          </p>
          <div className="mt-8 flex flex-wrap items-center gap-4">
            <a
              href="/request"
              className="inline-flex items-center gap-2 bg-ink text-parchment px-5 py-3 font-mono text-sm tracking-wide hover:bg-oxblood transition-colors"
            >
              Request a grade
            </a>
            <span className="font-mono text-[11px] text-ink-faint leading-relaxed max-w-xs">
              Not up yet? Add it to the bench — free, and we email you when it publishes.
            </span>
          </div>
        </header>

        <GradesIndex serverRows={rows} skillRows={skillRows} />
      </article>
  );
}
