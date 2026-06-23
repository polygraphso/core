/**
 * Single source of truth for grade colors used by the standalone badge/card
 * images. SVG strings and Satori (next/og) render outside the DOM, so they
 * cannot read the `--color-grade-*` CSS variables defined in app/globals.css —
 * the hexes must be inlined here.
 *
 * Keep GRADE_HEX / UNRATED_HEX / BADGE_PALETTE in sync with the tokens in
 * app/globals.css (the `--color-grade-*`, `--color-ink*`, etc. block). They are
 * the same values in two forms; this file is the machine-readable copy.
 */

import type { LitmusGrade } from "@/lib/hostedGrades";

/** Grade letter → hex. Mirrors `--color-grade-*` in app/globals.css. */
export const GRADE_HEX: Record<LitmusGrade, string> = {
  A: "#2f5132",
  B: "#4f6b36",
  C: "#a86b19",
  D: "#b85024",
  F: "#7a1f2b",
};

/**
 * Grade letter → hex, brightened for legibility on the dark badge pill. The
 * GRADE_HEX values are tuned for the parchment ground and read as muddy on ink,
 * so the inline badge (lib/badgeSvg) uses these lifted variants instead.
 */
export const DARK_GRADE_HEX: Record<LitmusGrade, string> = {
  A: "#6aa56f",
  B: "#8cad5e",
  C: "#d39a45",
  D: "#db7a4a",
  F: "#cf5567",
};

/**
 * Grade letter → CSS variable, for in-DOM React components that want to stay
 * theme-aware (e.g. ChecksSoFarView). The values resolve to GRADE_HEX above.
 */
export const GRADE_VAR: Record<LitmusGrade, string> = {
  A: "var(--color-grade-a)",
  B: "var(--color-grade-b)",
  C: "var(--color-grade-c)",
  D: "var(--color-grade-d)",
  F: "var(--color-grade-f)",
};

/**
 * Accent for the "unrated" (no published grade) state on a light ground —
 * `--color-ink-faint`. Used for the card's big "—" and the page accent. The
 * inline badge pill uses the darker `BADGE_PALETTE.muted` instead, because its
 * value text is white and needs more contrast (see lib/badgeSvg.ts).
 */
export const UNRATED_HEX = "#8a8378";

/** Non-grade palette for the standalone images. Mirrors app/globals.css. */
export const BADGE_PALETTE = {
  ink: "#161512", // --color-ink (badge left-label background)
  parchment: "#f5f1e5", // --color-parchment (letter on grade fill)
  rule: "#d9d2c2", // --color-rule
  oxblood: "#7a1f2b", // --color-oxblood
  faint: "#8a8378", // --color-ink-faint
  muted: "#5c5550", // --color-ink-muted (badge "unrated" fill — readable under white text)
} as const;
