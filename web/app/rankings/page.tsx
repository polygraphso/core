// web/app/rankings/page.tsx
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
    "The most-adopted MCP servers, ranked by adoption and graded for behavior with the open litmus harness. A grade is a measurement, not a guarantee — re-run it yourself.",
  alternates: { canonical: "/rankings" },
};

// Re-render at most every 10 min; a fresh score run or regrade surfaces within the window.
export const revalidate = 600;

const TOP_N = 50;

function statusColor(status: string | null): string {
  if (status === "pass") return GRADE_HEX.A;
  if (!status || status.startsWith("skip")) return "var(--color-ink-faint)";
  return "var(--color-oxblood)";
}

export default async function RankingsPage() {
  const db = getSupabaseAdmin();
  let rows: RankingRow[] = [];
  if (db) {
    const [ranked, grades] = await Promise.all([
      fetchTopRanked(db, TOP_N),
      fetchPublishedGradeDetailMap(db),
    ]);
    rows = mergeRankings(ranked, grades);
  }
  const gradedCount = rows.filter((r) => r.grade !== null).length;

  return (
    <main className="flex-1">
      <article className="mx-auto max-w-4xl px-6 pt-14 pb-24 md:pt-20 md:pb-32">
        <header className="mb-12">
          <p className="section-label mb-4">Index · litmus-v6 · adoption-ranked</p>
          <h1 className="font-serif text-4xl md:text-5xl text-ink tracking-tight leading-[1.05]">
            The MCP Security Index
          </h1>
          <p className="mt-5 font-serif italic text-ink-muted text-lg md:text-xl leading-snug max-w-2xl">
            The most-adopted MCP servers, ordered by adoption and graded for
            behavior — what each server <em>does</em> when exercised the way an
            agent would.
          </p>
          <p className="mt-4 max-w-2xl text-ink-muted leading-relaxed text-sm">
            {rows.length > 0 ? (
              <>
                {gradedCount} of the top {rows.length} graded. A grade is a
                measurement, not a guarantee; every grade links to a report you
                can re-run yourself.
              </>
            ) : (
              <>Rankings are being computed. Check back shortly.</>
            )}
          </p>
        </header>

        {rows.length > 0 ? (
          <div className="overflow-x-auto">
            <table className="w-full border-collapse font-mono text-[12.5px]">
              <thead>
                <tr className="border-b hairline text-ink-faint text-left">
                  <th className="py-2 pr-3 font-normal w-10">#</th>
                  <th className="py-2 pr-4 font-normal">Server</th>
                  <th className="py-2 pr-4 font-normal">Adoption</th>
                  <th className="py-2 pr-4 font-normal">Grade</th>
                  <th className="py-2 font-normal">C-01 · C-02 · C-03</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((row) => (
                  <tr key={row.serverKey} className="border-b hairline align-baseline">
                    <td className="py-3 pr-3 tabular text-ink-faint">{row.rank}</td>
                    <td className="py-3 pr-4">
                      <Link
                        href={`/mcp/${row.serverKey}`}
                        className="text-ink hover:text-oxblood transition-colors break-all"
                      >
                        {row.serverKey}
                      </Link>
                    </td>
                    <td className="py-3 pr-4 tabular text-ink-muted whitespace-nowrap">
                      {row.adoptionSignal}
                    </td>
                    <td className="py-3 pr-4">
                      {row.grade ? (
                        <span
                          className="font-serif text-base"
                          style={{ color: GRADE_HEX[row.grade] }}
                          aria-label={`Grade ${row.grade}`}
                        >
                          {row.grade}
                        </span>
                      ) : (
                        <Link
                          href="/request"
                          className="hover:text-oxblood transition-colors"
                          style={{ color: UNRATED_HEX }}
                        >
                          request
                        </Link>
                      )}
                    </td>
                    <td className="py-3">
                      {row.grade ? (
                        <span className="flex gap-2">
                          {[row.c01, row.c02, row.c03].map((s, i) => (
                            <span
                              key={i}
                              aria-label={s ?? "n/a"}
                              title={s ?? "n/a"}
                              className="inline-block w-2.5 h-2.5"
                              style={{ backgroundColor: statusColor(s) }}
                            />
                          ))}
                        </span>
                      ) : (
                        <Link
                          href={`/notify?for=${row.serverKey}`}
                          className="text-ink-faint hover:text-oxblood transition-colors"
                        >
                          notify me
                        </Link>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : null}

        <p className="mt-10 text-ink-faint text-xs leading-relaxed max-w-2xl">
          Ordering is by adoption (npm / PyPI / GitHub signals), not by grade.
          Grades come from the open litmus harness; ungraded popular servers can
          be requested. See the{" "}
          <Link href="/methodology" className="border-b hairline border-dotted hover:text-oxblood">
            methodology
          </Link>
          .
        </p>
      </article>
    </main>
  );
}
