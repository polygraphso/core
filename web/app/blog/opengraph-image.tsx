import { ImageResponse } from "next/og";
import { Frame, OG_SIZE, OG_CONTENT_TYPE, OG_COLORS as C } from "../_og/Frame";
import { ogFonts } from "../_og/fonts";

export const alt = "polygraph.so blog — notes on independent AI safety testing";
export const size = OG_SIZE;
export const contentType = OG_CONTENT_TYPE;

export default async function Image() {
  return new ImageResponse(
    (
      <Frame rightLabel="BLOG">
        <div
          style={{
            display: "flex",
            fontFamily: "Source Serif 4",
            fontWeight: 600,
            fontSize: 100,
            letterSpacing: -2,
            color: C.ink,
          }}
        >
          Blog
        </div>
        <div
          style={{
            display: "flex",
            marginTop: 18,
            fontFamily: "Source Serif 4",
            fontWeight: 400,
            fontSize: 36,
            lineHeight: 1.25,
            color: C.muted,
            maxWidth: 880,
          }}
        >
          Notes on independent AI safety testing — how the polygraphs are built,
          graded, and funded.
        </div>
      </Frame>
    ),
    { ...size, fonts: await ogFonts() },
  );
}
