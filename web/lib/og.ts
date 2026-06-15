/**
 * Shared bits for OG card generation (next/og ImageResponse).
 *
 * Fonts are committed TTFs in assets/fonts (satori can't use woff2, and
 * fetching from Google at request time would make card rendering depend
 * on an external host). Palette mirrors globals.css — keep in sync by
 * hand; ImageResponse can't read CSS variables.
 */

import { readFile } from "node:fs/promises";
import { join } from "node:path";

export const OG_SIZE = { width: 1200, height: 630 };

export const og = {
  parchment: "#f5f1e5",
  parchment50: "#faf7ee",
  ink: "#161512",
  inkMuted: "#5c5550",
  inkFaint: "#8a8378",
  rule: "#d9d2c2",
  oxblood: "#7a1f2b",
  grade: {
    A: "#2f5132",
    B: "#4f6b36",
    D: "#b85024",
    F: "#7a1f2b",
  } as Record<string, string>,
};

export async function ogFonts() {
  const [serif, mono] = await Promise.all([
    readFile(join(process.cwd(), "assets/fonts/SourceSerif4-SemiBold.ttf")),
    readFile(join(process.cwd(), "assets/fonts/IBMPlexMono-Regular.ttf")),
  ]);
  return [
    { name: "Source Serif 4", data: serif, style: "normal" as const, weight: 600 as const },
    { name: "IBM Plex Mono", data: mono, style: "normal" as const, weight: 400 as const },
  ];
}
