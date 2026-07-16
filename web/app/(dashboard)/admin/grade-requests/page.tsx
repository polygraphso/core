import type { Metadata } from "next";
import { getAdminGradeRequests, requestStage, type RequestTone } from "@/lib/gradeRequests";
import { getPriorityLane } from "@/lib/priorityPayments";
import { formatUsd } from "@/lib/revenueAggregate";
import { EmptyNote } from "../_components/ui";
import { Pagination } from "../_components/Pagination";

export const dynamic = "force-dynamic";
export const revalidate = 0;
export const metadata: Metadata = { title: "Grade requests · Admin", robots: { index: false } };

const PAGE_SIZE = 30;

const GRADE_COLOR: Record<string, string> = {
  A: "#2f5132", B: "#4f6b36", C: "#a86b19", D: "#b85024", F: "#7a1f2b",
};

const TONE: Record<RequestTone, string> = {
  done: "text-grade-a border-grade-a/40",
  active: "text-ink-muted border-rule",
  wait: "text-terracotta border-terracotta/50",
  dead: "text-ink-faint border-rule",
};

function fmt(date: string | null) {
  if (!date) return "—";
  return new Date(date).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}

export default async function AdminGradeRequestsPage({
  searchParams,
}: {
  searchParams: Promise<{ page?: string }>;
}) {
  const { page: pageParam } = await searchParams;
  const page = Math.max(1, parseInt(pageParam ?? "1", 10) || 1);

  const [{ rows, total }, priorityLane] = await Promise.all([
    getAdminGradeRequests(page, PAGE_SIZE),
    getPriorityLane(),
  ]);
  const totalPages = Math.ceil(total / PAGE_SIZE);
  const now = Date.now();

  return (
    <main className="w-full px-8 py-12">
      <div className="mb-8">
        <p className="section-label mb-1">Internal</p>
        <h1 className="font-serif text-2xl text-ink">Grade requests</h1>
        <p className="text-sm text-ink-muted mt-1">{total} total · paid rows are the live queue</p>
      </div>

      {/* Priority lane — paid requests by soonest deadline */}
      {priorityLane.length > 0 && (
        <div className="border border-oxblood/30 rounded-[4px] p-4 mb-8">
          <p className="section-label mb-3 text-oxblood">Paid queue · 48h SLA ({priorityLane.length})</p>
          <div className="space-y-1.5">
            {priorityLane.map((r) => {
              const deadline = new Date(r.priority_deadline_at).getTime();
              const overdue = deadline <= now;
              const hrsLeft = Math.round((deadline - now) / 3_600_000);
              return (
                <div key={r.id} className="flex items-baseline justify-between gap-3 font-mono text-[11px]">
                  <span className="min-w-0 truncate text-ink">{r.target}</span>
                  <span className={`shrink-0 tabular ${overdue ? "text-oxblood font-semibold" : "text-ink-faint"}`}>
                    {overdue ? "OVERDUE" : `${hrsLeft}h left`}
                  </span>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {rows.length === 0 ? (
        <EmptyNote>No grade requests yet.</EmptyNote>
      ) : (
        <>
          <div className="border hairline overflow-hidden">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b hairline bg-parchment-50">
                  <th className="px-4 py-2.5 font-mono text-[10px] uppercase tracking-[0.16em] text-ink-faint">Target</th>
                  <th className="px-4 py-2.5 font-mono text-[10px] uppercase tracking-[0.16em] text-ink-faint hidden md:table-cell">Requester</th>
                  <th className="px-4 py-2.5 font-mono text-[10px] uppercase tracking-[0.16em] text-ink-faint">Status</th>
                  <th className="px-4 py-2.5 font-mono text-[10px] uppercase tracking-[0.16em] text-ink-faint hidden sm:table-cell">Fee</th>
                  <th className="px-4 py-2.5 font-mono text-[10px] uppercase tracking-[0.16em] text-ink-faint hidden lg:table-cell">Deadline</th>
                  <th className="px-4 py-2.5 font-mono text-[10px] uppercase tracking-[0.16em] text-ink-faint hidden sm:table-cell">Requested</th>
                  <th className="px-4 py-2.5 font-mono text-[10px] uppercase tracking-[0.16em] text-ink-faint text-right">Grade</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-rule">
                {rows.map((r) => {
                  const stage = requestStage(r);
                  const deadline = r.priorityDeadlineAt ? new Date(r.priorityDeadlineAt).getTime() : null;
                  const overdue = deadline != null && r.status !== "completed" && deadline <= now;
                  return (
                    <tr key={r.id} className="hover:bg-ink/[0.02] transition-colors">
                      <td className="px-4 py-3">
                        {r.reportHref ? (
                          <a href={r.reportHref} className="font-mono text-xs text-ink hover:text-oxblood transition-colors truncate block max-w-[260px]" title={r.target}>
                            {r.target}
                          </a>
                        ) : (
                          <span className="font-mono text-xs text-ink truncate block max-w-[260px]" title={r.target}>
                            {r.target}
                          </span>
                        )}
                      </td>
                      <td className="px-4 py-3 hidden md:table-cell font-mono text-[11px] text-ink-muted truncate max-w-[180px]" title={r.email ?? ""}>
                        {r.email ?? <span className="text-ink-faint">agent/anon</span>}
                      </td>
                      <td className="px-4 py-3">
                        <span className={`font-mono text-[10px] uppercase tracking-widest border px-1.5 py-0.5 ${TONE[stage.tone]}`}>
                          {stage.label}
                        </span>
                      </td>
                      <td className="px-4 py-3 hidden sm:table-cell font-mono text-[11px] tabular">
                        {r.feePaidAt ? (
                          <span className="text-ink-muted">{formatUsd(r.feeUsd ?? 0)}</span>
                        ) : (
                          <span className="text-ink-faint">{r.feeStatus ?? "—"}</span>
                        )}
                      </td>
                      <td className="px-4 py-3 hidden lg:table-cell font-mono text-[11px] tabular">
                        {deadline == null ? (
                          <span className="text-ink-faint">—</span>
                        ) : overdue ? (
                          <span className="text-oxblood font-semibold">OVERDUE</span>
                        ) : (
                          <span className="text-ink-muted">{fmt(r.priorityDeadlineAt)}</span>
                        )}
                      </td>
                      <td className="px-4 py-3 hidden sm:table-cell font-mono text-[11px] text-ink-muted tabular">
                        {fmt(r.requestedAt)}
                      </td>
                      <td className="px-4 py-3 text-right">
                        {r.grade ? (
                          <a
                            href={r.reportHref ?? "#"}
                            className="font-mono text-[11px] font-semibold px-1.5 py-0.5 text-parchment"
                            style={{ backgroundColor: GRADE_COLOR[r.grade] ?? "#23201a" }}
                          >
                            {r.grade}
                          </a>
                        ) : (
                          <span className="font-mono text-[11px] text-ink-faint">—</span>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          <Pagination page={page} totalPages={totalPages} buildHref={(p) => `/admin/grade-requests?page=${p}`} />
        </>
      )}
    </main>
  );
}
