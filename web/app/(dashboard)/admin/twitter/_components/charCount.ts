/**
 * X-weighted tweet length — a client-safe guardrail (no server-only imports).
 *
 * Mirrors twitter/instructions.md and X's own weighted-length rule closely
 * enough to warn before you overrun a tweet: a URL counts as 23 regardless of
 * its real length; most characters count as 1; CJK / emoji / other astral
 * scalars count as 2 (en/em dashes stay 1). It is an approximation — a guard,
 * not the authority X applies at post time.
 */

/** Target length; over this the counter warns (X's soft comfort line). */
export const TWEET_TARGET = 270;
/** Hard ceiling; over this the tweet will not post. */
export const TWEET_HARD_MAX = 280;

const URL_LENGTH = 23;
const URL_RE = /https?:\/\/\S+/gi;

// Code-point ranges X weights as 1; everything else weighs 2.
const WEIGHT_ONE_RANGES: [number, number][] = [
  [0, 4351],
  [8192, 8205],
  [8208, 8223],
  [8242, 8247],
];

function isWeightOne(cp: number): boolean {
  return WEIGHT_ONE_RANGES.some(([lo, hi]) => cp >= lo && cp <= hi);
}

export function xWeightedLength(text: string): number {
  if (!text) return 0;
  const urls = text.match(URL_RE) ?? [];
  const withoutUrls = text.replace(URL_RE, "");
  let weight = 0;
  for (const ch of withoutUrls) {
    // for…of iterates by code point, so surrogate pairs stay whole.
    weight += isWeightOne(ch.codePointAt(0) ?? 0) ? 1 : 2;
  }
  return weight + urls.length * URL_LENGTH;
}
