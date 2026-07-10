/**
 * /dashboard — monitor management for signed-in users.
 *
 * Reads monitors + current grades + recent alert deliveries for this user.
 * The proxy guarantees a session before this route is reached, but we double-
 * check and redirect so the type system knows session is non-null below.
 */

import { redirect } from "next/navigation";
import { getSession } from "@/lib/session";
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

  // Fetch monitors, grades, deliveries in parallel.
  const [monitorsResult, deliveriesResult] = await Promise.all([
    db
      .from("monitors")
      .select(
        "id, target, target_kind, unsubscribe_token, unsubscribed_at, created_at, last_notified_grade, last_notified_version, last_notified_at, alert_min_grade",
      )
      .eq("user_id", session.userId)
      .order("created_at", { ascending: false }),
    // Deliveries fetched after we have monitor IDs; handled below.
    Promise.resolve(null),
  ]);

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
      .limit(20);
    deliveries = (data ?? []) as DeliveryRow[];
  }

  const activeCount = monitors.filter((m) => !m.unsubscribed_at).length;

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
    <main className="px-6 sm:px-10 py-12 max-w-3xl">
      <div>
        {/* Header — same pattern as the ecosystems pages. */}
        <header className="mb-8">
          <p className="section-label mb-3">Version monitors</p>
          <div className="flex flex-wrap items-start justify-between gap-x-6 gap-y-3">
            <div>
              <h1 className="font-serif text-3xl md:text-4xl text-ink tracking-tight">Monitors</h1>
              <p className="mt-3 text-ink-muted text-[15px] leading-relaxed max-w-xl">
                MCP servers and skills. By default, one email each time a monitored target is
                re-graded — a new package version, or a new commit for a github skill or server.
                Set a grade threshold on any monitor to hear only about the grades you care about.
              </p>
            </div>
            <div className="shrink-0 flex flex-col items-end gap-2">
              <a
                href="/mcp-index"
                className="font-mono text-[11px] uppercase tracking-widest text-ink-muted hover:text-ink transition-colors border-b hairline border-dotted"
              >
                Browse grades →
              </a>
              <a
                href="/request"
                className="font-mono text-[11px] uppercase tracking-widest text-ink-muted hover:text-ink transition-colors border-b hairline border-dotted"
              >
                Request a grade →
              </a>
            </div>
          </div>
        </header>

        {(session.isAdmin || activeCount < 1) && <AddMonitorForm />}

        <MonitorsList
          monitors={monitorEntries}
          quota={{ used: activeCount, max: session.isAdmin ? null : 1 }}
        />

        {/* Alert history */}
        {deliveries.length > 0 && (
          <section className="mt-14">
            <div className="border-t hairline pt-6 mb-6">
              <h2 className="font-mono text-[11px] uppercase tracking-[0.18em] text-ink-faint">
                Recent alerts
              </h2>
            </div>
            <div className="grid gap-2">
              {deliveries.map((d) => (
                <div
                  key={d.id}
                  className="flex items-center justify-between gap-3 border hairline bg-parchment-50 px-4 py-3"
                >
                  <div className="min-w-0">
                    <p className="font-mono text-sm text-ink truncate">{d.target}</p>
                    {d.version && (
                      <p className="font-mono text-[11px] text-ink-faint mt-0.5">
                        v{d.version}
                        {d.grade && (
                          <span className="ml-2 text-ink">→ {d.grade}</span>
                        )}
                      </p>
                    )}
                  </div>
                  <p className="shrink-0 font-mono text-[11px] text-ink-faint">
                    {new Date(d.sent_at ?? d.created_at).toLocaleDateString("en-US", {
                      month: "short",
                      day: "numeric",
                    })}
                  </p>
                </div>
              ))}
            </div>
          </section>
        )}

        {/* Account */}
        <section className="mt-14">
          <div className="border-t hairline pt-6 mb-4">
            <h2 className="font-mono text-[11px] uppercase tracking-[0.18em] text-ink-faint">
              Account
            </h2>
          </div>
          <p className="font-mono text-sm text-ink">{session.email}</p>
        </section>
      </div>
    </main>
  );
}
