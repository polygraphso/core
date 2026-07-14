/**
 * /dashboard — monitor management for signed-in users, as a full-width ledger.
 *
 * Reads monitors + current grades + recent alert deliveries for this user. App
 * admins additionally get a topline overview strip (the same numbers as /admin).
 * The proxy guarantees a session before this route is reached, but we double-
 * check and redirect so the type system knows session is non-null below.
 */

import { redirect } from "next/navigation";
import { getSession } from "@/lib/session";
import { getUserPlan } from "@/lib/userPlans";
import { getSupabaseAdmin } from "@/lib/supabase";
import { refToPath } from "@/lib/badgeData";
import { skillRefToPath } from "@/lib/skillGrades";
import { MonitorsList, type MonitorEntry } from "./_components/MonitorsList";
import { AddMonitorForm } from "./_components/AddMonitorForm";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "Dashboard · polygraph",
  robots: { index: false },
};

interface MonitorRow {
  id: string;
  target: string;
  target_kind: "registry_ref" | "skill";
  unsubscribe_token: string;
  unsubscribed_at: string | null;
  created_at: string;
  last_notified_grade: string | null;
  last_notified_version: string | null;
  last_notified_at: string | null;
  alert_min_grade: "C" | "D" | "F" | null;
}

interface GradeRow {
  target: string;
  grade: string | null;
  resolved_version: string | null;
}

interface DeliveryRow {
  id: string;
  target: string;
  version: string | null;
  grade: string | null;
  status: string;
  sent_at: string | null;
  created_at: string;
}

const HEAD_LINK =
  "font-mono text-[11px] uppercase tracking-[0.1em] text-ink-muted hover:text-oxblood transition-colors border-b border-dotted border-rule pb-0.5";
const RAIL_LABEL = "font-mono text-[10px] uppercase tracking-[0.18em] text-ink-faint";

export default async function DashboardPage() {
  const session = await getSession();
  if (!session) redirect("/login?next=/dashboard");

  const db = getSupabaseAdmin();
  if (!db) {
    return (
      <main className="px-8 py-12">
        <p className="font-mono text-sm text-oxblood">Database not configured.</p>
      </main>
    );
  }

  const monitorsResult = await db
    .from("monitors")
    .select(
      "id, target, target_kind, unsubscribe_token, unsubscribed_at, created_at, last_notified_grade, last_notified_version, last_notified_at, alert_min_grade",
    )
    .eq("user_id", session.userId)
    .order("created_at", { ascending: false });

  const monitors: MonitorRow[] = (monitorsResult.data ?? []) as MonitorRow[];
  const serverTargets = monitors.filter((m) => m.target_kind !== "skill").map((m) => m.target);
  const skillTargets = monitors.filter((m) => m.target_kind === "skill").map((m) => m.target);

  // Latest grade per monitored target. Servers show the PUBLISHED grade (the live,
  // minted one); skills aren't published-gated, so the newest complete run wins —
  // the same rule the /skill report uses.
  const gradeMap: Record<string, { grade: string | null; version: string | null }> = {};
  const collect = (rows: GradeRow[]) => {
    for (const row of rows) {
      if (!gradeMap[row.target]) {
        gradeMap[row.target] = { grade: row.grade, version: row.resolved_version };
      }
    }
  };
  const [serverRuns, skillRuns] = await Promise.all([
    serverTargets.length > 0
      ? db
          .from("hosted_runs")
          .select("target, grade, resolved_version")
          .in("target", serverTargets)
          .eq("status", "complete")
          .not("published_at", "is", null)
          .order("published_at", { ascending: false })
      : Promise.resolve({ data: [] as GradeRow[] }),
    skillTargets.length > 0
      ? db
          .from("hosted_runs")
          .select("target, grade, resolved_version")
          .in("target", skillTargets)
          .eq("target_kind", "skill")
          .eq("status", "complete")
          .order("completed_at", { ascending: false })
      : Promise.resolve({ data: [] as GradeRow[] }),
  ]);
  collect((serverRuns.data ?? []) as GradeRow[]);
  collect((skillRuns.data ?? []) as GradeRow[]);

  // Fetch recent alert deliveries for this user's monitors.
  const monitorIds = monitors.map((m) => m.id);
  let deliveries: DeliveryRow[] = [];
  if (monitorIds.length > 0) {
    const { data } = await db
      .from("alert_deliveries")
      .select("id, target, version, grade, status, sent_at, created_at")
      .in("monitor_id", monitorIds)
      .eq("status", "sent")
      .order("created_at", { ascending: false })
      .limit(12);
    deliveries = (data ?? []) as DeliveryRow[];
  }

  const activeCount = monitors.filter((m) => !m.unsubscribed_at).length;

  // Plan-aware quota: free = 1, indie 25, team 100; admins uncapped. Also
  // lazily reconciles a canceled plan stream before we render its badge.
  const planState = await getUserPlan(session.userId);
  const quotaMax = session.isAdmin ? null : planState.quota;

  const monitorEntries: MonitorEntry[] = monitors.map((m) => {
    const kind = m.target_kind === "skill" ? ("skill" as const) : ("server" as const);
    return {
      ...m,
      kind,
      // Link a skill row to its /skill report, a server row to /mcp.
      reportHref: kind === "skill" ? `/skill/${skillRefToPath(m.target)}` : `/mcp/${refToPath(m.target)}`,
      currentGrade: gradeMap[m.target]?.grade ?? null,
      currentVersion: gradeMap[m.target]?.version ?? null,
    };
  });

  return (
    <main className="px-6 sm:px-10 py-12">
      <header className="mb-7 flex flex-wrap items-end justify-between gap-x-6 gap-y-3">
        <div>
          <p className="section-label mb-2">Version monitors</p>
          <h1 className="font-serif text-3xl md:text-4xl text-ink tracking-tight">Monitors</h1>
        </div>
        <div className="flex gap-5">
          <a href="/mcp-index" className={HEAD_LINK}>
            Browse grades →
          </a>
          <a href="/request" className={HEAD_LINK}>
            Request a grade →
          </a>
        </div>
      </header>

      {session.isAdmin || quotaMax === null || activeCount < quotaMax ? (
        <div className="mb-8">
          <AddMonitorForm />
        </div>
      ) : null}

      <div className="flex flex-col gap-8 xl:flex-row xl:items-start xl:gap-8">
        <div className="min-w-0 flex-1">
          <MonitorsList
            monitors={monitorEntries}
            quota={{ used: activeCount, max: quotaMax }}
          />
        </div>

        <aside className="flex w-full flex-col gap-6 xl:w-[312px] xl:flex-shrink-0">
          {deliveries.length > 0 ? (
            <div>
              <p className={`${RAIL_LABEL} mb-2.5`}>Recent alerts</p>
              <div className="border-t hairline">
                {deliveries.map((d) => (
                  <div
                    key={d.id}
                    className="flex items-baseline justify-between gap-3 border-b border-rule-soft py-2"
                  >
                    <p className="min-w-0 truncate font-mono text-[11px] text-ink">
                      {d.target}
                      {d.version ? <span className="text-ink-faint"> v{d.version}</span> : null}
                      {d.grade ? <span className="text-ink-muted"> → {d.grade}</span> : null}
                    </p>
                    <p className="shrink-0 font-mono text-[10px] text-ink-faint tabular">
                      {new Date(d.sent_at ?? d.created_at).toLocaleDateString("en-US", {
                        month: "short",
                        day: "numeric",
                      })}
                    </p>
                  </div>
                ))}
              </div>
            </div>
          ) : null}

          <div>
            <p className={`${RAIL_LABEL} mb-2`}>Account</p>
            <p className="truncate font-mono text-[12px] text-ink">{session.email}</p>
            <div className="mt-2 flex items-baseline gap-2 font-mono text-[11px]">
              <span className="uppercase tracking-[0.12em] text-ink-muted">
                {planState.plan} plan
              </span>
              {planState.endAt ? (
                <span className="text-ink-faint">
                  renews by{" "}
                  {new Date(planState.endAt).toLocaleDateString("en-US", {
                    month: "short",
                    day: "numeric",
                  })}
                </span>
              ) : null}
            </div>
            {!session.isAdmin ? (
              <a
                href="/dashboard/account"
                className="mt-1 inline-block font-mono text-[11px] text-ink-muted underline decoration-dotted underline-offset-2 hover:text-oxblood"
              >
                {planState.plan === "free" ? "Upgrade for more monitors →" : "Manage plan →"}
              </a>
            ) : null}
          </div>
        </aside>
      </div>
    </main>
  );
}
