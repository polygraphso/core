/**
 * The embeddable grade card body, shared by the MCP server card
 * (app/api/badge/card) and the skill card (app/api/badge/skill/card). Rendered
 * with next/og (Satori) using the preprint typography (Source Serif 4 + IBM Plex
 * Mono) and the signature waveform. Dark ink ground to match the inline badge
 * (lib/badgeSvg): brightened grade color, light text, oxblood-soft accents, a
 * hairline edge so it holds up on any README theme.
 *
 * The subject ref splits on its last "/" so the trailing name reads as the
 * subject and the registry/repo path stays quiet context. Callers pass their own
 * category ticks (C-01/C-02/C-03 for servers, S-01/S-03/S-04 for skills), the
 * `rightLabel` stamp, and the meta line. Ungraded → a muted "–" card carrying
 * `ungradedNote`. Satori supports only a CSS subset (flexbox, no grid).
 */

import { WAVE_PATH } from "@/app/_og/Frame";
import { categoryTick } from "@/lib/badgeData";
import { DARK_GRADE_HEX } from "@/lib/gradeColors";
import type { LitmusGrade } from "@/lib/hostedGrades";

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

export function GradeCard({
  subjectRef,
  grade,
  ticks,
  metaLine,
  rightLabel,
  ungradedNote,
}: {
  subjectRef: string;
  grade: LitmusGrade | null;
  ticks: Array<{ code: string; status: string | null }>;
  metaLine: string;
  rightLabel: string;
  ungradedNote: string;
}) {
  const accent = grade ? DARK_GRADE_HEX[grade] : D.faint;
  // Split the ref so the name reads as the subject and the path stays quiet context.
  const lastSlash = subjectRef.lastIndexOf("/");
  const refPrefix = lastSlash >= 0 ? subjectRef.slice(0, lastSlash + 1) : "";
  const refName = lastSlash >= 0 ? subjectRef.slice(lastSlash + 1) : subjectRef;
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
        <div style={{ fontSize: 13, letterSpacing: 3, color: D.faint }}>{rightLabel}</div>
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

          {grade ? (
            <>
              <div style={{ display: "flex", marginTop: 16 }}>
                {ticks.map((t) => (
                  <Tick key={t.code} code={t.code} status={t.status} />
                ))}
              </div>
              <div style={{ display: "flex", marginTop: 12, fontSize: 14, color: D.dim }}>
                {metaLine}
              </div>
            </>
          ) : (
            <div style={{ display: "flex", marginTop: 12, fontSize: 15, color: D.dim }}>
              {ungradedNote}
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
