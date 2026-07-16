import "server-only";
import { getSupabaseAdmin } from "@/lib/supabase";
import {
  sumByDay,
  sumByKey,
  shortWallet,
  SURFACE_LABEL,
  type RevenueEntry,
} from "@/lib/revenueAggregate";
import type { DayBucket, Bucket } from "@/lib/adminAggregate";

const WINDOW_DAYS = 30;

/**
 * Normalize the three payment tables into one buy stream. Amounts are `numeric`
 * columns — supabase-js hands them back as strings, so every one goes through
 * Number(). Slug / target labels come from a to-one embed on the owning row.
 * Returns [] when Supabase is unconfigured or any table read fails (each surface
 * degrades independently so one bad table doesn't blank the whole dashboard).
 */
export async function getRevenueEntries(): Promise<RevenueEntry[]> {
  const db = getSupabaseAdmin();
  if (!db) return [];

  const [eco, plan, prio] = await Promise.all([
    db
      .from("ecosystem_payments")
      .select("usd_total, usd_monthly, status, payer_address, verified_at, end_at, ecosystems(slug)"),
    db
      .from("user_plan_payments")
      .select("plan, usd_total, usd_monthly, status, payer_address, verified_at, end_at, user_id"),
    db
      .from("grade_request_payments")
      .select("usd_price, status, payer_address, paid_at, grade_requests(target, email)")
      .eq("status", "paid"),
  ]);

  if (eco.error) console.error("[admin] ecosystem_payments fetch failed:", eco.error.message);
  if (plan.error) console.error("[admin] user_plan_payments fetch failed:", plan.error.message);
  if (prio.error) console.error("[admin] grade_request_payments fetch failed:", prio.error.message);

  const num = (v: unknown): number => {
    const n = Number(v);
    return Number.isFinite(n) ? n : 0;
  };
  // A to-one embed is an object, but PostgREST can surface it as a 1-element array.
  const embedded = <T>(rel: unknown): T | null =>
    Array.isArray(rel) ? ((rel[0] as T) ?? null) : ((rel as T) ?? null);

  const ecoEntries: RevenueEntry[] = (eco.data ?? []).map((r: any) => ({
    surface: "ecosystem",
    label: embedded<{ slug: string }>(r.ecosystems)?.slug ?? "—",
    usd: num(r.usd_total),
    monthly: r.usd_monthly != null ? num(r.usd_monthly) : null,
    at: r.verified_at,
    endAt: r.end_at ?? null,
    payer: r.payer_address ?? null,
    userId: null, // ecosystem streams are wallet-only — not tied to a user
    userEmail: null,
    status: r.status,
    recurring: true,
  }));

  const planEntries: RevenueEntry[] = (plan.data ?? []).map((r: any) => ({
    surface: r.plan === "team" ? "team" : "indie",
    label: "",
    usd: num(r.usd_total),
    monthly: r.usd_monthly != null ? num(r.usd_monthly) : null,
    at: r.verified_at,
    endAt: r.end_at ?? null,
    payer: r.payer_address ?? null,
    userId: r.user_id ?? null,
    userEmail: null, // filled by resolveUsers()
    status: r.status,
    recurring: true,
  }));

  const prioEntries: RevenueEntry[] = (prio.data ?? []).map((r: any) => ({
    surface: "priority",
    label: embedded<{ target: string; email: string | null }>(r.grade_requests)?.target ?? "—",
    usd: num(r.usd_price),
    monthly: null,
    at: r.paid_at,
    endAt: null,
    payer: r.payer_address ?? null,
    userId: null, // filled by resolveUsers() from the request email
    userEmail: embedded<{ target: string; email: string | null }>(r.grade_requests)?.email ?? null,
    status: r.status,
    recurring: false,
  }));

  return [...ecoEntries, ...planEntries, ...prioEntries];
}

/**
 * Fill in the missing half of each entry's user identity: plan buys know their
 * user_id but not the email; priority buys know the request email but not the
 * user_id. One listUsers pass builds both maps. Capped at 1000 users (pre-traction
 * scale) — beyond that, some attributions silently fall back to wallet display.
 */
async function resolveUsers(entries: RevenueEntry[]): Promise<RevenueEntry[]> {
  const db = getSupabaseAdmin();
  if (!db) return entries;
  const { data, error } = await db.auth.admin.listUsers({ page: 1, perPage: 1000 });
  if (error) {
    console.error("[admin] listUsers for revenue attribution failed:", error.message);
    return entries;
  }
  const idToEmail = new Map<string, string>();
  const emailToId = new Map<string, string>();
  for (const u of data?.users ?? []) {
    if (u.email) {
      idToEmail.set(u.id, u.email);
      emailToId.set(u.email.toLowerCase(), u.id);
    }
  }
  for (const e of entries) {
    if (e.userId && !e.userEmail) e.userEmail = idToEmail.get(e.userId) ?? null;
    if (!e.userId && e.userEmail) e.userId = emailToId.get(e.userEmail.toLowerCase()) ?? null;
  }
  return entries;
}

export interface RevenueMetrics {
  /** All-time booked cash across every surface. */
  totalBooked: number;
  /** Booked this UTC calendar month. */
  bookedThisMonth: number;
  /** Booked $ per day over the last WINDOW_DAYS (dollars in `count`). */
  bookedPerDay: DayBucket[];
  /** Monthly recurring revenue: sum of `monthly` across still-active streams. */
  mrr: number;
  activeSubs: { ecosystem: number; indie: number; team: number; total: number };
  /** Count of paid priority grades (all-time). */
  prioritySold: number;
  /** Booked $ by surface (all-time). */
  bySurface: Bucket[];
  /** Booked $ by paying wallet, top 10. */
  topPayers: Bucket[];
  churn: { lostMrr: number; count: number; recent: RevenueEntry[] };
  /** Latest buys across all surfaces, newest first. */
  recentBuys: RevenueEntry[];
}

const at = (e: RevenueEntry): number => {
  const t = new Date(e.at).getTime();
  return Number.isNaN(t) ? 0 : t;
};

export async function getRevenueMetrics(): Promise<RevenueMetrics | null> {
  const db = getSupabaseAdmin();
  if (!db) return null;

  const entries = await resolveUsers(await getRevenueEntries());
  const now = new Date();
  const nowMs = now.getTime();

  const isActive = (e: RevenueEntry) =>
    e.recurring && e.status === "active" && e.endAt != null && new Date(e.endAt).getTime() > nowMs;
  const isChurned = (e: RevenueEntry) =>
    e.recurring && (e.status === "canceled" || e.status === "ended");

  const totalBooked = Math.round(entries.reduce((s, e) => s + e.usd, 0));

  const monthStartMs = Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1);
  const bookedThisMonth = Math.round(
    entries.filter((e) => at(e) >= monthStartMs).reduce((s, e) => s + e.usd, 0),
  );

  const bookedPerDay = sumByDay(entries, WINDOW_DAYS, now);

  const active = entries.filter(isActive);
  const mrr = Math.round(active.reduce((s, e) => s + (e.monthly ?? 0), 0));
  const activeSubs = {
    ecosystem: active.filter((e) => e.surface === "ecosystem").length,
    indie: active.filter((e) => e.surface === "indie").length,
    team: active.filter((e) => e.surface === "team").length,
    total: active.length,
  };

  const prioritySold = entries.filter((e) => e.surface === "priority").length;

  const bySurface = sumByKey(entries, (e) => SURFACE_LABEL[e.surface]);
  const topPayers = sumByKey(
    entries.filter((e) => e.payer),
    (e) => shortWallet(e.payer as string),
    10,
  );

  const churned = entries.filter(isChurned);
  const churn = {
    lostMrr: Math.round(churned.reduce((s, e) => s + (e.monthly ?? 0), 0)),
    count: churned.length,
    recent: [...churned].sort((a, b) => at(b) - at(a)).slice(0, 10),
  };

  const recentBuys = [...entries].sort((a, b) => at(b) - at(a)).slice(0, 20);

  return {
    totalBooked,
    bookedThisMonth,
    bookedPerDay,
    mrr,
    activeSubs,
    prioritySold,
    bySurface,
    topPayers,
    churn,
    recentBuys,
  };
}

/**
 * Every buy attributable to one user, newest first — the Pro-plan streams keyed
 * by user_id plus the priority grades whose request carries this user's email.
 * (Ecosystem streams are wallet-only and can't be attributed to a user.)
 * Returns [] on misconfig / read failure.
 */
export async function getUserPayments(
  userId: string,
  email: string | null,
): Promise<RevenueEntry[]> {
  const db = getSupabaseAdmin();
  if (!db) return [];

  const num = (v: unknown): number => {
    const n = Number(v);
    return Number.isFinite(n) ? n : 0;
  };

  const planQuery = db
    .from("user_plan_payments")
    .select("plan, usd_total, usd_monthly, status, payer_address, verified_at, end_at")
    .eq("user_id", userId);

  // Priority buys are keyed to the user by the request email. Resolve the user's
  // request ids first, then their paid receipts.
  const reqQuery = email
    ? db.from("grade_requests").select("id, target").eq("email", email)
    : Promise.resolve({ data: [] as { id: string; target: string }[], error: null });

  const [planRes, reqRes] = await Promise.all([planQuery, reqQuery]);

  if (planRes.error) console.error("[admin] user plan payments fetch failed:", planRes.error.message);
  if ("error" in reqRes && reqRes.error) {
    console.error("[admin] user grade_requests fetch failed:", reqRes.error.message);
  }

  const planEntries: RevenueEntry[] = (planRes.data ?? []).map((r: any) => ({
    surface: r.plan === "team" ? "team" : "indie",
    label: "",
    usd: num(r.usd_total),
    monthly: r.usd_monthly != null ? num(r.usd_monthly) : null,
    at: r.verified_at,
    endAt: r.end_at ?? null,
    payer: r.payer_address ?? null,
    userId,
    userEmail: email,
    status: r.status,
    recurring: true,
  }));

  const reqs = (reqRes.data ?? []) as { id: string; target: string }[];
  const targetById = new Map(reqs.map((r) => [r.id, r.target]));
  let prioEntries: RevenueEntry[] = [];
  if (reqs.length > 0) {
    const { data, error } = await db
      .from("grade_request_payments")
      .select("usd_price, status, payer_address, paid_at, grade_request_id")
      .in("grade_request_id", reqs.map((r) => r.id))
      .eq("status", "paid");
    if (error) console.error("[admin] user priority payments fetch failed:", error.message);
    prioEntries = (data ?? []).map((r: any) => ({
      surface: "priority",
      label: targetById.get(r.grade_request_id) ?? "—",
      usd: num(r.usd_price),
      monthly: null,
      at: r.paid_at,
      endAt: null,
      payer: r.payer_address ?? null,
      userId,
      userEmail: email,
      status: r.status,
      recurring: false,
    }));
  }

  return [...planEntries, ...prioEntries].sort((a, b) => {
    const ta = new Date(a.at).getTime() || 0;
    const tb = new Date(b.at).getTime() || 0;
    return tb - ta;
  });
}
