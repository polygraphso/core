/**
 * Server-side aggregation for the /admin dashboard. All queries hit
 * Supabase with the service-role key. Designed to be called from server
 * components (initial render) and from /api/admin/metrics (refresh).
 *
 * Each metric is fetched independently and tolerates failure — one
 * dead source shouldn't blank the whole dashboard. Returned as nullable
 * fields with an `errors` list the UI can surface.
 */

import type { SupabaseClient } from "@supabase/supabase-js";
import { getSupabase } from "./supabase-server";

export interface NpmPackageStats {
  package: string;
  last_7d: number | null;
  last_30d: number | null;
  all_time: number | null;
}

export interface ApiRouteCount {
  route: string;
  count_24h: number;
  count_7d: number;
  count_30d: number;
}

export interface RescoreStatus {
  /** null = no scoring run has ever been recorded. */
  last: null | {
    run_id: string;
    status: "running" | "completed" | "failed" | "queued";
    started_at: string;
    finished_at: string | null;
    error_message: string | null;
  };
  in_progress: boolean;
}

export interface AdminMetrics {
  generated_at: string;
  servers: {
    total: number | null;
    by_registry: Array<{ registry: string; count: number }>;
    by_tier: Array<{ tier: string | null; count: number }>;
  };
  npm: NpmPackageStats[];
  /** When the source isn't wired the field is null and `errors` carries the note. */
  email_subscriptions: { total: number; source: "waitlist_signups" } | null;
  api_calls: {
    total_24h: number;
    total_7d: number;
    total_30d: number;
    per_route: ApiRouteCount[];
  };
  rescore: RescoreStatus;
  errors: string[];
}

const NPM_PACKAGES_FALLBACK = ["polygraphso", "@polygraphso/mcp"];

interface Window {
  ms: number;
  label: "24h" | "7d" | "30d";
}

const WINDOWS: Window[] = [
  { label: "24h", ms: 24 * 60 * 60 * 1000 },
  { label: "7d", ms: 7 * 24 * 60 * 60 * 1000 },
  { label: "30d", ms: 30 * 24 * 60 * 60 * 1000 },
];

async function fetchServersAggregate(
  supabase: SupabaseClient,
  errors: string[],
): Promise<AdminMetrics["servers"]> {
  const out: AdminMetrics["servers"] = {
    total: null,
    by_registry: [],
    by_tier: [],
  };

  const { count, error: countErr } = await supabase
    .from("servers")
    .select("id", { count: "exact", head: true });
  if (countErr) errors.push(`servers count: ${countErr.message}`);
  else out.total = count ?? 0;

  const { data: rows, error: rowsErr } = await supabase
    .from("servers")
    .select("registry, latest_version_id");
  if (rowsErr) {
    errors.push(`servers breakdown: ${rowsErr.message}`);
    return out;
  }

  const byReg = new Map<string, number>();
  const versionIds: string[] = [];
  for (const r of rows ?? []) {
    const reg = (r.registry as string) ?? "unknown";
    byReg.set(reg, (byReg.get(reg) ?? 0) + 1);
    if (r.latest_version_id) versionIds.push(r.latest_version_id as string);
  }
  out.by_registry = [...byReg.entries()]
    .map(([registry, count]) => ({ registry, count }))
    .sort((a, b) => a.registry.localeCompare(b.registry));

  // Tier breakdown — latest adoption_scores row per version.
  if (versionIds.length > 0) {
    const { data: scores, error: scoresErr } = await supabase
      .from("adoption_scores")
      .select("version_id, tier, computed_at")
      .in("version_id", versionIds)
      .order("computed_at", { ascending: false });
    if (scoresErr) {
      errors.push(`adoption_scores: ${scoresErr.message}`);
    } else {
      const latest = new Map<string, string | null>();
      for (const row of scores ?? []) {
        const vid = row.version_id as string;
        if (latest.has(vid)) continue;
        latest.set(vid, (row.tier as string | null) ?? null);
      }
      const byTier = new Map<string | null, number>();
      // Initialise so "no score" shows up explicitly.
      const ungraded = versionIds.length - latest.size;
      if (ungraded > 0) byTier.set(null, ungraded);
      for (const tier of latest.values()) {
        byTier.set(tier, (byTier.get(tier) ?? 0) + 1);
      }
      const order = ["top10", "top25", "top50", "top100", null];
      out.by_tier = order
        .filter((t) => byTier.has(t))
        .map((t) => ({ tier: t, count: byTier.get(t) ?? 0 }));
    }
  }

  return out;
}

async function fetchNpm(
  packages: string[],
  errors: string[],
): Promise<NpmPackageStats[]> {
  // npm downloads API: /downloads/range/{period}/{package} returns daily
  // counts; /point/{period}/{package} returns a single total. We use point
  // for last-week/last-month and roll our own all-time via /range and
  // summing — npm's "all" period is not supported on the public API, so
  // we ask for the maximum sensible window (since 2015) and sum days.
  // Public, no auth, no key.
  const today = new Date();
  const isoDay = (d: Date) => d.toISOString().slice(0, 10);
  const lastWeekStart = new Date(today.getTime() - 7 * 86400000);
  const lastMonthStart = new Date(today.getTime() - 30 * 86400000);
  const allTimeStart = "2015-01-10"; // npm download counts start ~2015.

  const results = await Promise.all(
    packages.map(async (pkg): Promise<NpmPackageStats> => {
      const enc = encodeURIComponent(pkg);
      const fetchPoint = async (start: string, end: string): Promise<number | null> => {
        const url = `https://api.npmjs.org/downloads/point/${start}:${end}/${enc}`;
        try {
          const res = await fetch(url, { cache: "no-store" });
          if (!res.ok) {
            if (res.status === 404) return 0; // package exists but no downloads in window
            errors.push(`npm ${pkg} ${start}:${end}: ${res.status}`);
            return null;
          }
          const body = (await res.json()) as { downloads?: number };
          return typeof body.downloads === "number" ? body.downloads : null;
        } catch (err) {
          errors.push(
            `npm ${pkg} fetch: ${err instanceof Error ? err.message : String(err)}`,
          );
          return null;
        }
      };
      const todayStr = isoDay(today);
      const [last7d, last30d, allTime] = await Promise.all([
        fetchPoint(isoDay(lastWeekStart), todayStr),
        fetchPoint(isoDay(lastMonthStart), todayStr),
        fetchPoint(allTimeStart, todayStr),
      ]);
      return { package: pkg, last_7d: last7d, last_30d: last30d, all_time: allTime };
    }),
  );
  return results;
}

async function fetchEmailSubs(
  supabase: SupabaseClient,
  errors: string[],
): Promise<AdminMetrics["email_subscriptions"]> {
  const { count, error } = await supabase
    .from("waitlist_signups")
    .select("id", { count: "exact", head: true });
  if (error) {
    errors.push(`waitlist_signups: ${error.message}`);
    return null;
  }
  return { total: count ?? 0, source: "waitlist_signups" };
}

async function fetchApiCalls(
  supabase: SupabaseClient,
  errors: string[],
): Promise<AdminMetrics["api_calls"]> {
  const empty: AdminMetrics["api_calls"] = {
    total_24h: 0,
    total_7d: 0,
    total_30d: 0,
    per_route: [],
  };

  const counts = await Promise.all(
    WINDOWS.map(async (w) => {
      const since = new Date(Date.now() - w.ms).toISOString();
      const { count, error } = await supabase
        .from("api_logs")
        .select("id", { count: "exact", head: true })
        .gte("requested_at", since);
      if (error) {
        errors.push(`api_logs total ${w.label}: ${error.message}`);
        return null;
      }
      return count ?? 0;
    }),
  );
  empty.total_24h = counts[0] ?? 0;
  empty.total_7d = counts[1] ?? 0;
  empty.total_30d = counts[2] ?? 0;

  // Per-route counts. Pulled in three queries (one per window) and
  // aggregated in JS to keep the schema simple — fine at our volume.
  const since24 = new Date(Date.now() - WINDOWS[0].ms).toISOString();
  const since7 = new Date(Date.now() - WINDOWS[1].ms).toISOString();
  const since30 = new Date(Date.now() - WINDOWS[2].ms).toISOString();

  const aggregateByRoute = async (
    since: string,
    label: string,
  ): Promise<Map<string, number>> => {
    const m = new Map<string, number>();
    // Cap rows to keep this from runaway scanning if api_logs grows large;
    // 50k rows is fine in a single response at v0 traffic.
    const { data, error } = await supabase
      .from("api_logs")
      .select("route")
      .gte("requested_at", since)
      .limit(50000);
    if (error) {
      errors.push(`api_logs per-route ${label}: ${error.message}`);
      return m;
    }
    for (const row of data ?? []) {
      const r = row.route as string;
      m.set(r, (m.get(r) ?? 0) + 1);
    }
    return m;
  };

  const [m24, m7, m30] = await Promise.all([
    aggregateByRoute(since24, "24h"),
    aggregateByRoute(since7, "7d"),
    aggregateByRoute(since30, "30d"),
  ]);

  const routeSet = new Set<string>();
  for (const m of [m24, m7, m30]) for (const k of m.keys()) routeSet.add(k);
  empty.per_route = [...routeSet]
    .map((route) => ({
      route,
      count_24h: m24.get(route) ?? 0,
      count_7d: m7.get(route) ?? 0,
      count_30d: m30.get(route) ?? 0,
    }))
    .sort((a, b) => b.count_30d - a.count_30d || a.route.localeCompare(b.route));

  return empty;
}

async function fetchRescoreStatus(
  supabase: SupabaseClient,
  errors: string[],
): Promise<RescoreStatus> {
  // Latest orchestrator-level scoring run (version_id IS NULL).
  const { data, error } = await supabase
    .from("runs")
    .select("id, status, started_at, finished_at, error")
    .is("version_id", null)
    .eq("kind", "scoring")
    .order("started_at", { ascending: false, nullsFirst: false })
    .limit(1)
    .maybeSingle();
  if (error) {
    errors.push(`runs: ${error.message}`);
    return { last: null, in_progress: false };
  }
  if (!data) return { last: null, in_progress: false };

  const rawStatus = data.status as string;
  const status: NonNullable<RescoreStatus["last"]>["status"] =
    rawStatus === "queued" || rawStatus === "running" || rawStatus === "completed" || rawStatus === "failed"
      ? rawStatus
      : "failed";
  const errJson = data.error as { message?: string } | null;

  return {
    last: {
      run_id: data.id as string,
      status,
      started_at: (data.started_at as string) ?? "",
      finished_at: (data.finished_at as string | null) ?? null,
      error_message: errJson?.message ?? null,
    },
    in_progress: status === "running" || status === "queued",
  };
}

export async function getNpmPackageList(): Promise<string[]> {
  // Static for v0. When @polygraphso publishes more packages, swap this to
  // hit the npm scope listing endpoint and union with the explicit list.
  return NPM_PACKAGES_FALLBACK;
}

export async function getAdminMetrics(): Promise<AdminMetrics> {
  const supabase = getSupabase();
  const errors: string[] = [];

  const packages = await getNpmPackageList();

  const [servers, npm, email_subscriptions, api_calls, rescore] =
    await Promise.all([
      fetchServersAggregate(supabase, errors),
      fetchNpm(packages, errors),
      fetchEmailSubs(supabase, errors),
      fetchApiCalls(supabase, errors),
      fetchRescoreStatus(supabase, errors),
    ]);

  return {
    generated_at: new Date().toISOString(),
    servers,
    npm,
    email_subscriptions,
    api_calls,
    rescore,
    errors,
  };
}
