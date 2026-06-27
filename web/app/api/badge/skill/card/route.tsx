/**
 * GET /api/badge/skill/card?skill=<ref> — the larger embeddable skill grade card (PNG).
 *
 * The skill counterpart to /api/badge/card: the same GradeCard on ink, but the
 * grade comes from the static skill litmus and the ticks are S-01/S-03/S-04 (the
 * three skill checks). The subject is the skill's path-form ref so the repo reads
 * as quiet context and the skill name as the subject. Ungraded → a muted "–" card.
 */

import { ImageResponse } from "next/og";
import { ogFonts } from "@/app/_og/fonts";
import { GradeCard } from "@/app/_og/GradeCard";
import { rateLimitOk, clientIp } from "@/lib/rateLimit";
import { decodeSkillRef, loadSkillGrade, skillRefToPath } from "@/lib/skillGrades";
import { getSupabaseAdmin } from "@/lib/supabase";

export const runtime = "nodejs";

const SIZE = { width: 800, height: 200 };
const CACHE = "public, max-age=300, s-maxage=3600, stale-while-revalidate=86400";

export async function GET(request: Request): Promise<Response> {
  if (!(await rateLimitOk(`badge-skill-card:${clientIp(request)}`, { max: 120, windowSeconds: 60 }))) {
    return new Response("rate limited", { status: 429, headers: { "Retry-After": "60" } });
  }

  const raw = new URL(request.url).searchParams.get("skill");
  const target = decodeSkillRef(raw);
  const result = target ? await loadSkillGrade(getSupabaseAdmin(), target) : null;
  const detail = result?.detail ?? null;

  // Categories already arrive in canonical S-01/S-03/S-04 order.
  const ticks = detail ? detail.categories.map((c) => ({ code: c.code, status: c.status })) : [];
  const metaLine = detail ? `${detail.methodology_version} · static · reproducible` : "";

  const image = new ImageResponse(
    (
      <GradeCard
        subjectRef={target ? skillRefToPath(target) : "invalid skill ref"}
        grade={result?.grade ?? null}
        ticks={ticks}
        metaLine={metaLine}
        rightLabel="STATIC SAFETY GRADE"
        ungradedNote="Not yet graded · request a polygraph at polygraph.so"
      />
    ),
    { ...SIZE, fonts: await ogFonts() },
  );
  image.headers.set("Cache-Control", CACHE);
  image.headers.set("Access-Control-Allow-Origin", "*");
  return image;
}
