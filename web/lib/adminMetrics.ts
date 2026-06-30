import "server-only";
import { getSupabaseAdmin } from "@/lib/supabase";
import { bucketByDay, tally, type DayBucket, type Bucket } from "@/lib/adminAggregate";

const WINDOW_DAYS = 30;

export interface Topline {
  waitlist: number;
  gradeRequests: number;
  gradeQueued: number;
  notify: number;
  notifyUnfulfilled: number;
  untrackedServers: number;
  attestations: number; // confirmed on-chain
  attestationsPending: number; // in-flight (tx sent, not yet confirmed)
}

export interface WaitlistMetrics {
  perDay: DayBucket[];
  byRole: Bucket[];
  bySource: Bucket[];
  recent: { email: string; role: string | null; source: string | null; first_seen_at: string }[];
}

export interface GradeRequestMetrics {
  perDay: DayBucket[];
  byStatus: Bucket[];
  demand: Bucket[]; // targets ranked by request rows (one row per distinct requester, by the unique index)
  recent: { target: string; target_kind: string; status: string; requested_at: string }[];
}

export interface NotifyMetrics {
  perDay: DayBucket[];
  topServers: Bucket[];
  fulfilled: number;
  unfulfilled: number;
}

export interface UntrackedRow {
  server_ref: string;
  request_count: number;
  first_seen_at: string;
  last_seen_at: string;
}

async function countOf(
  table: string,
  refine?: (q: any) => any,
): Promise<number> {
  const db = getSupabaseAdmin();
  if (!db) return 0;
  let q = db.from(table).select("*", { count: "exact", head: true });
  if (refine) q = refine(q);
  const { count, error } = await q;
  if (error) {
    console.error(`[admin] count ${table} failed:`, error.message);
    return 0;
  }
  return count ?? 0;
}

export async function getTopline(): Promise<Topline> {
  const [
    waitlist,
    gradeRequests,
    gradeQueued,
    notify,
    notifyUnfulfilled,
    untrackedServers,
    attestations,
    attestationsPending,
  ] = await Promise.all([
    countOf("waitlist_signups"),
    countOf("grade_requests"),
    countOf("grade_requests", (q) => q.eq("status", "queued")),
    countOf("notify_requests"),
    countOf("notify_requests", (q) => q.is("fulfilled_at", null)),
    countOf("untracked_demand"),
    countOf("grade_attestations", (q) => q.eq("status", "confirmed")),
    countOf("grade_attestations", (q) => q.eq("status", "pending")),
  ]);
  return {
    waitlist,
    gradeRequests,
    gradeQueued,
    notify,
    notifyUnfulfilled,
    untrackedServers,
    attestations,
    attestationsPending,
  };
}

const today = () => new Date();

export async function getWaitlistMetrics(): Promise<WaitlistMetrics | null> {
  const db = getSupabaseAdmin();
  if (!db) return null;
  const { data, error } = await db
    .from("waitlist_signups")
    .select("email, role, source, first_seen_at")
    .order("first_seen_at", { ascending: false });
  if (error) {
    console.error("[admin] waitlist fetch failed:", error.message);
    return null;
  }
  const rows = (data ?? []) as WaitlistMetrics["recent"];
  return {
    perDay: bucketByDay(rows.map((r) => r.first_seen_at), WINDOW_DAYS, today()),
    byRole: tally(rows.map((r) => r.role)),
    bySource: tally(rows.map((r) => r.source)),
    recent: rows.slice(0, 12),
  };
}

export async function getGradeRequestMetrics(): Promise<GradeRequestMetrics | null> {
  const db = getSupabaseAdmin();
  if (!db) return null;
  const { data, error } = await db
    .from("grade_requests")
    .select("target, target_kind, status, requested_at")
    .order("requested_at", { ascending: false });
  if (error) {
    console.error("[admin] grade_requests fetch failed:", error.message);
    return null;
  }
  const rows = (data ?? []) as GradeRequestMetrics["recent"];
  return {
    perDay: bucketByDay(rows.map((r) => r.requested_at), WINDOW_DAYS, today()),
    byStatus: tally(rows.map((r) => r.status)),
    demand: tally(rows.map((r) => r.target), "—", 10),
    recent: rows.slice(0, 12),
  };
}

export async function getNotifyMetrics(): Promise<NotifyMetrics | null> {
  const db = getSupabaseAdmin();
  if (!db) return null;
  const { data, error } = await db
    .from("notify_requests")
    .select("server_ref, requested_at, fulfilled_at");
  if (error) {
    console.error("[admin] notify fetch failed:", error.message);
    return null;
  }
  const rows = (data ?? []) as {
    server_ref: string;
    requested_at: string;
    fulfilled_at: string | null;
  }[];
  const fulfilled = rows.filter((r) => r.fulfilled_at != null).length;
  return {
    perDay: bucketByDay(rows.map((r) => r.requested_at), WINDOW_DAYS, today()),
    topServers: tally(rows.map((r) => r.server_ref), "—", 10),
    fulfilled,
    unfulfilled: rows.length - fulfilled,
  };
}

export async function getUntrackedDemand(): Promise<UntrackedRow[] | null> {
  const db = getSupabaseAdmin();
  if (!db) return null;
  const { data, error } = await db
    .from("untracked_demand")
    .select("server_ref, request_count, first_seen_at, last_seen_at")
    .order("request_count", { ascending: false })
    .limit(20);
  if (error) {
    console.error("[admin] untracked_demand fetch failed:", error.message);
    return null;
  }
  return (data ?? []) as UntrackedRow[];
}
