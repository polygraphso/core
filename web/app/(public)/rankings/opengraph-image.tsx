import { ImageResponse } from "next/og";
import { Frame, OG_SIZE, OG_CONTENT_TYPE, OG_COLORS as C } from "@/app/_og/Frame";
import { ogFonts } from "@/app/_og/fonts";

export const alt = "The MCP Security Index — most-adopted MCP servers, graded for behavior";
export const size = OG_SIZE;
export const contentType = OG_CONTENT_TYPE;

export default async function Image() {
  return new ImageResponse(
    (
      <Frame rightLabel="MCP SECURITY INDEX">
        <div style={{ display: "flex", flexDirection: "column" }}>
          <div
            style={{
              display: "flex",
              fontFamily: "Source Serif 4",
              fontWeight: 600,
              fontSize: 84,
              letterSpacing: -2,
              color: C.ink,
            }}
          >
            The MCP Security Index
          </div>
          <div
            style={{
              display: "flex",
              marginTop: 22,
              fontFamily: "Source Serif 4",
              fontWeight: 400,
              fontSize: 36,
              lineHeight: 1.22,
              color: C.muted,
            }}
          >
            Most-adopted MCP servers, graded for behavior.
          </div>
        </div>
      </Frame>
    ),
    { ...size, fonts: await ogFonts() },
  );
}
