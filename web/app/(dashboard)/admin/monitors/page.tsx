import type { Metadata } from "next";
import { getSupabaseAdmin } from "@/lib/supabase";
import { githubUrlForSkillRef } from "@/lib/skillGrades";
import { EmptyNote } from "../_components/ui";
import { Pagination } from "../_components/Pagination";

export const dynamic = "force-dynamic";
export const revalidate = 0;
export const metadata: Metadata = { title: "Monitors · Admin", robots: { index: false } };

const GRADE_COLOR: Record<string, string> = {
  A: "#2f5132", B: "#4f6b36", C: "#a86b19", D: "#b85024", F: "#7a1f2b",
};
const PAGE_SIZE = 25;

type Kind = "mcp" | "skill";

interface MonitorRow { target: string; target_kind: string | null; unsubscribed_at: string | null; created_at: string; }
interface GradeRow { target: string; grade: string | null; }
interface TargetStats { total: number; active: number; firstAt: string; kind: Kind; }

function externalUrl(target: string, kind: Kind): string | null {
  if (kind === "skill") return githubUrlForSkillRef(target); // github tree URL incl. subpath
  if (target.startsWith("https://") || target.startsWith("http://")) return target;
  if (target.startsWith("npm/")) return `https://www.npmjs.com/package/${target.slice(4)}`;
  if (target.startsWith("pypi/")) return `https://pypi.org/project/${target.slice(5)}`;
  if (target.startsWith("github/")) return `https://github.com/${target.slice(7).split("#")[0]}`;
  return null;
}

export default async function AdminMonitorsPage({
  searchParams,
}: {
  searchParams: Promise<{ page?: string; kind?: string }>;
}) {
  const { page: pageParam, kind: kindParam } = await searchParams;
  const page = Math.max(1, parseInt(pageParam ?? "1", 10) || 1);
  const filter: Kind | "all" = kindParam === "mcp" || kindParam === "skill" ? kindParam : "all";

  const db = getSupabaseAdmin();
  if (!db) return <main className="w-full px-8 py-12"><EmptyNote>Supabase not configured.</EmptyNote></main>;

  const monitorsResult = await db.from("monitors").select("target, target_kind, unsubscribed_at, created_at").order("created_at", { ascending: true });
  const monitors = (monitorsResult.data ?? []) as MonitorRow[];

  // Aggregate per target, carrying its kind (skill vs MCP server).
  const byTarget = new Map<string, TargetStats>();
  for (const m of monitors) {
    const kind: Kind = m.target_kind === "skill" ? "skill" : "mcp";
    const s = byTarget.get(m.target) ?? { total: 0, active: 0, firstAt: m.created_at, kind };
    s.total++;
    if (!m.unsubscribed_at) s.active++;
    byTarget.set(m.target, s);
  }

  const mcpCount = [...byTarget.values()].filter((s) => s.kind === "mcp").length;
  const skillCount = [...byTarget.values()].filter((s) => s.kind === "skill").length;

  const allRows = [...byTarget.entries()]
    .filter(([, s]) => filter === "all" || s.kind === filter)
    .sort((a, b) => b[1].active - a[1].active || b[1].total - a[1].total);
  const totalPages = Math.ceil(allRows.length / PAGE_SIZE);
  const rows = allRows.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  // Grades for the current page. Servers use the published grade; skills aren't
  // published-gated, so the newest complete run wins (matches /skill + /dashboard).
  const serverTargets = rows.filter(([, s]) => s.kind !== "skill").map(([t]) => t);
  const skillTargets = rows.filter(([, s]) => s.kind === "skill").map(([t]) => t);
  const gradeMap: Record<string, string | null> = {};
  const collect = (runs: GradeRow[]) => {
    for (const r of runs) if (!(r.target in gradeMap)) gradeMap[r.target] = r.grade;
  };
  const [serverRuns, skillRuns] = await Promise.all([
    serverTargets.length > 0
      ? db.from("hosted_runs").select("target, grade").in("target", serverTargets)
          .eq("status", "complete").not("published_at", "is", null)
          .order("published_at", { ascending: false }).limit(serverTargets.length * 3)
      : Promise.resolve({ data: [] as GradeRow[] }),
    skillTargets.length > 0
      ? db.from("hosted_runs").select("target, grade").in("target", skillTargets)
          .eq("target_kind", "skill").eq("status", "complete")
          .order("completed_at", { ascending: false }).limit(skillTargets.length * 3)
      : Promise.resolve({ data: [] as GradeRow[] }),
  ]);
  collect((serverRuns.data ?? []) as GradeRow[]);
  collect((skillRuns.data ?? []) as GradeRow[]);

  const tabs: Array<{ key: Kind | "all"; label: string; count: number }> = [
    { key: "all", label: "All", count: mcpCount + skillCount },
    { key: "mcp", label: "MCP servers", count: mcpCount },
    { key: "skill", label: "Skills", count: skillCount },
  ];

  return (
    <main className="w-full px-8 py-12">
      <div className="mb-6">
        <p className="section-label mb-1">Internal</p>
        <h1 className="font-serif text-2xl text-ink">Monitors</h1>
        <p className="text-sm text-ink-muted mt-1">
          {mcpCount} MCP server{mcpCount !== 1 ? "s" : ""} · {skillCount} skill{skillCount !== 1 ? "s" : ""} being monitored
        </p>
      </div>

      {/* filter: All · MCP servers · Skills (URL-driven, resets to page 1) */}
      <div className="flex gap-1.5 mb-5">
        {tabs.map((t) => {
          const active = filter === t.key;
          const href = t.key === "all" ? "/admin/monitors" : `/admin/monitors?kind=${t.key}`;
          return (
            <a
              key={t.key}
              href={href}
              aria-current={active ? "page" : undefined}
              className={`font-mono text-[10px] uppercase tracking-[0.14em] px-3 py-1.5 border hairline transition-colors ${
                active ? "bg-ink text-parchment" : "bg-parchment text-ink-muted hover:text-ink"
              }`}
            >
              {t.label} <span className="tabular">({t.count})</span>
            </a>
          );
        })}
      </div>

      {rows.length === 0 ? (
        <EmptyNote>No monitors{filter !== "all" ? ` in ${filter === "mcp" ? "MCP servers" : "Skills"}` : ""} yet.</EmptyNote>
      ) : (
        <>
          <div className="border hairline overflow-hidden">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b hairline bg-parchment-50">
                  <th className="px-4 py-2.5 font-mono text-[10px] uppercase tracking-[0.16em] text-ink-faint">Target</th>
                  <th className="px-4 py-2.5 font-mono text-[10px] uppercase tracking-[0.16em] text-ink-faint">Type</th>
                  <th className="px-4 py-2.5 font-mono text-[10px] uppercase tracking-[0.16em] text-ink-faint">Grade</th>
                  <th className="px-4 py-2.5 font-mono text-[10px] uppercase tracking-[0.16em] text-ink-faint text-right">Active</th>
                  <th className="px-4 py-2.5 font-mono text-[10px] uppercase tracking-[0.16em] text-ink-faint text-right hidden sm:table-cell">Total</th>
                  <th className="px-4 py-2.5 font-mono text-[10px] uppercase tracking-[0.16em] text-ink-faint text-right hidden md:table-cell">First monitored</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-rule">
                {rows.map(([target, stats]) => {
                  const grade = gradeMap[target] ?? null;
                  const ext = externalUrl(target, stats.kind);
                  return (
                    <tr key={target} className="hover:bg-ink/[0.02] cursor-pointer transition-colors group">
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2">
                          <a href={`/admin/monitors/${encodeURIComponent(target)}`} className="font-mono text-xs text-ink group-hover:text-oxblood transition-colors truncate max-w-[250px]">
                            {target}
                          </a>
                          {ext && (
                            <a href={ext} target="_blank" rel="noopener noreferrer" className="shrink-0 font-mono text-[10px] text-ink-faint hover:text-ink transition-colors" title="View source">
                              ↗
                            </a>
                          )}
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        <span className="font-mono text-[10px] uppercase tracking-[0.1em] text-ink-muted border hairline px-1.5 py-0.5">
                          {stats.kind === "skill" ? "Skill" : "MCP"}
                        </span>
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
          <Pagination page={page} totalPages={totalPages} buildHref={(p) => `/admin/monitors?${filter !== "all" ? `kind=${filter}&` : ""}page=${p}`} />
        </>
      )}
    </main>
  );
}
