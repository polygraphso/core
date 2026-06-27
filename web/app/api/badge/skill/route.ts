/**
 * GET /api/badge/skill?skill=<ref> — the inline skill grade badge (SVG).
 *
 * The skill counterpart to /api/badge: the same dark pill and renderer, but the
 * grade comes from the static skill litmus (loadSkillGrade — grade-only, no
 * `published_at` gate, so the badge matches the /skill report page). An ungraded
 * or unknown skill gets the muted "unrated" pill; a malformed ref gets the
 * "invalid ref" pill. Never JSON, never a broken image; cached hard at the CDN.
 *
 * The `?skill=` value is the path form (`github/owner/repo/subpath`, `#`→`/`),
 * which decodeSkillRef reverses — the same form the /skill page builds.
 */

import { rateLimitOk, clientIp } from "@/lib/rateLimit";
import { decodeSkillRef, loadSkillGrade } from "@/lib/skillGrades";
import { getSupabaseAdmin } from "@/lib/supabase";
import { renderBadgeSvg, renderInvalidBadge } from "@/lib/badgeSvg";

export const runtime = "nodejs";

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
  // On a limit we still return an SVG — the limiter skips the DB lookup under
  // direct scraping, it doesn't break the image. Short cache so it recovers.
  if (!(await rateLimitOk(`badge-skill:${clientIp(request)}`, { max: 120, windowSeconds: 60 }))) {
    return svg(renderBadgeSvg({ grade: null }), "public, max-age=60");
  }

  const raw = new URL(request.url).searchParams.get("skill");
  const target = decodeSkillRef(raw);
  if (!target) return svg(renderInvalidBadge());

  const result = await loadSkillGrade(getSupabaseAdmin(), target);
  return svg(renderBadgeSvg({ grade: result?.grade ?? null }));
}
