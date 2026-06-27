/**
 * GET /api/badge/card?server=<ref> — the larger embeddable grade card (PNG).
 *
 * Rendered with next/og (Satori) via the shared GradeCard (app/_og/GradeCard):
 * the preprint typography, the signature waveform, and the dark ink ground that
 * matches the inline badge (lib/badgeSvg). PNG (not SVG) because the card is rich
 * and hand-authored SVG would need fonts embedded. Ungraded → a muted "–" card.
 */

import { ImageResponse } from "next/og";
import { ogFonts } from "@/app/_og/fonts";
import { GradeCard } from "@/app/_og/GradeCard";
import { rateLimitOk, clientIp } from "@/lib/rateLimit";
import { decodeRef, loadGrade } from "@/lib/badgeData";

export const runtime = "nodejs";

const SIZE = { width: 800, height: 200 };
const CACHE = "public, max-age=300, s-maxage=3600, stale-while-revalidate=86400";

export async function GET(request: Request): Promise<Response> {
  if (!(await rateLimitOk(`badge-card:${clientIp(request)}`, { max: 120, windowSeconds: 60 }))) {
    return new Response("rate limited", { status: 429, headers: { "Retry-After": "60" } });
  }

  const raw = new URL(request.url).searchParams.get("server");
  const key = decodeRef(raw);
  const result = key ? await loadGrade(key) : null;
  const detail = result?.detail ?? null;

  const ticks = detail
    ? [
        { code: "C-01", status: detail.c01 },
        { code: "C-02", status: detail.c02 },
        { code: "C-03", status: detail.c03 },
      ]
    : [];
  const metaLine = detail
    ? `${detail.methodology_version}${detail.resolved_version ? ` · ${detail.resolved_version}` : ""} · reproducible`
    : "";

  const image = new ImageResponse(
    (
      <GradeCard
        subjectRef={key ?? "invalid server ref"}
        grade={result?.grade ?? null}
        ticks={ticks}
        metaLine={metaLine}
        rightLabel="BEHAVIORAL GRADE"
        ungradedNote="Not yet graded · request a polygraph at polygraph.so"
      />
    ),
    { ...SIZE, fonts: await ogFonts() },
  );
  image.headers.set("Cache-Control", CACHE);
  image.headers.set("Access-Control-Allow-Origin", "*");
  return image;
}
