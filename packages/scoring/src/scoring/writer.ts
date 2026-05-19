/**
 * Persists scored servers to the `adoption_scores` table.
 *
 * Per the contracts doc, `adoption_scores` has no unique constraint on
 * version_id — each scoring run inserts a fresh row. The latest row for a
 * given version is what consumers read (index on (version_id, computed_at
 * desc) keeps this fast).
 */

import type { SupabaseClient } from "@supabase/supabase-js";
import type { AdoptionComponents } from "@polygraph/core";
import type { ComponentSnapshot, ScoredServer } from "./types.js";

export interface ScoredRow {
  scored: ScoredServer;
  snapshot: ComponentSnapshot;
}

/**
 * Build the AdoptionComponents jsonb for one server. Pulls everything
 * useful from the snapshot — adoption math doesn't read most of these,
 * but the forensic view ("why did this drop a tier?") does.
 */
export function buildComponents(snapshot: ComponentSnapshot, scored: ScoredServer): AdoptionComponents {
  const components: AdoptionComponents = {
    sources_used: scored.sources_used,
  };

  if (snapshot.npm) {
    components.npm_downloads_last_month = snapshot.npm.downloads_last_month;
    components.npm_weekly_downloads = snapshot.npm.weekly_downloads;
    components.npm_last_publish_date = snapshot.npm.last_publish_date;
  }
  if (snapshot.pypi) {
    components.pypi_downloads_last_month = snapshot.pypi.downloads_last_month;
    components.pypi_weekly_downloads = snapshot.pypi.weekly_downloads;
    components.pypi_last_release_date = snapshot.pypi.last_release_date;
  }
  if (snapshot.github) {
    components.gh_stars = snapshot.github.stars;
    components.gh_forks = snapshot.github.forks;
    components.gh_contributors = snapshot.github.contributors_count;
    components.gh_pr_count_open = snapshot.github.pr_count_open;
    components.gh_pr_count_closed = snapshot.github.pr_count_closed;
    components.gh_last_push_at = snapshot.github.last_push_at;
  }
  if (snapshot.openssf) {
    components.openssf_aggregate = snapshot.openssf.aggregate_score;
  }
  if (snapshot.glama) {
    components.glama_security_grade = snapshot.glama.security_grade;
    components.glama_quality_grade = snapshot.glama.quality_grade;
    components.glama_license_grade = snapshot.glama.license_grade;
  }
  if (snapshot.smithery) {
    components.smithery_use_count = snapshot.smithery.use_count;
    components.smithery_verified = snapshot.smithery.verified;
  }
  if (snapshot.depsdev) {
    components.depsdev_dependents_count = snapshot.depsdev.dependents_count;
    components.depsdev_advisory_count = snapshot.depsdev.advisory_count;
  }

  // Bonus fields not in @polygraph/core's AdoptionComponents (kept loose
  // via the [key: string]: unknown index signature). Useful for debugging.
  (components as Record<string, unknown>).dimensions = scored.dimensions;
  (components as Record<string, unknown>).rank = scored.rank;
  (components as Record<string, unknown>).redistribution = scored.redistribution;
  if (snapshot.depsdev) {
    (components as Record<string, unknown>).depsdev_max_severity = snapshot.depsdev.max_advisory_severity;
    (components as Record<string, unknown>).depsdev_severities = snapshot.depsdev.advisory_severities;
    (components as Record<string, unknown>).depsdev_has_slsa = snapshot.depsdev.has_slsa_provenance;
  }

  return components;
}

/**
 * Insert one adoption_scores row per scored server. Returns the count of
 * rows actually inserted.
 */
export async function writeAdoptionScores(
  supabase: SupabaseClient,
  scored: readonly ScoredServer[],
  snapshotsById: ReadonlyMap<string, ComponentSnapshot>,
): Promise<number> {
  if (scored.length === 0) return 0;

  const rows = scored.map((s) => {
    const snap = snapshotsById.get(s.server_id);
    if (!snap) throw new Error(`No snapshot for scored server_id ${s.server_id}`);
    return {
      version_id: s.version_id,
      score: s.score,
      tier: s.tier,
      components: buildComponents(snap, s),
    };
  });

  const { error, count } = await supabase
    .from("adoption_scores")
    .insert(rows, { count: "exact" });

  if (error) {
    throw new Error(`writeAdoptionScores failed: ${error.message}`);
  }
  return count ?? rows.length;
}
