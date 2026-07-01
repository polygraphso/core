import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getSupabaseAdmin } from "@/lib/supabase";
import { EmptyNote } from "../../_components/ui";
import { Pagination } from "../../_components/Pagination";

export const dynamic = "force-dynamic";
export const revalidate = 0;
export const metadata: Metadata = { title: "User · Admin", robots: { index: false } };

const PAGE_SIZE = 20;

const GRADE_COLOR: Record<string, string> = {
  A: "#2f5132", B: "#4f6b36", C: "#a86b19", D: "#b85024", F: "#7a1f2b",
};

function fmt(date: string | null) {
  if (!date) return "—";
  return new Date(date).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}

function fmtTime(date: string | null) {
  if (!date) return "—";
  return new Date(date).toLocaleString("en-US", { month: "short", day: "numeric", year: "numeric", hour: "numeric", minute: "2-digit" });
}

interface MonitorRow {
  id: string; target: string; unsubscribed_at: string | null; created_at: string;
}
interface DeliveryRow {
  id: string; target: string; version: string | null; grade: string | null;
  status: string; sent_at: string | null; created_at: string;
}
interface GradeRow { target: string; grade: string | null; resolved_version: string | null; }

export default async function AdminUserDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ spage?: string; dpage?: string }>;
}) {
  const { id } = await params;
  const { spage: spageParam, dpage: dpageParam } = await searchParams;
  const spage = Math.max(1, parseInt(spageParam ?? "1", 10) || 1);
  const dpage = Math.max(1, parseInt(dpageParam ?? "1", 10) || 1);

  const db = getSupabaseAdmin();
  if (!db) return <main className="max-w-4xl mx-auto px-8 py-12"><EmptyNote>Supabase not configured.</EmptyNote></main>;

  const { data: { user }, error } = await db.auth.admin.getUserById(id);
  if (error || !user) notFound();

  // Load all monitors for this user (small per-user dataset; need all IDs for deliveries)
  const monitorsResult = await db
    .from("monitors")
    .select("id, target, unsubscribed_at, created_at")
    .eq("user_id", id)
    .order("created_at", { ascending: false });
  const monitors = (monitorsResult.data ?? []) as MonitorRow[];

  const monitorIds = monitors.map((m) => m.id);

  // Deliveries: total count + paginated page
  let totalDeliveries = 0;
  let deliveries: DeliveryRow[] = [];
  if (monitorIds.length > 0) {
    const dOffset = (dpage - 1) * PAGE_SIZE;
    const [countResult, pageResult] = await Promise.all([
      db.from("alert_deliveries")
        .select("id", { count: "exact", head: true })
        .in("monitor_id", monitorIds)
        .eq("status", "sent"),
      db.from("alert_deliveries")
        .select("id, target, version, grade, status, sent_at, created_at")
        .in("monitor_id", monitorIds)
        .eq("status", "sent")
        .order("sent_at", { ascending: false })
        .range(dOffset, dOffset + PAGE_SIZE - 1),
    ]);
    totalDeliveries = countResult.count ?? 0;
    deliveries = (pageResult.data ?? []) as DeliveryRow[];
  }

  // Grades for all monitored targets
  const targets = monitors.map((m) => m.target);
  let gradeMap: Record<string, { grade: string | null; version: string | null }> = {};
  if (targets.length > 0) {
    const { data: runs } = await db.from("hosted_runs")
      .select("target, grade, resolved_version")
      .in("target", targets).eq("status", "complete").not("published_at", "is", null)
      .order("published_at", { ascending: false }).limit(targets.length * 3);
    for (const row of ((runs ?? []) as GradeRow[])) {
      if (!(row.target in gradeMap)) gradeMap[row.target] = { grade: row.grade, version: row.resolved_version };
    }
  }

  const provider = user.app_metadata?.provider as string | undefined;
  const name = (user.user_metadata?.full_name ?? user.user_metadata?.user_name ?? null) as string | null;
  const avatarUrl = user.user_metadata?.avatar_url as string | undefined;
  const activeMonitors = monitors.filter((m) => !m.unsubscribed_at);
  const pausedMonitors = monitors.filter((m) => m.unsubscribed_at);

  // Paginate monitors in memory
  const spageTotal = Math.ceil(monitors.length / PAGE_SIZE);
  const monitorsPage = monitors.slice((spage - 1) * PAGE_SIZE, spage * PAGE_SIZE);
  const dpageTotal = Math.ceil(totalDeliveries / PAGE_SIZE);

  return (
    <main className="max-w-4xl mx-auto px-8 py-12">
      {/* Back */}
      <a href="/admin/users" className="font-mono text-[11px] uppercase tracking-[0.16em] text-ink-faint hover:text-ink transition-colors">
        ← Users
      </a>

      {/* Header */}
      <div className="mt-6 mb-10 flex items-center gap-4">
        {avatarUrl ? (
          <img src={avatarUrl} alt={name ?? user.email ?? ""} width={48} height={48} className="rounded-full border hairline" />
        ) : (
          <span className="w-12 h-12 rounded-full bg-ink flex items-center justify-center font-mono text-lg text-parchment select-none">
            {(name ?? user.email ?? "?").slice(0, 1).toUpperCase()}
          </span>
        )}
        <div>
          <div className="flex items-center gap-2">
            <h1 className="font-serif text-2xl text-ink">{name ?? user.email}</h1>
            {provider === "github" && (user.user_metadata?.user_name as string | undefined) && (
              <a
                href={`https://github.com/${user.user_metadata!.user_name as string}`}
                target="_blank"
                rel="noopener noreferrer"
                className="font-mono text-base text-ink-faint hover:text-ink transition-colors"
                title="GitHub profile"
              >
                ↗
              </a>
            )}
          </div>
          {name && <p className="font-mono text-xs text-ink-muted mt-0.5">{user.email}</p>}
        </div>
      </div>

      {/* Meta */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-10">
        {[
          { label: "Sign-in method", value: provider ?? "—" },
          { label: "Last sign in", value: fmt(user.last_sign_in_at ?? null) },
          { label: "Joined", value: fmt(user.created_at) },
          { label: "Emails sent", value: String(totalDeliveries) },
        ].map(({ label, value }) => (
          <div key={label} className="border hairline bg-parchment-50 p-4">
            <p className="font-mono text-[10px] uppercase tracking-[0.16em] text-ink-faint mb-1">{label}</p>
            <p className="font-mono text-sm text-ink">{value}</p>
          </div>
        ))}
      </div>

      {/* Monitors */}
      <section className="mb-10">
        <div className="border-t hairline pt-5 mb-4 flex items-baseline justify-between">
          <h2 className="font-mono text-[11px] uppercase tracking-[0.18em] text-ink-faint">Monitors</h2>
          <span className="font-mono text-[10px] text-ink-faint">{activeMonitors.length} active · {pausedMonitors.length} paused</span>
        </div>
        {monitors.length === 0 ? (
          <EmptyNote>No monitors.</EmptyNote>
        ) : (
          <>
            <ul className="divide-y divide-rule border-y border-rule">
              {monitorsPage.map((m) => {
                const g = gradeMap[m.target];
                return (
                  <li key={m.id} className={`py-3 flex items-center justify-between gap-3 ${m.unsubscribed_at ? "opacity-50" : ""}`}>
                    <div className="min-w-0 flex-1">
                      <a href={`/mcp/${m.target.replace(/^npm\//, "").replace(/^pypi\//, "pypi/")}`} className="font-mono text-xs text-ink hover:text-oxblood transition-colors truncate block">
                        {m.target}
                      </a>
                      <p className="font-mono text-[10px] text-ink-faint mt-0.5">Added {fmt(m.created_at)}</p>
                    </div>
                    <div className="shrink-0 flex items-center gap-2">
                      {g?.grade ? (
                        <span className="font-mono text-[10px] font-semibold px-1.5 py-0.5 text-parchment" style={{ backgroundColor: GRADE_COLOR[g.grade] ?? "#23201a" }}>
                          {g.grade}
                        </span>
                      ) : (
                        <span className="font-mono text-[10px] text-ink-faint border hairline px-1.5 py-0.5">ungraded</span>
                      )}
                      {m.unsubscribed_at && (
                        <span className="font-mono text-[10px] text-ink-faint border hairline px-1.5 py-0.5">paused</span>
                      )}
                    </div>
                  </li>
                );
              })}
            </ul>
            <Pagination
              page={spage}
              totalPages={spageTotal}
              buildHref={(p) => `/admin/users/${id}?spage=${p}${dpage > 1 ? `&dpage=${dpage}` : ""}`}
            />
          </>
        )}
      </section>

      {/* Alert deliveries */}
      <section>
        <div className="border-t hairline pt-5 mb-4 flex items-baseline justify-between">
          <h2 className="font-mono text-[11px] uppercase tracking-[0.18em] text-ink-faint">Emails sent</h2>
          {totalDeliveries > 0 && <span className="font-mono text-[10px] text-ink-faint">{totalDeliveries} total</span>}
        </div>
        {totalDeliveries === 0 ? (
          <EmptyNote>No emails sent yet.</EmptyNote>
        ) : (
          <>
            <ul className="divide-y divide-rule border-y border-rule">
              {deliveries.map((d) => (
                <li key={d.id} className="py-3 flex items-center justify-between gap-3">
                  <div className="min-w-0 flex-1">
                    <p className="font-mono text-xs text-ink truncate">{d.target}</p>
                    <p className="font-mono text-[10px] text-ink-faint mt-0.5">
                      {fmtTime(d.sent_at ?? d.created_at)}
                      {d.version && <span className="ml-2">v{d.version}</span>}
                    </p>
                  </div>
                  {d.grade && (
                    <span className="shrink-0 font-mono text-[10px] font-semibold px-1.5 py-0.5 text-parchment" style={{ backgroundColor: GRADE_COLOR[d.grade] ?? "#23201a" }}>
                      {d.grade}
                    </span>
                  )}
                </li>
              ))}
            </ul>
            <Pagination
              page={dpage}
              totalPages={dpageTotal}
              buildHref={(p) => `/admin/users/${id}?dpage=${p}${spage > 1 ? `&spage=${spage}` : ""}`}
            />
          </>
        )}
      </section>
    </main>
  );
}
