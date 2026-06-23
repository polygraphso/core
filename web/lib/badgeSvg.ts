/**
 * The inline badge: a self-contained static SVG string — no <script>, no
 * animation, no embedded font. That's what keeps it ~1 KB, crisp at any DPI,
 * and safe through GitHub's camo image proxy (which strips scripts and
 * animation but renders static SVG fine).
 *
 * Layout (Glama-style): a single dark pill — the grade on the left, then the
 * polygraph waveform mark and wordmark aligned right.
 *
 * Text width: we don't embed a font, so we can't measure glyphs. We use a
 * monospace font stack (a nod to the IBM Plex Mono brand) where every advance
 * is uniform, estimate width as charCount × a conservative advance, and pad
 * generously so cross-platform metric variance never clips the text.
 */

import type { LitmusGrade } from "@/lib/hostedGrades";
import { DARK_GRADE_HEX, BADGE_PALETTE } from "@/lib/gradeColors";

const HEIGHT = 20;
const FONT = 11;
const PAD = 7; // horizontal padding inside each cell
const CHAR = 6.6; // monospace advance at 11px — conservative, system-stable enough
const RADIUS = 3;
const BASELINE = 14; // text baseline for a 20px-tall badge at 11px
const FONT_FAMILY =
  "ui-monospace,SFMono-Regular,'SF Mono',Menlo,Consolas,'Liberation Mono',monospace";

const WORD = "polygraph";
const ICON_W = 17; // waveform mark width
const ICON_GAP = 5; // gap between mark and wordmark

const PILL_BG = BADGE_PALETTE.ink; // #161512
const LIGHT = BADGE_PALETTE.parchment; // wordmark + mark, readable on ink
const DIVIDER = BADGE_PALETTE.muted; // faint cell divider
const DOT = BADGE_PALETTE.oxblood; // brand pulse dot on the trace

function esc(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

/** A dark pill: `gradeText` (in `gradeColor`) on the left, mark + wordmark right. */
function renderBadge({
  gradeText,
  gradeColor,
  title,
}: {
  gradeText: string;
  gradeColor: string;
  title: string;
}): string {
  const leftW = Math.round(gradeText.length * CHAR + PAD * 2);
  const rightW = Math.round(PAD + ICON_W + ICON_GAP + WORD.length * CHAR + PAD);
  const w = leftW + rightW;

  const gradeX = leftW / 2;
  const iconX = leftW + PAD; // mark left edge
  const wordX = iconX + ICON_W + ICON_GAP; // wordmark left edge (anchored start)

  // Compact oscillograph trace, ~17 wide, vertically centered (mid y = 10).
  const wf =
    `M${iconX} 10 L${iconX + 3} 10 L${iconX + 5} 5 L${iconX + 7} 15 ` +
    `L${iconX + 9} 4 L${iconX + 11} 16 L${iconX + 13} 7 L${iconX + 15} 11 L${iconX + 17} 10`;

  return `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${HEIGHT}" viewBox="0 0 ${w} ${HEIGHT}" role="img" aria-label="${esc(title)}">
  <title>${esc(title)}</title>
  <linearGradient id="s" x2="0" y2="100%">
    <stop offset="0" stop-color="#fff" stop-opacity=".06"/>
    <stop offset="1" stop-opacity=".20"/>
  </linearGradient>
  <clipPath id="r"><rect width="${w}" height="${HEIGHT}" rx="${RADIUS}"/></clipPath>
  <g clip-path="url(#r)">
    <rect width="${w}" height="${HEIGHT}" fill="${PILL_BG}"/>
    <rect width="${w}" height="${HEIGHT}" fill="url(#s)"/>
  </g>
  <rect x=".5" y=".5" width="${w - 1}" height="${HEIGHT - 1}" rx="2.5" fill="none" stroke="#fff" stroke-opacity=".18"/>
  <line x1="${leftW}" y1="4.5" x2="${leftW}" y2="15.5" stroke="${DIVIDER}" stroke-opacity=".55"/>
  <path d="${wf}" fill="none" stroke="${LIGHT}" stroke-width="1.4" stroke-linecap="round" stroke-linejoin="round"/>
  <circle cx="${iconX + 1.5}" cy="10" r="1.5" fill="${DOT}"/>
  <g font-family="${FONT_FAMILY}" font-size="${FONT}">
    <text x="${gradeX}" y="${BASELINE}" text-anchor="middle" font-weight="700" fill="${gradeColor}">${esc(gradeText)}</text>
    <text x="${wordX}" y="${BASELINE}" fill="${LIGHT}">${esc(WORD)}</text>
  </g>
</svg>`;
}

/** Inline badge for a grade, or the muted "unrated" pill when grade is null. */
export function renderBadgeSvg({ grade }: { grade: LitmusGrade | null }): string {
  if (grade == null) {
    return renderBadge({
      gradeText: "unrated",
      gradeColor: BADGE_PALETTE.faint,
      title: "polygraph: unrated",
    });
  }
  return renderBadge({
    gradeText: grade,
    gradeColor: DARK_GRADE_HEX[grade],
    title: `polygraph: ${grade}`,
  });
}

/** Visible fallback for a malformed `?server=` ref (never a broken image). */
export function renderInvalidBadge(): string {
  return renderBadge({
    gradeText: "invalid ref",
    gradeColor: BADGE_PALETTE.faint,
    title: "polygraph: invalid server ref",
  });
}
