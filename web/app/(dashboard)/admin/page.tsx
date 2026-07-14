import type { Metadata } from "next";
import {
  getTopline,
  getWaitlistMetrics,
  getGradeRequestMetrics,
  getNotifyMetrics,
  getUntrackedDemand,
  getLookupStats,
  getAgentMetrics,
} from "@/lib/adminMetrics";
import { getSupabaseAdmin } from "@/lib/supabase";
import { getPriorityLane } from "@/lib/priorityPayments";
import { Panel, KpiCard, MiniBars, BarList, EmptyNote, RecentList } from "./_components/ui";

async function getUserCount() {
  const db = getSupabaseAdmin();
  if (!db) return { users: 0, activeMonitors: 0 };
  const [usersResult, monitorsResult] = await Promise.all([
    db.auth.admin.listUsers({ perPage: 1 }),
    db.from("monitors").select("id", { count: "exact", head: true }).is("unsubscribed_at", null),
  ]);
  return {
    users: (usersResult.data as { total?: number } | null)?.total ?? 0,
    activeMonitors: monitorsResult.count ?? 0,
  };
}

export const dynamic = "force-dynamic";
export const revalidate = 0;
export const metadata: Metadata = { title: "Admin", robots: { index: false } };

export default async function AdminPage() {
  const [top, waitlist, grades, priorityLane, notify, untracked, lookups, agents, userCount] =
    await Promise.all([
      getTopline(),
      getWaitlistMetrics(),
      getGradeRequestMetrics(),
      getPriorityLane(),
      getNotifyMetrics(),
      getUntrackedDemand(),
      getLookupStats(),
      getAgentMetrics(),
      getUserCount(),
    ]);

  const now = Date.now();

  return (
    <main className="w-full px-8 py-12">
      <div className="mb-8">
        <p className="section-label mb-1">Internal</p>
        <h1 className="font-serif text-2xl text-ink">Usage metrics</h1>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-2 md:grid-cols-3 gap-3 mb-10">
        <KpiCard label="Waitlist" value={top.waitlist} />
        <KpiCard label="Grade requests" value={top.gradeRequests} sub={`${top.gradeQueued} queued`} />
        <KpiCard label="Notify requests" value={top.notify} sub={`${top.notifyUnfulfilled} unfulfilled`} />
        <KpiCard label="Untracked servers" value={top.untrackedServers} />
        <KpiCard
          label="CLI lookups"
          value={lookups?.totalLookups ?? 0}
          sub={
            lookups && lookups.hitRate !== null
              ? `${Math.round(lookups.hitRate * 100)}% hit rate`
              : "no lookups yet"
          }
        />
        <KpiCard label="Agents seen" value={agents?.totalAgents ?? 0} sub="distinct client builds" />
        <KpiCard label="Attestations" value={top.attestations} sub={`${top.attestationsPending} pending · on-chain`} />
        <KpiCard label="Auth users" value={userCount.users} sub={`${userCount.activeMonitors} active monitors`} />
      </div>

      <div className="grid gap-6 md:grid-cols-2">
        {/* Waitlist */}
        <Panel
          label="§1"
          title="Waitlist"
          note="New emails per day (last 30d), by first_seen_at. Repeat submits count once."
        >
          {waitlist ? (
            <div className="space-y-5">
              <MiniBars data={waitlist.perDay} />
              <div>
                <p className="section-label mb-2">By role</p>
                <BarList data={waitlist.byRole} />
              </div>
              <div>
                <p className="section-label mb-2">By source</p>
                <BarList data={waitlist.bySource} />
              </div>
              <div>
                <p className="section-label mb-2">Recent</p>
                <RecentList
                  rows={waitlist.recent.map((r) => ({
                    primary: r.email,
                    secondary: r.role ?? undefined,
                    meta: r.first_seen_at.slice(0, 10),
                  }))}
                  empty="No signups yet."
                />
              </div>
            </div>
          ) : (
            <EmptyNote>No waitlist data (or Supabase not configured).</EmptyNote>
          )}
        </Panel>

        {/* Grade requests */}
        <Panel label="§2" title="Grade-request queue" note="Requests per day (last 30d).">
          {grades ? (
            <div className="space-y-5">
              {priorityLane.length > 0 ? (
                <div className="border border-oxblood/30 rounded-[4px] p-3">
                  <p className="section-label mb-2 text-oxblood">
                    Priority lane · 48h SLA ({priorityLane.length})
                  </p>
                  <div className="space-y-1.5">
                    {priorityLane.map((r) => {
                      const deadline = new Date(r.priority_deadline_at).getTime();
                      const overdue = deadline <= now;
                      const hrsLeft = Math.round((deadline - now) / 3_600_000);
                      return (
                        <div
                          key={r.id}
                          className="flex items-baseline justify-between gap-3 font-mono text-[11px]"
                        >
                          <span className="min-w-0 truncate text-ink">{r.target}</span>
                          <span
                            className={`shrink-0 tabular ${overdue ? "text-oxblood font-semibold" : "text-ink-faint"}`}
                          >
                            {overdue ? "OVERDUE" : `${hrsLeft}h left`}
                          </span>
                        </div>
                      );
                    })}
                  </div>
                </div>
              ) : null}
              <MiniBars data={grades.perDay} />
              <div>
                <p className="section-label mb-2">By status</p>
                <BarList data={grades.byStatus} />
              </div>
              <div>
                <p className="section-label mb-2">Demand leaderboard</p>
                <BarList data={grades.demand} empty="No requests yet." />
              </div>
              <div>
                <p className="section-label mb-2">Recent</p>
                <RecentList
                  rows={grades.recent.map((r) => ({
                    primary: r.target,
                    secondary: r.status,
                    meta: r.requested_at.slice(0, 10),
                  }))}
                  empty="No requests yet."
                />
              </div>
            </div>
          ) : (
            <EmptyNote>No grade-request data (or Supabase not configured).</EmptyNote>
          )}
        </Panel>

        {/* Notify funnel */}
        <Panel label="§3" title="Notify funnel" note="Requests per day (last 30d).">
          {notify ? (
            <div className="space-y-5">
              <MiniBars data={notify.perDay} />
              <p className="text-sm text-ink-muted tabular">
                {notify.fulfilled} fulfilled · {notify.unfulfilled} unfulfilled
              </p>
              <div>
                <p className="section-label mb-2">Top servers</p>
                <BarList data={notify.topServers} empty="No notify requests yet." />
              </div>
            </div>
          ) : (
            <EmptyNote>No notify data (or Supabase not configured).</EmptyNote>
          )}
        </Panel>

        {/* Untracked demand */}
        <Panel
          label="§4"
          title="Untracked demand"
          note="CLI checks for servers we don't grade yet. Counter — no time-series."
        >
          {untracked ? (
            untracked.length === 0 ? (
              <EmptyNote>No untracked demand recorded yet.</EmptyNote>
            ) : (
              <BarList
                data={untracked.map((r) => ({ key: r.server_ref, count: r.request_count }))}
              />
            )
          ) : (
            <EmptyNote>No untracked-demand data (or Supabase not configured).</EmptyNote>
          )}
        </Panel>

        {/* Lookup activity */}
        <Panel
          label="§5"
          title="Lookup activity"
          note="Every /api/cli/check — hits (a graded server) vs misses. Counter — no time-series."
        >
          {lookups && lookups.totalLookups > 0 ? (
            <div className="space-y-5">
              <p className="text-sm text-ink-muted tabular">
                {lookups.totalLookups} lookups · {lookups.hits} hits · {lookups.misses} misses
                {lookups.hitRate !== null
                  ? ` · ${Math.round(lookups.hitRate * 100)}% hit rate`
                  : ""}
              </p>
              <div>
                <p className="section-label mb-2">Most-checked servers</p>
                <BarList
                  data={lookups.topServers.map((s) => ({ key: s.server_ref, count: s.total }))}
                  empty="No lookups yet."
                />
              </div>
            </div>
          ) : (
            <EmptyNote>No lookups recorded yet.</EmptyNote>
          )}
        </Panel>

        {/* Agents */}
        <Panel
          label="§6"
          title="Agents"
          note="Who calls /api/cli — MCP clients by handshake identity, CLI, and raw callers by User-Agent. Calls per day (last 30d)."
        >
          {agents && agents.totalAgents > 0 ? (
            <div className="space-y-5">
              <MiniBars data={agents.activity.perDay} />
              <div>
                <p className="section-label mb-2">By agent</p>
                <BarList data={agents.activity.byAgent} empty="No agent activity yet." />
              </div>
              <div>
                <p className="section-label mb-2">By endpoint</p>
                <BarList data={agents.activity.byEndpoint} empty="No agent activity yet." />
              </div>
              <div>
                <p className="section-label mb-2">Recently seen</p>
                <RecentList
                  rows={agents.agents.map((a) => ({
                    primary: a.version ? `${a.name} ${a.version}` : a.name,
                    secondary:
                      a.meta?.capabilities?.join(" · ") ?? a.meta?.title ?? a.source,
                    meta: a.last_seen_at.slice(0, 10),
                  }))}
                  empty="No agents seen yet."
                />
              </div>
            </div>
          ) : (
            <EmptyNote>No agents recorded yet.</EmptyNote>
          )}
        </Panel>
      </div>

    </main>
  );
}
