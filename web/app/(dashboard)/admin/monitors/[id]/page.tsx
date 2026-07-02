import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getSupabaseAdmin } from "@/lib/supabase";
import { EmptyNote } from "../../_components/ui";
import { Pagination } from "../../_components/Pagination";

export const dynamic = "force-dynamic";
export const revalidate = 0;
export const metadata: Metadata = { title: "Monitor · Admin", robots: { index: false } };

const PAGE_SIZE = 20;

const GRADE_COLOR: Record<string, string> = {
  A: "#2f5132", B: "#4f6b36", C: "#a86b19", D: "#b85024", F: "#7a1f2b",
};

function externalUrl(target: string, version?: string | null): string | null {
  if (target.startsWith("https://") || target.startsWith("http://")) return target;
  if (target.startsWith("npm/")) {
    const pkg = target.slice(4);
    return version ? `https://www.npmjs.com/package/${pkg}/v/${version}` : `https://www.npmjs.com/package/${pkg}`;
  }
  if (target.startsWith("pypi/")) {
    const pkg = target.slice(5);
    return version ? `https://pypi.org/project/${pkg}/${version}/` : `https://pypi.org/project/${pkg}`;
  }
  if (target.startsWith("github/")) return `https://github.com/${target.slice(7).split("#")[0]}`;
  return null;
}

function registryLabel(target: string): string {
  if (target.startsWith("npm/")) return "npm";
  if (target.startsWith("pypi/")) return "PyPI";
  if (target.startsWith("github/")) return "GitHub";
  if (target.startsWith("https://") || target.startsWith("http://")) return "URL";
  return "↗";
}

function fmt(date: string | null) {
  if (!date) return "—";
  return new Date(date).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}
function fmtTime(date: string | null) {
  if (!date) return "—";
  return new Date(date).toLocaleString("en-US", { month: "short", day: "numeric", year: "numeric", hour: "numeric", minute: "2-digit" });
}

async function fetchLatestVersion(target: string): Promise<string | null> {
  try {
    if (target.startsWith("npm/")) {
      const pkg = target.slice(4);
      const res = await fetch(`https://registry.npmjs.org/${encodeURIComponent(pkg).replace(/%2F/g, "/")}/latest`, { next: { revalidate: 300 } });
      if (!res.ok) return null;
      const data = await res.json() as { version?: string };
      return data.version ?? null;
    }
    if (target.startsWith("pypi/")) {
      const pkg = target.slice(5);
      const res = await fetch(`https://pypi.org/pypi/${pkg}/json`, { next: { revalidate: 300 } });
      if (!res.ok) return null;
      const data = await res.json() as { info?: { version?: string } };
      return data.info?.version ?? null;
    }
  } catch { /* ignore network errors */ }
  return null;
}

interface MonitorRow {
  id: string; user_id: string | null; email: string | null;
  unsubscribed_at: string | null; created_at: string;
  last_notified_grade: string | null; last_notified_at: string | null;
}
interface DeliveryRow {
  id: string; version: string | null; grade: string | null; sent_at: string | null; created_at: string;
}
interface GradeRow { grade: string | null; resolved_version: string | null; published_at: string | null; }

export default async function AdminMonitorDetailPage({
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

  const target = decodeURIComponent(id);

  const db = getSupabaseAdmin();
  if (!db) return <main className="max-w-4xl mx-auto px-8 py-12"><EmptyNote>Supabase not configured.</EmptyNote></main>;

  const [monitorsResult, gradesResult, usersResult, latestVersion] = await Promise.all([
    db.from("monitors")
      .select("id, user_id, email, unsubscribed_at, created_at, last_notified_grade, last_notified_at")
      .eq("target", target)
      .order("created_at", { ascending: false }),
    db.from("hosted_runs")
      .select("grade, resolved_version, published_at")
      .eq("target", target)
      .eq("status", "complete")
      .not("published_at", "is", null)
      .order("published_at", { ascending: false })
      .limit(10),
    db.auth.admin.listUsers({ perPage: 200 }),
    fetchLatestVersion(target),
  ]);

  const monitors = (monitorsResult.data ?? []) as MonitorRow[];
  if (monitors.length === 0) notFound();

  const grades = (gradesResult.data ?? []) as GradeRow[];
  const latestGrade = grades[0] ?? null;
  const users = usersResult.data?.users ?? [];
  const userMap = new Map(users.map((u) => [u.id, u]));

  const monitorIds = monitors.map((m) => m.id);

  // Deliveries: total count + paginated page
  const dOffset = (dpage - 1) * PAGE_SIZE;
  const [deliveriesCountResult, deliveriesPageResult] = await Promise.all([
    db.from("alert_deliveries")
      .select("id", { count: "exact", head: true })
      .in("monitor_id", monitorIds)
      .eq("status", "sent"),
    db.from("alert_deliveries")
      .select("id, version, grade, sent_at, created_at")
      .in("monitor_id", monitorIds)
      .eq("status", "sent")
      .order("sent_at", { ascending: false })
      .range(dOffset, dOffset + PAGE_SIZE - 1),
  ]);
  const totalDeliveries = deliveriesCountResult.count ?? 0;
  const deliveries = (deliveriesPageResult.data ?? []) as DeliveryRow[];
  const dpageTotal = Math.ceil(totalDeliveries / PAGE_SIZE);

  const active = monitors.filter((m) => !m.unsubscribed_at);
  const paused = monitors.filter((m) => m.unsubscribed_at);

  // Enrich all monitors with user data, then paginate in memory
  const enriched = monitors.map((m) => {
    const authUser = m.user_id ? userMap.get(m.user_id) : undefined;
    return {
      ...m,
      resolvedEmail: m.email ?? authUser?.email ?? null,
      name: (authUser?.user_metadata?.full_name ?? authUser?.user_metadata?.user_name ?? null) as string | null,
      provider: authUser?.app_metadata?.provider as string | undefined,
      githubUsername: authUser?.app_metadata?.provider === "github" ? (authUser?.user_metadata?.user_name as string | undefined) : undefined,
      userId: m.user_id,
    };
  });

  const spageTotal = Math.ceil(enriched.length / PAGE_SIZE);
  const subscribersPage = enriched.slice((spage - 1) * PAGE_SIZE, spage * PAGE_SIZE);

  return (
    <main className="max-w-4xl mx-auto px-8 py-12">
      {/* Back */}
      <a href="/admin/monitors" className="font-mono text-[11px] uppercase tracking-[0.16em] text-ink-faint hover:text-ink transition-colors">
        ← Monitors
      </a>

      {/* Header */}
      <div className="mt-6 mb-2">
        <div className="flex items-start gap-2">
          <h1 className="font-serif text-2xl text-ink break-all">{target}</h1>
          {externalUrl(target) && (
            <a href={externalUrl(target)!} target="_blank" rel="noopener noreferrer" className="mt-1.5 shrink-0 font-mono text-[10px] uppercase tracking-widest text-ink-faint hover:text-ink border hairline px-1.5 py-0.5 transition-colors">
              {registryLabel(target)} ↗
            </a>
          )}
        </div>
        <div className="flex items-center gap-3 mt-2">
          {latestGrade?.grade ? (
            <span
              className="font-mono text-sm font-semibold px-2 py-0.5 text-parchment"
              style={{ backgroundColor: GRADE_COLOR[latestGrade.grade] ?? "#23201a" }}
            >
              {latestGrade.grade}
            </span>
          ) : (
            <span className="font-mono text-xs text-ink-faint border hairline px-2 py-0.5">ungraded</span>
          )}
          {latestGrade?.resolved_version && (
            <span className="font-mono text-xs text-ink-muted">graded v{latestGrade.resolved_version}</span>
          )}
          {latestVersion && (
            <span className={`font-mono text-xs ${latestVersion !== latestGrade?.resolved_version ? "text-oxblood" : "text-ink-faint"}`}>
              latest v{latestVersion}
              {latestVersion !== latestGrade?.resolved_version && " · needs regrade"}
            </span>
          )}
          {latestGrade?.published_at && (
            <span className="font-mono text-xs text-ink-faint">{fmt(latestGrade.published_at)}</span>
          )}
        </div>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mt-8 mb-10">
        {[
          { label: "Active", value: String(active.length) },
          { label: "Paused", value: String(paused.length) },
          { label: "Total subscribers", value: String(monitors.length) },
          { label: "Emails sent", value: String(totalDeliveries) },
        ].map(({ label, value }) => (
          <div key={label} className="border hairline bg-parchment-50 p-4">
            <p className="font-mono text-[10px] uppercase tracking-[0.16em] text-ink-faint mb-1">{label}</p>
            <p className="font-serif text-2xl text-ink tabular">{value}</p>
          </div>
        ))}
      </div>

      {/* Subscribers */}
      <section className="mb-10">
        <div className="border-t hairline pt-5 mb-4 flex items-baseline justify-between">
          <h2 className="font-mono text-[11px] uppercase tracking-[0.18em] text-ink-faint">Subscribers</h2>
          {monitors.length > PAGE_SIZE && (
            <span className="font-mono text-[10px] text-ink-faint">{monitors.length} total</span>
          )}
        </div>
        <ul className="divide-y divide-rule border-y border-rule">
          {subscribersPage.map((m) => (
            <li key={m.id} className={`py-3 flex items-center justify-between gap-3 ${m.unsubscribed_at ? "opacity-50" : ""}`}>
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                  {m.userId ? (
                    <a href={`/admin/users/${m.userId}`} className="font-mono text-xs text-ink hover:text-oxblood transition-colors truncate">
                      {m.resolvedEmail ?? "—"}
                    </a>
                  ) : (
                    <p className="font-mono text-xs text-ink truncate">{m.resolvedEmail ?? "—"}</p>
                  )}
                  {m.githubUsername && (
                    <a href={`https://github.com/${m.githubUsername}`} target="_blank" rel="noopener noreferrer" className="shrink-0 font-mono text-[10px] text-ink-faint hover:text-ink transition-colors" title="GitHub profile">↗</a>
                  )}
                </div>
                <p className="font-mono text-[10px] text-ink-faint mt-0.5">
                  {m.provider && <span className="mr-2">{m.provider}</span>}
                  Added {fmt(m.created_at)}
                  {m.last_notified_at && (
                    <span className="ml-2">· last alerted {fmt(m.last_notified_at)}{m.last_notified_grade && ` (${m.last_notified_grade})`}</span>
                  )}
                </p>
              </div>
              {m.unsubscribed_at && (
                <span className="shrink-0 font-mono text-[10px] text-ink-faint border hairline px-1.5 py-0.5">paused</span>
              )}
            </li>
          ))}
        </ul>
        <Pagination
          page={spage}
          totalPages={spageTotal}
          buildHref={(p) => `/admin/monitors/${encodeURIComponent(target)}?spage=${p}${dpage > 1 ? `&dpage=${dpage}` : ""}`}
        />
      </section>

      {/* Grade history */}
      {grades.length > 0 && (
        <section className="mb-10">
          <div className="border-t hairline pt-5 mb-4">
            <h2 className="font-mono text-[11px] uppercase tracking-[0.18em] text-ink-faint">Grade history</h2>
          </div>
          <ul className="divide-y divide-rule border-y border-rule">
            {grades.map((g, i) => (
              <li key={i} className="py-3 flex items-center justify-between gap-3">
                <div className="flex items-center gap-3">
                  {g.grade ? (
                    <span className="font-mono text-[10px] font-semibold px-1.5 py-0.5 text-parchment" style={{ backgroundColor: GRADE_COLOR[g.grade] ?? "#23201a" }}>
                      {g.grade}
                    </span>
                  ) : (
                    <span className="font-mono text-[10px] text-ink-faint border hairline px-1.5 py-0.5">—</span>
                  )}
                  {g.resolved_version && (() => {
                    const vurl = externalUrl(target, g.resolved_version);
                    return vurl ? (
                      <a href={vurl} target="_blank" rel="noopener noreferrer" className="font-mono text-xs text-ink-muted hover:text-oxblood transition-colors">
                        v{g.resolved_version} ↗
                      </a>
                    ) : (
                      <span className="font-mono text-xs text-ink-muted">v{g.resolved_version}</span>
                    );
                  })()}
                </div>
                <span className="font-mono text-[11px] text-ink-faint tabular">{fmt(g.published_at)}</span>
              </li>
            ))}
          </ul>
        </section>
      )}

      {/* Alert deliveries */}
      <section>
        <div className="border-t hairline pt-5 mb-4 flex items-baseline justify-between">
          <h2 className="font-mono text-[11px] uppercase tracking-[0.18em] text-ink-faint">Alert deliveries</h2>
          {totalDeliveries > PAGE_SIZE && (
            <span className="font-mono text-[10px] text-ink-faint">{totalDeliveries} total</span>
          )}
        </div>
        {totalDeliveries === 0 ? (
          <EmptyNote>No alerts sent yet.</EmptyNote>
        ) : (
          <>
            <ul className="divide-y divide-rule border-y border-rule">
              {deliveries.map((d) => (
                <li key={d.id} className="py-3 flex items-center justify-between gap-3">
                  <div>
                    <p className="font-mono text-xs text-ink">{fmtTime(d.sent_at ?? d.created_at)}</p>
                    {d.version && <p className="font-mono text-[10px] text-ink-faint mt-0.5">v{d.version}</p>}
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
              buildHref={(p) => `/admin/monitors/${encodeURIComponent(target)}?dpage=${p}${spage > 1 ? `&spage=${spage}` : ""}`}
            />
          </>
        )}
      </section>
    </main>
  );
}
