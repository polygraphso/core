/* Shared chrome for every generated social card — keeps the preprint identity
   (parchment ground, oxblood pulse dot, IBM Plex Mono stamps, the signature
   polygraph waveform) consistent across the site default, the blog index, and
   each post. The center slot is filled per route. Rendered by Satori via
   next/og, so only the CSS subset Satori supports is used (flexbox, no grid). */

export const OG_SIZE = { width: 1200, height: 630 };
export const OG_CONTENT_TYPE = "image/png";

const C = {
  parchment: "#f5f1e5",
  rule: "#d9d2c2",
  ink: "#161512",
  muted: "#5c5550",
  faint: "#8a8378",
  oxblood: "#7a1f2b",
};

export { C as OG_COLORS };

// The signature polygraph waveform, drawn on a 0 0 1072 64 viewBox. Exported so
// the grade card (app/api/badge/card) can reuse the exact same trace.
export const WAVE_PATH =
  "M0 32 L250 32 L268 22 L286 44 L304 32 L322 4 L338 60 L354 2 L370 62 L386 6 L402 60 L418 20 L434 46 L450 14 L466 52 L482 32 L760 32 L788 24 L816 42 L844 32 L1072 32";

export function Frame({
  rightLabel,
  footerLeft = "BASELINE · ADVERSARIAL PROBES · BASELINE",
  children,
}: {
  rightLabel: string;
  footerLeft?: string;
  children: React.ReactNode;
}) {
  return (
    <div
      style={{
        width: "100%",
        height: "100%",
        display: "flex",
        flexDirection: "column",
        backgroundColor: C.parchment,
        padding: "52px 64px 46px",
        fontFamily: "IBM Plex Mono",
      }}
    >
      {/* top hairline */}
      <div style={{ display: "flex", height: 1, backgroundColor: C.rule }} />

      {/* stamp row */}
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          marginTop: 26,
        }}
      >
        <div style={{ display: "flex", alignItems: "center" }}>
          <div
            style={{
              width: 9,
              height: 9,
              backgroundColor: C.oxblood,
              marginRight: 13,
            }}
          />
          <div style={{ fontSize: 15, letterSpacing: 3, color: C.muted }}>
            POLYGRAPH.SO
          </div>
        </div>
        <div style={{ fontSize: 15, letterSpacing: 3, color: C.faint }}>
          {rightLabel}
        </div>
      </div>

      {/* center slot */}
      <div
        style={{
          display: "flex",
          flexDirection: "column",
          flex: 1,
          justifyContent: "center",
        }}
      >
        {children}
      </div>

      {/* signature waveform divider */}
      <svg width={1072} height={64} viewBox="0 0 1072 64">
        <line
          x1={0}
          y1={32}
          x2={1072}
          y2={32}
          stroke={C.rule}
          strokeWidth={1}
          strokeDasharray="3 6"
        />
        <path
          d={WAVE_PATH}
          fill="none"
          stroke={C.oxblood}
          strokeWidth={2.4}
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>

      {/* footer captions */}
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          marginTop: 16,
        }}
      >
        <div style={{ fontSize: 13, letterSpacing: 3, color: C.faint }}>
          {footerLeft}
        </div>
        <div style={{ fontSize: 13, letterSpacing: 3, color: C.faint }}>
          POLYGRAPH.SO
        </div>
      </div>
    </div>
  );
}
