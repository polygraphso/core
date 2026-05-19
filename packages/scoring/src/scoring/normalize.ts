/**
 * Min-max normalization with a floor and variance threshold.
 *
 * Lifted from agentic-talent-app/web/src/lib/pipeline/scoring/normalize.ts.
 * The two knobs (floor=10, variance=0.1) are the proven defaults from the
 * existing pipeline; don't tune without evidence.
 *
 * Why the floor: a server at the absolute bottom shouldn't score 0 — that
 * implies "no signal," which is misleading when we have data on the server,
 * just less than peers. A 10-point floor preserves the ranking while making
 * the bottom feel less like a hard zero.
 *
 * Why the variance threshold: when min and max are too close together,
 * normalization amplifies trivial differences into wildly different scores.
 * Treat such dimensions as uniform and assign every server the midpoint.
 */

export const DEFAULT_FLOOR = 10;
export const DEFAULT_VARIANCE_THRESHOLD = 0.1;

export function normalizeColumnWithFloor(
  values: number[],
  floor: number = DEFAULT_FLOOR,
  varianceThreshold: number = DEFAULT_VARIANCE_THRESHOLD,
): number[] {
  if (values.length === 0) return [];
  const min = Math.min(...values);
  const max = Math.max(...values);
  const midpoint = (floor + 100) / 2;

  if (max === min) return values.map(() => midpoint);

  const spread = (max - min) / (Math.abs(max) || 1);
  if (spread < varianceThreshold) return values.map(() => midpoint);

  return values.map((v) => floor + ((v - min) / (max - min)) * (100 - floor));
}
