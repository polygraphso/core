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
import { WatchSummary } from "./_components/WatchSummary";
import type { LitmusGrade } from "@/lib/hostedGrades";

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

// Grade ordering, declared locally per the prevailing in-file idiom (these are
// module-private elsewhere). RANK compares a current grade to an alert threshold.
const GRADE_ORDER: LitmusGrade[] = ["A", "B", "C", "D", "F"];
const RANK: Record<string, number> = { A: 0, B: 1, C: 2, D: 3, F: 4 };

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
    const currentGrade = gradeMap[m.target]?.grade ?? null;
    const active = !m.unsubscribed_at;
    // Below threshold = an active monitor whose current grade is at or worse than
    // the grade it asked to be alerted on. No threshold set ("every regrade") never
    // counts; a paused monitor never raises the alarm.
    const belowThreshold =
      active &&
      !!currentGrade &&
      !!m.alert_min_grade &&
      RANK[currentGrade] >= RANK[m.alert_min_grade];
    return {
      ...m,
      kind,
      // Link a skill row to its /skill report, a server row to /mcp.
      reportHref: kind === "skill" ? `/skill/${skillRefToPath(m.target)}` : `/mcp/${refToPath(m.target)}`,
      currentGrade,
      currentVersion: gradeMap[m.target]?.version ?? null,
      belowThreshold,
    };
  });

  // Watch-summary figures — derived from what we already loaded, no new query.
  const activeEntries = monitorEntries.filter((m) => !m.unsubscribed_at);
  const gradeCounts = GRADE_ORDER.map((g) => ({
    g,
    n: activeEntries.filter((m) => m.currentGrade === g).length,
  })).filter((c) => c.n > 0);
  const ungradedCount = activeEntries.filter((m) => !m.currentGrade).length;
  const belowThresholdCount = activeEntries.filter((m) => m.belowThreshold).length;

  return (
    <main className="px-6 sm:px-10 py-12">
      <header className="mb-7 flex flex-wrap items-end justify-between gap-x-6 gap-y-3">
        <h1 className="font-serif text-3xl md:text-4xl text-ink tracking-tight">Monitors</h1>
        <div className="flex gap-5">
          <a href="/mcp-index" className={HEAD_LINK}>
            Browse grades →
          </a>
          <a href="/request" className={HEAD_LINK}>
            Request a grade →
          </a>
        </div>
      </header>

      {activeEntries.length > 0 ? (
        <WatchSummary
          watched={activeCount}
          counts={gradeCounts}
          ungraded={ungradedCount}
          belowThreshold={belowThresholdCount}
        />
      ) : null}

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

        {deliveries.length > 0 ? (
          <aside className="flex w-full flex-col gap-6 xl:w-[312px] xl:flex-shrink-0">
            <div>
              <p className={`${RAIL_LABEL} mb-2.5`}>Recent events</p>
              <div className="border-t hairline">
                {deliveries.map((d) => {
                  // A grade dropping to D or F is the event worth flagging.
                  const severe = d.grade ? RANK[d.grade] >= 3 : false;
                  return (
                    <div
                      key={d.id}
                      className="flex items-baseline justify-between gap-3 border-b border-rule-soft py-2"
                    >
                      <p className="min-w-0 truncate font-mono text-[11px] text-ink">
                        {d.target}
                        {d.version ? <span className="text-ink-faint"> v{d.version}</span> : null}
                        {d.grade ? (
                          <span className={severe ? "text-oxblood" : "text-ink-muted"}>
                            {" → "}
                            {d.grade}
                          </span>
                        ) : null}
                      </p>
                      <p className="shrink-0 font-mono text-[10px] text-ink-faint tabular">
                        {new Date(d.sent_at ?? d.created_at).toLocaleDateString("en-US", {
                          month: "short",
                          day: "numeric",
                        })}
                      </p>
                    </div>
                  );
                })}
              </div>
            </div>
          </aside>
        ) : null}
      </div>
    </main>
  );
}
