import type { Metadata } from "next";
import { getSupabaseAdmin } from "@/lib/supabase";
import { EmptyNote } from "../_components/ui";
import { Pagination } from "../_components/Pagination";

export const dynamic = "force-dynamic";
export const revalidate = 0;
export const metadata: Metadata = { title: "Monitors · Admin", robots: { index: false } };

const GRADE_COLOR: Record<string, string> = {
  A: "#2f5132", B: "#4f6b36", C: "#a86b19", D: "#b85024", F: "#7a1f2b",
};
const PAGE_SIZE = 25;

interface MonitorRow { target: string; unsubscribed_at: string | null; created_at: string; }
interface GradeRow { target: string; grade: string | null; }

function externalUrl(target: string): string | null {
  if (target.startsWith("https://") || target.startsWith("http://")) return target;
  if (target.startsWith("npm/")) return `https://www.npmjs.com/package/${target.slice(4)}`;
  if (target.startsWith("pypi/")) return `https://pypi.org/project/${target.slice(5)}`;
  if (target.startsWith("github/")) return `https://github.com/${target.slice(7).split("#")[0]}`;
  return null;
}

export default async function AdminMonitorsPage({
  searchParams,
}: {
  searchParams: Promise<{ page?: string }>;
}) {
  const { page: pageParam } = await searchParams;
  const page = Math.max(1, parseInt(pageParam ?? "1", 10) || 1);

  const db = getSupabaseAdmin();
  if (!db) return <main className="w-full px-8 py-12"><EmptyNote>Supabase not configured.</EmptyNote></main>;

  const monitorsResult = await db.from("monitors").select("target, unsubscribed_at, created_at").order("created_at", { ascending: true });
  const monitors = (monitorsResult.data ?? []) as MonitorRow[];

  // Aggregate per target
  const byTarget = new Map<string, { total: number; active: number; firstAt: string }>();
  for (const m of monitors) {
    const s = byTarget.get(m.target) ?? { total: 0, active: 0, firstAt: m.created_at };
    s.total++;
    if (!m.unsubscribed_at) s.active++;
    byTarget.set(m.target, s);
  }

  const allRows = [...byTarget.entries()].sort((a, b) => b[1].active - a[1].active || b[1].total - a[1].total);
  const totalPages = Math.ceil(allRows.length / PAGE_SIZE);
  const rows = allRows.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  // Fetch grades only for the current page's targets
  const targets = rows.map(([t]) => t);
  let gradeMap: Record<string, string | null> = {};
  if (targets.length > 0) {
    const { data: runs } = await db.from("hosted_runs")
      .select("target, grade")
      .in("target", targets)
      .eq("status", "complete")
      .not("published_at", "is", null)
      .order("published_at", { ascending: false })
      .limit(targets.length * 3);
    for (const row of ((runs ?? []) as GradeRow[])) {
      if (!(row.target in gradeMap)) gradeMap[row.target] = row.grade;
    }
  }

  return (
    <main className="w-full px-8 py-12">
      <div className="mb-8">
        <p className="section-label mb-1">Internal</p>
        <h1 className="font-serif text-2xl text-ink">Monitors</h1>
        <p className="text-sm text-ink-muted mt-1">{allRows.length} server{allRows.length !== 1 ? "s" : ""} being monitored</p>
      </div>

      {rows.length === 0 ? (
        <EmptyNote>No monitors yet.</EmptyNote>
      ) : (
        <>
          <div className="border hairline overflow-hidden">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b hairline bg-parchment-50">
                  <th className="px-4 py-2.5 font-mono text-[10px] uppercase tracking-[0.16em] text-ink-faint">Server</th>
                  <th className="px-4 py-2.5 font-mono text-[10px] uppercase tracking-[0.16em] text-ink-faint">Grade</th>
                  <th className="px-4 py-2.5 font-mono text-[10px] uppercase tracking-[0.16em] text-ink-faint text-right">Active</th>
                  <th className="px-4 py-2.5 font-mono text-[10px] uppercase tracking-[0.16em] text-ink-faint text-right hidden sm:table-cell">Total</th>
                  <th className="px-4 py-2.5 font-mono text-[10px] uppercase tracking-[0.16em] text-ink-faint text-right hidden md:table-cell">First monitored</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-rule">
                {rows.map(([target, stats]) => {
                  const grade = gradeMap[target] ?? null;
                  return (
                    <tr key={target} className="hover:bg-ink/[0.02] cursor-pointer transition-colors group">
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2">
                          <a href={`/admin/monitors/${encodeURIComponent(target)}`} className="font-mono text-xs text-ink group-hover:text-oxblood transition-colors truncate max-w-[250px]">
                            {target}
                          </a>
                          {externalUrl(target) && (
                            <a href={externalUrl(target)!} target="_blank" rel="noopener noreferrer" className="shrink-0 font-mono text-[10px] text-ink-faint hover:text-ink transition-colors" title="View on registry">
                              ↗
                            </a>
                          )}
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        {grade ? (
                          <span className="font-mono text-[10px] font-semibold px-1.5 py-0.5 text-parchment" style={{ backgroundColor: GRADE_COLOR[grade] ?? "#23201a" }}>
                            {grade}
                          </span>
                        ) : (
                          <span className="font-mono text-[10px] text-ink-faint border hairline px-1.5 py-0.5">—</span>
                        )}
                      </td>
                      <td className="px-4 py-3 font-mono text-xs text-ink text-right tabular">{stats.active}</td>
                      <td className="px-4 py-3 font-mono text-xs text-ink-muted text-right tabular hidden sm:table-cell">{stats.total}</td>
                      <td className="px-4 py-3 font-mono text-[11px] text-ink-faint text-right tabular hidden md:table-cell">
                        {new Date(stats.firstAt).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          <Pagination page={page} totalPages={totalPages} buildHref={(p) => `/admin/monitors?page=${p}`} />
        </>
      )}
    </main>
  );
}
