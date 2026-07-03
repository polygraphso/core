/**
 * Shared shaping for the catalog-backed search endpoint (`/api/catalog/search`).
 *
 * The route reads `catalog_servers`, cross-checks `hosted_runs` for coverage,
 * and returns runnable candidates the request/monitor forms can pick from.
 * The pure pieces — the ilike pattern and the coverage-marked result shape —
 * live here so they can be unit-tested without a database.
 */

/** Columns the route selects from catalog_servers. */
export interface CatalogRow {
  name: string | null;
  repository_url: string | null;
  grading_target: string | null;
  grading_kind: string | null;
  gradeable: boolean | null;
}

/** A runnable candidate, marked with whether we've already graded it. */
export interface CatalogResult {
  target: string; // grading_target — the runnable ref a pick submits
  name: string | null;
  kind: string | null;
  gradeable: boolean;
  graded: boolean;
  grade: string | null;
}

/**
 * Build the ilike pattern: reserved PostgREST chars stripped, spaces become
 * wildcards so multi-word queries match regardless of term order. Mirrors the
 * `catalog:search` CLI so the web and CLI surfaces search identically.
 */
export function likePattern(query: string): string {
  const words = query
    .replace(/[,()"*:%]/g, " ")
    .trim()
    .split(/\s+/)
    .filter(Boolean);
  return `%${words.join("%")}%`;
}

/**
 * Shape catalog rows into runnable candidates. Rows without a `grading_target`
 * (unresolved — nothing to run) are dropped; the rest are deduped by target
 * and marked graded/grade from the coverage map.
 */
export function toResults(
  rows: CatalogRow[],
  grades: Map<string, string | null>,
): CatalogResult[] {
  const seen = new Set<string>();
  const results: CatalogResult[] = [];
  for (const r of rows) {
    if (!r.grading_target || seen.has(r.grading_target)) continue;
    seen.add(r.grading_target);
    results.push({
      target: r.grading_target,
      name: r.name,
      kind: r.grading_kind,
      gradeable: r.gradeable === true,
      graded: grades.has(r.grading_target),
      grade: grades.get(r.grading_target) ?? null,
    });
  }
  return results;
}
