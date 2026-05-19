/**
 * Batch ranking: takes per-server raw dimensions, normalizes adoption /
 * quality / consistency across the batch, combines into a single score,
 * sorts, and assigns tiers by rank.
 *
 * The weights and combination formula are lifted directly from
 * agentic-talent-app/recompute.ts so v1 ranks match what's been proven:
 *   score = 0.28*adoption + 0.28*quality + 0.28*consistency - 0.16*risk
 * Clamped to [0, 100]. Quality / consistency dimensions are scaled to
 * 0-100 before normalization (they come in as 0-1 from compute).
 */

import type { AdoptionTier } from "@polygraph/core";
import { normalizeColumnWithFloor } from "./normalize.js";
import type { RawDimensions, ScoredServer } from "./types.js";

export const WEIGHTS = {
  adoption: 0.28,
  quality: 0.28,
  consistency: 0.28,
  risk: 0.16,
} as const;

export interface RankInput {
  server_id: string;
  version_id: string;
  raw: RawDimensions;
}

/**
 * Tier boundaries per scoring-brief.md: top10 ranks 1-10, top25 ranks
 * 11-25, etc. Servers ranked 101+ get tier=null.
 */
export function assignTier(rank: number): AdoptionTier | null {
  if (rank <= 10) return "top10";
  if (rank <= 25) return "top25";
  if (rank <= 50) return "top50";
  if (rank <= 100) return "top100";
  return null;
}

export function rankAndTier(inputs: readonly RankInput[]): ScoredServer[] {
  if (inputs.length === 0) return [];

  const adoptionNorm = normalizeColumnWithFloor(inputs.map((i) => i.raw.adoption));
  const qualityNorm = normalizeColumnWithFloor(inputs.map((i) => i.raw.quality * 100));
  const consistencyNorm = normalizeColumnWithFloor(inputs.map((i) => i.raw.consistency * 100));

  // Compose, but don't assign rank yet — need to sort first.
  const composed = inputs.map((input, i) => {
    const adoption = adoptionNorm[i]!;
    const quality = qualityNorm[i]!;
    const consistency = consistencyNorm[i]!;
    const risk = input.raw.risk;

    const score = Math.max(
      0,
      Math.min(
        100,
        WEIGHTS.adoption * adoption +
          WEIGHTS.quality * quality +
          WEIGHTS.consistency * consistency -
          WEIGHTS.risk * risk,
      ),
    );

    return {
      server_id: input.server_id,
      version_id: input.version_id,
      score: Math.round(score * 10) / 10,
      adoption: Math.round(adoption * 10) / 10,
      quality: Math.round(quality * 10) / 10,
      consistency: Math.round(consistency * 10) / 10,
      risk: Math.round(risk * 10) / 10,
      sources_used: input.raw.sources_used,
      redistribution: input.raw.redistribution,
    };
  });

  // Sort by score descending, then by server_id ascending for deterministic
  // tie-breaking. Same inputs → same ranks across runs.
  composed.sort((a, b) => {
    if (a.score !== b.score) return b.score - a.score;
    return a.server_id.localeCompare(b.server_id);
  });

  return composed.map((c, i) => {
    const rank = i + 1;
    return {
      server_id: c.server_id,
      version_id: c.version_id,
      score: c.score,
      tier: assignTier(rank),
      rank,
      dimensions: {
        adoption: c.adoption,
        quality: c.quality,
        consistency: c.consistency,
        risk: c.risk,
      },
      sources_used: c.sources_used,
      redistribution: c.redistribution,
    };
  });
}
