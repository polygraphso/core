/**
 * Grade severity ordering for the alert threshold. A is best, F is worst; there
 * is no 'E'. `packages/scoring` can't import the web-side grade helpers, and the
 * rest of the alert engine treats grades as opaque strings — this is the only
 * place that needs an ordering.
 */
const ORDER: Record<string, number> = { A: 0, B: 1, C: 2, D: 3, F: 4 };

/**
 * Should a new published `grade` trigger an email under threshold `minGrade`?
 *
 * - `minGrade` null → always (the "every regrade" default).
 * - Both known → email iff the new grade is at or below the threshold's
 *   severity (`rank(grade) >= rank(minGrade)`).
 * - Either null/unknown/unrecognized → email (fail-open). A grade we can't rank
 *   should surprise the watcher with an email, never silently drop a regression.
 */
export function gradeMeetsThreshold(
  grade: string | null | undefined,
  minGrade: string | null | undefined,
): boolean {
  if (minGrade == null) return true;
  const g = ORDER[(grade ?? "").toUpperCase()];
  const m = ORDER[(minGrade ?? "").toUpperCase()];
  if (g === undefined || m === undefined) return true;
  return g >= m;
}

/**
 * Did the grade get WORSE from `prev` to `next` (e.g. B → D)? Used by the
 * ecosystem digest's grade-drop section. Returns false when either grade is
 * unknown/unrankable — a first grade (no prior) is not a "drop", and we never
 * fabricate a drop from a grade we can't order.
 */
export function gradeDropped(
  prev: string | null | undefined,
  next: string | null | undefined,
): boolean {
  const p = ORDER[(prev ?? "").toUpperCase()];
  const n = ORDER[(next ?? "").toUpperCase()];
  if (p === undefined || n === undefined) return false;
  return n > p;
}
