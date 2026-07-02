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
        "id, target, unsubscribe_token, unsubscribed_at, created_at, last_notified_grade, last_notified_version, last_notified_at, alert_min_grade",
      )
      .eq("user_id", session.userId)
      .order("created_at", { ascending: false }),
    // Deliveries fetched after we have monitor IDs; handled below.
    Promise.resolve(null),
  ]);

  const monitors: MonitorRow[] = (monitorsResult.data ?? []) as MonitorRow[];
  const targets = monitors.map((m) => m.target);

  // Fetch latest published grades for all monitored targets.
  let gradeMap: Record<string, { grade: string | null; version: string | null }> = {};
  if (targets.length > 0) {
    const { data: runs } = await db
      .from("hosted_runs")
      .select("target, grade, resolved_version")
      .in("target", targets)
      .eq("status", "complete")
      .not("published_at", "is", null)
      .order("published_at", { ascending: false });
    for (const row of ((runs ?? []) as GradeRow[])) {
      if (!gradeMap[row.target]) {
        gradeMap[row.target] = { grade: row.grade, version: row.resolved_version };
      }
    }
  }

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

  const monitorEntries: MonitorEntry[] = monitors.map((m) => ({
    ...m,
    currentGrade: gradeMap[m.target]?.grade ?? null,
    currentVersion: gradeMap[m.target]?.version ?? null,
    mcpPath: refToPath(m.target),
  }));

  return (
    <main className="flex-1">
      <div className="max-w-2xl mx-auto px-8 pt-14 pb-24 md:pt-16 md:pb-32">

        {/* Header */}
        <div className="border-t hairline pt-6 mb-10">
          <div className="flex items-baseline gap-4">
            <span className="section-label tabular">§ DASHBOARD</span>
            <span className="section-label">/</span>
            <span className="section-label">Monitors</span>
          </div>
        </div>

        <div className="flex items-start justify-between mb-6">
          <div>
            <h1 className="font-serif text-3xl text-ink tracking-tight">Monitors</h1>
            <p className="mt-2 text-ink-muted text-sm leading-relaxed max-w-md">
              By default, one email per new-version regrade. Set a grade threshold on any
              monitor to hear only about the grades you care about.
            </p>
          </div>
          <div className="shrink-0 flex flex-col items-end gap-2">
            <a
              href="/rankings"
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
