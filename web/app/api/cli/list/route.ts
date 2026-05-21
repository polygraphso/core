/**
 * GET /api/cli/list — CLI discovery endpoint.
 *
 * Anonymous; service-role DB access on the server side only. Returns every
 * tracked server with its latest adoption tier and (eventually) latest
 * behavioral polygraph grade. behavioral_grades is empty in v0, so
 * `polygraph` is always null today — the CLI renders that as "pending".
 *
 * Sort: tier rank (top10 → top25 → top50 → top100 → null), then by
 * server_ref alphabetically within tier.
 *
 * Strategy: two queries, in-memory join. avoids a migration for a
 * latest-per-version view. Scales to thousands of servers comfortably;
 * revisit if the seed grows past ~10k.
 */

import { createClient } from "@supabase/supabase-js";
import type { AdoptionTier } from "@/lib/identity";
import { withApiLogging } from "@/lib/api-logging";

type PolygraphGrade = "A" | "B" | "C" | "D" | "F";

interface ListEntry {
  server_ref: string;
  adoption_tier: AdoptionTier | null;
  /** null = no polygraph yet (v0 default); 'pending' = run scheduled; A–F = result. */
  polygraph: null | "pending" | PolygraphGrade;
}

interface ListResponse {
  servers: ListEntry[];
  total: number;
}

const TIER_RANK: Record<string, number> = {
  top10: 0,
  top25: 1,
  top50: 2,
  top100: 3,
};

function tierRank(tier: AdoptionTier | null): number {
  return tier ? (TIER_RANK[tier] ?? 4) : 4;
}

function serverRefOf(registry: string, owner: string | null, name: string): string {
  return owner ? `${registry}/${owner}/${name}` : `${registry}/${name}`;
}

function getSupabase() {
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) {
    throw new Error(
      "SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY must be set on the server.",
    );
  }
  return createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

async function handleGET(_request: Request): Promise<Response> {
  const supabase = getSupabase();

  const { data: servers, error: serversErr } = await supabase
    .from("servers")
    .select("registry, owner, name, latest_version_id");
  if (serversErr) {
    console.error("[cli/list] servers query failed:", serversErr.message);
    return Response.json({ error: "Lookup failed." }, { status: 500 });
  }
  if (!servers || servers.length === 0) {
    const empty: ListResponse = { servers: [], total: 0 };
    return Response.json(empty);
  }

  // Latest adoption_scores row per version_id, only for versions we care
  // about. Ordering by computed_at desc + first-seen-wins in JS gives us
  // "latest per version" without a window function or a view.
  const versionIds = servers
    .map((s) => s.latest_version_id as string | null)
    .filter((v): v is string => v !== null);

  const tierByVersion = new Map<string, AdoptionTier | null>();
  if (versionIds.length > 0) {
    const { data: scores, error: scoresErr } = await supabase
      .from("adoption_scores")
      .select("version_id, tier, computed_at")
      .in("version_id", versionIds)
      .order("computed_at", { ascending: false });
    if (scoresErr) {
      console.error("[cli/list] adoption_scores query failed:", scoresErr.message);
      return Response.json({ error: "Lookup failed." }, { status: 500 });
    }
    for (const row of scores ?? []) {
      const vid = row.version_id as string;
      if (tierByVersion.has(vid)) continue;
      const t = row.tier as string | null;
      const tier: AdoptionTier | null =
        t === "top10" || t === "top25" || t === "top50" || t === "top100" ? t : null;
      tierByVersion.set(vid, tier);
    }
  }

  // behavioral_grades is empty in v0 — keep the query so the shape is
  // forward-compatible. If/when grades land, the CLI's "pending" rendering
  // becomes "A"/"B"/etc.
  const gradeByVersion = new Map<string, PolygraphGrade>();
  if (versionIds.length > 0) {
    const { data: grades, error: gradesErr } = await supabase
      .from("behavioral_grades")
      .select("version_id, grade, computed_at")
      .in("version_id", versionIds)
      .order("computed_at", { ascending: false });
    // Don't 500 the whole endpoint if behavioral_grades doesn't exist yet
    // — that table lands with the litmus harness. Log + continue.
    if (gradesErr) {
      console.warn("[cli/list] behavioral_grades query soft-failed:", gradesErr.message);
    } else {
      for (const row of grades ?? []) {
        const vid = row.version_id as string;
        if (gradeByVersion.has(vid)) continue;
        const g = row.grade as string | null;
        if (g === "A" || g === "B" || g === "C" || g === "D" || g === "F") {
          gradeByVersion.set(vid, g);
        }
      }
    }
  }

  const entries: ListEntry[] = servers.map((s) => {
    const registry = s.registry as string;
    const owner = s.owner as string | null;
    const name = s.name as string;
    const vid = s.latest_version_id as string | null;
    const adoption_tier = vid ? tierByVersion.get(vid) ?? null : null;
    const polygraph: ListEntry["polygraph"] = vid
      ? gradeByVersion.get(vid) ?? null
      : null;
    return {
      server_ref: serverRefOf(registry, owner, name),
      adoption_tier,
      polygraph,
    };
  });

  entries.sort((a, b) => {
    const r = tierRank(a.adoption_tier) - tierRank(b.adoption_tier);
    if (r !== 0) return r;
    return a.server_ref.localeCompare(b.server_ref);
  });

  const body: ListResponse = { servers: entries, total: entries.length };
  return Response.json(body);
}

export const GET = withApiLogging("/api/cli/list", handleGET);
