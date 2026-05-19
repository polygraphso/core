/**
 * Read-side: query adoption_scores for the latest score per server, sort
 * by rank, return the top N. Backs the admin "show me the current top-50"
 * script and (later) the public matrix endpoint.
 */

import type { SupabaseClient } from "@supabase/supabase-js";
import type { AdoptionComponents, AdoptionTier, Registry } from "@polygraph/core";

export interface TopRankEntry {
  rank: number;
  server: {
    id: string;
    registry: Registry;
    owner: string | null;
    name: string;
  };
  version: {
    id: string;
    version: string;
  };
  score: number;
  tier: AdoptionTier | null;
  computed_at: string;
  components: AdoptionComponents;
}

interface JoinedRow {
  version_id: string;
  score: string | number;
  tier: AdoptionTier | null;
  components: AdoptionComponents;
  computed_at: string;
  versions: {
    id: string;
    version: string;
    servers: {
      id: string;
      registry: Registry;
      owner: string | null;
      name: string;
    } | null;
  } | null;
}

/**
 * Read the latest adoption_scores row per version, sorted by score
 * descending. With per-run history we need a "latest per version_id"
 * pass on the client side — done here in JS to keep the query simple.
 */
export async function readTopRanked(
  supabase: SupabaseClient,
  limit = 50,
): Promise<TopRankEntry[]> {
  // Pull more than `limit` rows so we have headroom after deduping by version_id.
  // 4x is a heuristic — enough to cover a few prior runs without paginating.
  const fetchLimit = limit * 4;
  const { data, error } = await supabase
    .from("adoption_scores")
    .select(
      "version_id, score, tier, components, computed_at, versions:version_id(id, version, servers:server_id(id, registry, owner, name))",
    )
    .order("computed_at", { ascending: false })
    .limit(fetchLimit);

  if (error) {
    throw new Error(`readTopRanked failed: ${error.message}`);
  }

  const seen = new Set<string>();
  const latest: JoinedRow[] = [];
  // Supabase's TS inference treats FK joins as arrays even when the FK
  // guarantees a singleton at runtime — cast through unknown to bridge.
  for (const row of (data ?? []) as unknown as JoinedRow[]) {
    if (seen.has(row.version_id)) continue;
    seen.add(row.version_id);
    latest.push(row);
  }

  latest.sort((a, b) => Number(b.score) - Number(a.score));

  return latest.slice(0, limit).map((row, i) => {
    const v = row.versions;
    const s = v?.servers;
    if (!v || !s) {
      throw new Error(`adoption_scores row missing FK join (version_id=${row.version_id})`);
    }
    return {
      rank: i + 1,
      server: { id: s.id, registry: s.registry, owner: s.owner, name: s.name },
      version: { id: v.id, version: v.version },
      score: Number(row.score),
      tier: row.tier,
      computed_at: row.computed_at,
      components: row.components,
    };
  });
}
