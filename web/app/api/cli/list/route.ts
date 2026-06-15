/**
 * GET /api/cli/list — CLI discovery endpoint.
 *
 * Anonymous; service-role DB access on the server side only. Returns every
 * tracked server with its latest adoption tier and latest published
 * polygraph grade. Grades come from hosted_runs (status='complete',
 * published_at set) — the same source the website reads.
 *
 * Sort: tier rank (top10 → top25 → top50 → top100 → null), then by
 * server_ref alphabetically within tier.
 *
 * Strategy: two queries, in-memory join. avoids a migration for a
 * latest-per-version view. Scales to thousands of servers comfortably;
 * revisit if the seed grows past ~10k.
 */

import type { AdoptionTier } from "@/lib/identity";
import { getSupabaseAdmin } from "@/lib/supabase";
import { fetchPublishedGradeMap, type LitmusGrade } from "@/lib/hostedGrades";

interface ListEntry {
  server_ref: string;
  adoption_tier: AdoptionTier | null;
  /** null = no published grade; A–F = published litmus grade. */
  polygraph: null | LitmusGrade;
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

export async function GET() {
  const supabase = getSupabaseAdmin();
  if (!supabase) {
    console.error("[cli/list] Supabase is not configured");
    return Response.json({ error: "Lookup failed." }, { status: 500 });
  }

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

  // Published grades from hosted_runs, keyed by target (the versionless
  // server_key) — the same source the website reads. Soft-fails to an
  // empty map so the list still returns the catalog + adoption tiers.
  const gradeByRef = await fetchPublishedGradeMap(supabase);

  const entries: ListEntry[] = servers.map((s) => {
    const registry = s.registry as string;
    const owner = s.owner as string | null;
    const name = s.name as string;
    const vid = s.latest_version_id as string | null;
    const adoption_tier = vid ? tierByVersion.get(vid) ?? null : null;
    const server_ref = serverRefOf(registry, owner, name);
    return {
      server_ref,
      adoption_tier,
      polygraph: gradeByRef.get(server_ref) ?? null,
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
