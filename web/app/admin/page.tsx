import type { Metadata } from "next";
import {
  getTopline,
  getWaitlistMetrics,
  getGradeRequestMetrics,
  getNotifyMetrics,
  getUntrackedDemand,
} from "@/lib/adminMetrics";
import { Panel, KpiCard, MiniBars, BarList, EmptyNote, RecentList } from "./_components/ui";

export const dynamic = "force-dynamic";
export const revalidate = 0;
export const metadata: Metadata = { title: "Admin", robots: { index: false } };

export default async function AdminPage() {
  const [top, waitlist, grades, notify, untracked] = await Promise.all([
    getTopline(),
    getWaitlistMetrics(),
    getGradeRequestMetrics(),
    getNotifyMetrics(),
    getUntrackedDemand(),
  ]);

  return (
    <main className="mx-auto w-full max-w-5xl px-6 py-12">
      <div className="mb-8">
        <p className="section-label mb-1">Internal</p>
        <h1 className="font-serif text-2xl text-ink">Usage metrics</h1>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-2 md:grid-cols-3 gap-3 mb-10">
        <KpiCard label="Waitlist" value={top.waitlist} />
        <KpiCard
          label="Grade requests"
          value={top.gradeRequests}
          sub={`${top.gradeQueued} queued`}
        />
        <KpiCard
          label="Notify requests"
          value={top.notify}
          sub={`${top.notifyUnfulfilled} unfulfilled`}
        />
        <KpiCard label="Untracked servers" value={top.untrackedServers} />
        <KpiCard
          label="Attestations"
          value={top.attestations}
          sub={`${top.attestationsPending} pending · on-chain`}
        />
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
      </div>
    </main>
  );
}
