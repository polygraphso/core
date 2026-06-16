import { readFile } from "node:fs/promises";
import { join } from "node:path";

// process.cwd() is the Next.js project root (web/) at build time.
const FONT_DIR = join(process.cwd(), "app", "_og", "fonts");

// Loaded once per build per route; ImageResponse needs the raw TTF buffers.
export async function ogFonts() {
  const [serif600, serif400, mono400] = await Promise.all([
    readFile(join(FONT_DIR, "SourceSerif4-SemiBold.ttf")),
    readFile(join(FONT_DIR, "SourceSerif4-Regular.ttf")),
    readFile(join(FONT_DIR, "IBMPlexMono-Regular.ttf")),
  ]);
  return [
    { name: "Source Serif 4", data: serif600, style: "normal" as const, weight: 600 as const },
    { name: "Source Serif 4", data: serif400, style: "normal" as const, weight: 400 as const },
    { name: "IBM Plex Mono", data: mono400, style: "normal" as const, weight: 400 as const },
  ];
}
