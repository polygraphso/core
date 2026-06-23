/**
 * GET /api/badge/card?server=<ref> — the larger embeddable grade card (PNG).
 *
 * Rendered with next/og (Satori) using the preprint typography (Source Serif 4
 * + IBM Plex Mono) and the signature waveform. Dark ink ground to match the
 * inline badge (lib/badgeSvg): brightened grade color, light text, oxblood-soft
 * accents, a hairline edge so it holds up on any README theme. PNG (not SVG)
 * because the card is rich and hand-authored SVG would need fonts embedded.
 * Ungraded → a muted "–/unrated" card.
 */

import { ImageResponse } from "next/og";
import { ogFonts } from "@/app/_og/fonts";
import { WAVE_PATH } from "@/app/_og/Frame";
import { rateLimitOk, clientIp } from "@/lib/rateLimit";
import { decodeRef, loadGrade, categoryTick } from "@/lib/badgeData";
import { DARK_GRADE_HEX } from "@/lib/gradeColors";
import type { LitmusGrade, PolygraphDetail } from "@/lib/hostedGrades";

export const runtime = "nodejs";

const SIZE = { width: 800, height: 200 };
const CACHE = "public, max-age=300, s-maxage=3600, stale-while-revalidate=86400";

// Dark palette — mirrors the inline badge on ink.
const D = {
  bg: "#161512", // ink ground
  text: "#f5f1e5", // parchment — primary (grade, package name)
  dim: "#9a9488", // secondary (stamps, methodology)
  faint: "#7d766b", // tertiary (registry path, "behavioral grade")
  oxblood: "#a8424a", // oxblood-soft — accent, readable on ink
  border: "#2f2c26", // hairline edge
};

/** Indicator color: pass → green, skip → faint, anything else (fail) → oxblood. */
function tickColor(status: string | null): string {
  if (status === "pass") return DARK_GRADE_HEX.A;
  if (status && status.startsWith("skip")) return D.faint;
  return D.oxblood;
}

function Tick({ code, status }: { code: string; status: string | null }) {
  const passing = categoryTick(status);
  return (
    <div style={{ display: "flex", alignItems: "center", marginRight: 20 }}>
      <div style={{ width: 11, height: 11, marginRight: 7, backgroundColor: tickColor(status) }} />
      <div style={{ display: "flex", fontSize: 16, color: passing ? D.text : D.faint }}>{code}</div>
    </div>
  );
}

function Card({
  serverRef,
  grade,
  detail,
}: {
  serverRef: string;
  grade: LitmusGrade | null;
  detail: PolygraphDetail | null;
}) {
  const accent = grade ? DARK_GRADE_HEX[grade] : D.faint;
  // Split the ref so the package name reads as the subject and the registry
  // path stays quiet context.
  const lastSlash = serverRef.lastIndexOf("/");
  const refPrefix = lastSlash >= 0 ? serverRef.slice(0, lastSlash + 1) : "";
  const refName = lastSlash >= 0 ? serverRef.slice(lastSlash + 1) : serverRef;
  return (
    <div
      style={{
        height: "100%",
        width: "100%",
        display: "flex",
        flexDirection: "column",
        justifyContent: "space-between",
        backgroundColor: D.bg,
        border: `1px solid ${D.border}`,
        padding: "26px 34px",
        fontFamily: "IBM Plex Mono",
      }}
    >
      {/* stamp row */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <div style={{ display: "flex", alignItems: "center" }}>
          <div style={{ width: 9, height: 9, backgroundColor: D.oxblood, marginRight: 11 }} />
          <div style={{ fontSize: 14, letterSpacing: 3, color: D.dim }}>POLYGRAPH.SO</div>
        </div>
        <div style={{ fontSize: 13, letterSpacing: 3, color: D.faint }}>BEHAVIORAL GRADE</div>
      </div>

      {/* main row: grade letter + identity */}
      <div style={{ display: "flex", alignItems: "center", flex: 1 }}>
        <div
          style={{
            display: "flex",
            marginRight: 34,
            fontFamily: "Source Serif 4",
            fontWeight: 600,
            fontSize: 112,
            lineHeight: 1,
            color: accent,
          }}
        >
          {grade ?? "–"}
        </div>

        <div style={{ display: "flex", flexDirection: "column", flex: 1, minWidth: 0 }}>
          {refPrefix ? (
            <div
              style={{
                display: "flex",
                fontFamily: "IBM Plex Mono",
                fontSize: 14,
                letterSpacing: 1,
                color: D.faint,
              }}
            >
              {refPrefix}
            </div>
          ) : null}
          <div
            style={{
              display: "flex",
              fontFamily: "Source Serif 4",
              fontWeight: 600,
              fontSize: 30,
              lineHeight: 1.05,
              color: D.text,
            }}
          >
            {refName}
          </div>

          {grade && detail ? (
            <>
              <div style={{ display: "flex", marginTop: 16 }}>
                <Tick code="C-01" status={detail.c01} />
                <Tick code="C-02" status={detail.c02} />
                <Tick code="C-03" status={detail.c03} />
              </div>
              <div style={{ display: "flex", marginTop: 12, fontSize: 14, color: D.dim }}>
                {detail.methodology_version}
                {detail.resolved_version ? ` · ${detail.resolved_version}` : ""} · reproducible
              </div>
            </>
          ) : (
            <div style={{ display: "flex", marginTop: 12, fontSize: 15, color: D.dim }}>
              Not yet graded · request a polygraph at polygraph.so
            </div>
          )}
        </div>
      </div>

      {/* signature waveform */}
      <svg width={732} height={18} viewBox="0 0 1072 64" style={{ marginTop: 4 }}>
        <path
          d={WAVE_PATH}
          fill="none"
          stroke={D.oxblood}
          strokeWidth={3}
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>
    </div>
  );
}

export async function GET(request: Request): Promise<Response> {
  if (!(await rateLimitOk(`badge-card:${clientIp(request)}`, { max: 120, windowSeconds: 60 }))) {
    return new Response("rate limited", { status: 429, headers: { "Retry-After": "60" } });
  }

  const raw = new URL(request.url).searchParams.get("server");
  const key = decodeRef(raw);
  const result = key ? await loadGrade(key) : null;

  const image = new ImageResponse(
    (
      <Card
        serverRef={key ?? "invalid server ref"}
        grade={result?.grade ?? null}
        detail={result?.detail ?? null}
      />
    ),
    { ...SIZE, fonts: await ogFonts() },
  );
  image.headers.set("Cache-Control", CACHE);
  image.headers.set("Access-Control-Allow-Origin", "*");
  return image;
}
