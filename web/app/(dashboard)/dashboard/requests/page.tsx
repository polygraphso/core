/**
 * /dashboard/requests — the signed-in user's own grade requests: what they asked
 * to have graded, the $1 fee they paid on each, and the resulting grade once it
 * lands. Requests are matched to the user by email.
 */

import { redirect } from "next/navigation";
import { getSession } from "@/lib/session";
import { getUserGradeRequests, requestStage, type RequestTone } from "@/lib/gradeRequests";
import { formatUsd } from "@/lib/revenueAggregate";

export const dynamic = "force-dynamic";
export const metadata = { title: "Requests · polygraph", robots: { index: false } };

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

export default async function UserRequestsPage() {
  const session = await getSession();
  if (!session) redirect("/login?next=/dashboard/requests");

  const requests = await getUserGradeRequests(session.email);

  return (
    <main className="px-6 sm:px-10 py-12">
      <header className="mb-7 flex flex-wrap items-end justify-between gap-x-6 gap-y-3">
        <h1 className="font-serif text-3xl md:text-4xl text-ink tracking-tight">Requests</h1>
      </header>

      {requests.length === 0 ? (
        <p className="text-sm text-ink-muted">
          You haven&apos;t requested any grades yet. Hosted grading is discontinued.
        </p>
      ) : (
        <div className="border hairline overflow-hidden">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="border-b hairline bg-parchment-50">
                <th className="px-4 py-2.5 font-mono text-[10px] uppercase tracking-[0.16em] text-ink-faint">Target</th>
                <th className="px-4 py-2.5 font-mono text-[10px] uppercase tracking-[0.16em] text-ink-faint">Status</th>
                <th className="px-4 py-2.5 font-mono text-[10px] uppercase tracking-[0.16em] text-ink-faint hidden sm:table-cell">Fee</th>
                <th className="px-4 py-2.5 font-mono text-[10px] uppercase tracking-[0.16em] text-ink-faint hidden sm:table-cell">Requested</th>
                <th className="px-4 py-2.5 font-mono text-[10px] uppercase tracking-[0.16em] text-ink-faint text-right">Grade</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-rule">
              {requests.map((r) => {
                const stage = requestStage(r);
                return (
                  <tr key={r.id} className="hover:bg-ink/[0.02] transition-colors">
                    <td className="px-4 py-3">
                      {r.reportHref ? (
                        <a href={r.reportHref} className="font-mono text-xs text-ink hover:text-oxblood transition-colors truncate block max-w-[280px]">
                          {r.target}
                        </a>
                      ) : (
                        <span className="font-mono text-xs text-ink truncate block max-w-[280px]" title={r.target}>
                          {r.target}
                        </span>
                      )}
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
                        <a href={`/request/priority/${r.id}`} className="text-terracotta hover:underline">
                          unpaid →
                        </a>
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
                        <span className="font-mono text-[11px] text-ink-faint">pending</span>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </main>
  );
}
