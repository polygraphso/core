import { ImageResponse } from "next/og";
import { OG_SIZE, og, ogFonts } from "@/lib/og";

// Site-wide OG card: tagline + the grade scale. Twitter falls back to
// this when no twitter-image file exists, so one card covers both.

export const alt =
  "polygraph.so — we polygraph AI agents so you don't have to";
export const size = OG_SIZE;
export const contentType = "image/png";

export default async function Image() {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          background: og.parchment,
          color: og.ink,
          padding: 56,
          fontFamily: "IBM Plex Mono",
        }}
      >
        {/* top chrome */}
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            fontSize: 22,
            letterSpacing: 4,
            color: og.inkMuted,
            textTransform: "uppercase",
            paddingBottom: 24,
            borderBottom: `1px solid ${og.rule}`,
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
            <div
              style={{
                width: 14,
                height: 14,
                background: og.oxblood,
                display: "flex",
              }}
            />
            <span style={{ color: og.ink }}>polygraph.so</span>
          </div>
          <span>behavioral polygraphs · MCP servers</span>
        </div>

        {/* tagline */}
        <div
          style={{
            flex: 1,
            display: "flex",
            flexDirection: "column",
            justifyContent: "center",
          }}
        >
          <div
            style={{
              fontFamily: "Source Serif 4",
              fontSize: 84,
              lineHeight: 1.08,
              letterSpacing: -1,
              maxWidth: 980,
            }}
          >
            We polygraph AI agents so you don&rsquo;t have to.
          </div>
          <div
            style={{
              marginTop: 28,
              fontSize: 26,
              color: og.inkMuted,
              maxWidth: 900,
              lineHeight: 1.5,
            }}
          >
            A grade backed by evidence anyone can re-run. Free and public.
          </div>
        </div>

        {/* bottom chrome: the grade scale */}
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            paddingTop: 24,
            borderTop: `1px solid ${og.rule}`,
          }}
        >
          <div style={{ display: "flex", gap: 28 }}>
            {(["A", "B", "D", "F"] as const).map((g) => (
              <span
                key={g}
                style={{
                  fontFamily: "Source Serif 4",
                  fontSize: 44,
                  color: og.grade[g],
                }}
              >
                {g}
              </span>
            ))}
            <span
              style={{
                fontSize: 20,
                color: og.inkFaint,
                alignSelf: "center",
                letterSpacing: 2,
              }}
            >
              — no C grade. skipped is not a pass.
            </span>
          </div>
          <span style={{ fontSize: 20, color: og.inkFaint, letterSpacing: 2 }}>
            litmus-v2
          </span>
        </div>
      </div>
    ),
    { ...size, fonts: await ogFonts() },
  );
}
