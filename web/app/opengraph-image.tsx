import { ImageResponse } from "next/og";
import { Frame, OG_SIZE, OG_CONTENT_TYPE, OG_COLORS as C } from "./_og/Frame";
import { ogFonts } from "./_og/fonts";

export const alt = "polygraph.so — independent, lab-evaluated trust grades for AI tools";
export const size = OG_SIZE;
export const contentType = OG_CONTENT_TYPE;

export default async function Image() {
  return new ImageResponse(
    (
      <Frame rightLabel="BEHAVIORAL POLYGRAPHS">
        <div
          style={{
            display: "flex",
            alignItems: "baseline",
            fontFamily: "Source Serif 4",
            fontWeight: 600,
            fontSize: 96,
            letterSpacing: -2,
            color: C.ink,
          }}
        >
          <div style={{ display: "flex" }}>polygraph</div>
          <div style={{ display: "flex", color: C.oxblood }}>.</div>
          <div style={{ display: "flex", color: C.muted }}>so</div>
        </div>
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            marginTop: 22,
            fontFamily: "Source Serif 4",
            fontWeight: 400,
            fontSize: 40,
            lineHeight: 1.22,
            color: C.muted,
          }}
        >
          <div style={{ display: "flex" }}>Independent, lab-evaluated</div>
          <div style={{ display: "flex" }}>trust grades for AI tools.</div>
        </div>
      </Frame>
    ),
    { ...size, fonts: await ogFonts() },
  );
}
