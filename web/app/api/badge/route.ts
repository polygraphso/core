/**
 * GET /api/badge?server=<ref> — the inline shields-style grade badge (SVG).
 *
 * Anonymous; reads the same published grade the CLI and site read. Always
 * returns an SVG (never JSON / never a broken image): an ungraded or unknown
 * server gets the muted "unrated" pill, a malformed ref gets an "invalid ref"
 * pill. The image is cached hard at the CDN so a README that embeds it rarely
 * reaches the origin.
 */

import { rateLimitOk, clientIp } from "@/lib/rateLimit";
import { decodeRef, loadGrade } from "@/lib/badgeData";
import { renderBadgeSvg, renderInvalidBadge } from "@/lib/badgeSvg";

export const runtime = "nodejs";

// Browser/camo hold 5 min; the CDN serves a cached copy for 1 h (keeping the DB
// cold); serve-stale for a day while revalidating. A regrade (or a rug-pull
// that changes the grade) propagates within the s-maxage window. Same posture
// shields.io lives with.
const CACHE = "public, max-age=300, s-maxage=3600, stale-while-revalidate=86400";

function svg(body: string, cache = CACHE): Response {
  return new Response(body, {
    headers: {
      "Content-Type": "image/svg+xml; charset=utf-8",
      "Cache-Control": cache,
      "Access-Control-Allow-Origin": "*",
    },
  });
}

export async function GET(request: Request): Promise<Response> {
  // Higher ceiling than cli-check (one README requests several badges). On a
  // limit we still return an SVG — the limiter's job is to skip the DB lookup
  // under direct scraping, not to break the image. Short cache so it recovers.
  if (!(await rateLimitOk(`badge:${clientIp(request)}`, { max: 120, windowSeconds: 60 }))) {
    return svg(renderBadgeSvg({ grade: null }), "public, max-age=60");
  }

  const raw = new URL(request.url).searchParams.get("server");
  const key = decodeRef(raw);
  if (!key) return svg(renderInvalidBadge());

  const result = await loadGrade(key);
  return svg(renderBadgeSvg({ grade: result?.grade ?? null }));
}
