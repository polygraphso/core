/**
 * The inline shields-style badge: a self-contained static SVG string — no
 * <script>, no animation, no embedded font. That's what keeps it ~1 KB, crisp
 * at any DPI, and safe through GitHub's camo image proxy (which strips scripts
 * and animation but renders static SVG fine).
 *
 * Text width: we don't embed a font, so we can't measure glyphs. We use a
 * monospace font stack (a nod to the IBM Plex Mono brand) where every advance
 * is uniform, estimate width as charCount × a conservative advance, and pad
 * generously so cross-platform metric variance never clips the text.
 */

import type { LitmusGrade } from "@/lib/hostedGrades";
import { GRADE_HEX, BADGE_PALETTE } from "@/lib/gradeColors";

const HEIGHT = 20;
const FONT = 11;
const PAD = 7; // horizontal padding inside each segment
const CHAR = 6.6; // monospace advance at 11px — conservative, system-stable enough
const RADIUS = 3;
const FONT_FAMILY =
  "ui-monospace,SFMono-Regular,'SF Mono',Menlo,Consolas,'Liberation Mono',monospace";

function esc(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

/** Segment width = text width + padding, rounded. */
function segWidth(text: string): number {
  return Math.round(text.length * CHAR + PAD * 2);
}

interface Pill {
  label: string; // left text, on ink
  value: string; // right text, on `valueBg`
  valueBg: string; // right-segment fill
  title: string; // accessible name + hover tooltip
}

function renderPill({ label, value, valueBg, title }: Pill): string {
  const lw = segWidth(label);
  const vw = segWidth(value);
  const w = lw + vw;
  const labelX = lw / 2;
  const valueX = lw + vw / 2;
  const baseline = 14; // for a 20px-tall badge at 11px text

  // Two passes of each label: a faint dark drop-shadow then the light glyph —
  // the shields.io legibility trick. Light text reads on both the ink label and
  // every (dark) grade fill / muted "unrated" fill.
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${HEIGHT}" viewBox="0 0 ${w} ${HEIGHT}" role="img" aria-label="${esc(title)}">
  <title>${esc(title)}</title>
  <linearGradient id="s" x2="0" y2="100%">
    <stop offset="0" stop-color="#fff" stop-opacity=".08"/>
    <stop offset="1" stop-opacity=".10"/>
  </linearGradient>
  <clipPath id="r"><rect width="${w}" height="${HEIGHT}" rx="${RADIUS}"/></clipPath>
  <g clip-path="url(#r)">
    <rect width="${lw}" height="${HEIGHT}" fill="${BADGE_PALETTE.ink}"/>
    <rect x="${lw}" width="${vw}" height="${HEIGHT}" fill="${valueBg}"/>
    <rect width="${w}" height="${HEIGHT}" fill="url(#s)"/>
  </g>
  <g fill="#fff" text-anchor="middle" font-family="${FONT_FAMILY}" font-size="${FONT}">
    <text x="${labelX}" y="${baseline + 1}" fill="#000" fill-opacity=".25">${esc(label)}</text>
    <text x="${labelX}" y="${baseline}">${esc(label)}</text>
    <text x="${valueX}" y="${baseline + 1}" fill="#000" fill-opacity=".25" font-weight="700">${esc(value)}</text>
    <text x="${valueX}" y="${baseline}" font-weight="700">${esc(value)}</text>
  </g>
</svg>`;
}

/** Inline badge for a grade, or the muted "unrated" pill when grade is null. */
export function renderBadgeSvg({ grade }: { grade: LitmusGrade | null }): string {
  if (grade == null) {
    return renderPill({
      label: "polygraph",
      value: "unrated",
      valueBg: BADGE_PALETTE.muted,
      title: "polygraph: unrated",
    });
  }
  return renderPill({
    label: "polygraph",
    value: grade,
    valueBg: GRADE_HEX[grade],
    title: `polygraph: ${grade}`,
  });
}

/** Visible fallback for a malformed `?server=` ref (never a broken image). */
export function renderInvalidBadge(): string {
  return renderPill({
    label: "polygraph",
    value: "invalid ref",
    valueBg: BADGE_PALETTE.muted,
    title: "polygraph: invalid server ref",
  });
}
