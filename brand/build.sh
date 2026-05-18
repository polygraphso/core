#!/usr/bin/env bash
# Rasterize the poligrafo brand assets to PNG.
#
# ImageMagick's native SVG renderer (MSVG) drops complex strokes, so we
# compose the PNGs programmatically here instead of converting from SVG.
# The SVGs in this folder remain the source-of-truth for web use; the
# PNGs are GitHub-ready exports built from the same design.
#
# Requires: ImageMagick 7 (`magick`). Georgia is used as the serif
# fallback for "Source Serif 4" since the project font isn't a system
# font — close enough in character for an avatar / social card.

set -euo pipefail

here="$(cd "$(dirname "$0")" && pwd)"
cd "$here"

INK="#161512"
PARCHMENT="#f5f1e5"
OXBLOOD="#7a1f2b"
MUTED="#5c5550"
FAINT="#8a8378"
RULE="#d9d2c2"

SERIF="Georgia"
SERIF_BOLD="Georgia-Bold"
SERIF_ITALIC="Georgia-Italic"
MONO=".SF-NS-Mono"

# Waveform path used in every mark — calm baseline, spike cluster, calm baseline.
# Drawn in a 512x512 coordinate system; scale at use.
WAVEFORM_512='
  stroke-linecap round stroke-linejoin round
  path "M 48,256 L 120,256 L 150,248 L 180,264 L 210,256 \
        L 230,200 L 246,312 L 262,184 L 278,326 L 294,196 L 310,320 \
        L 326,232 L 342,280 L 358,220 L 374,292 L 390,256 \
        L 420,256 L 464,256"
'

# ─────────────────────────────────────────────────────────────────────────────
# mark.png — 1024x1024 logomark (org avatar source; downsize for favicons)
# ─────────────────────────────────────────────────────────────────────────────
echo "building mark.png (1024x1024)…"
magick -size 1024x1024 xc:none \
  -fill "$INK" -draw "roundrectangle 0,0 1023,1023 144,144" \
  -fill none -stroke "$MUTED" -strokewidth 3 \
  -draw "stroke-dasharray 12,20 line 96,512 928,512" \
  -fill none -stroke "$PARCHMENT" -strokewidth 20 \
  -draw "scale 2,2 stroke-linecap round stroke-linejoin round $WAVEFORM_512" \
  -fill "$OXBLOOD" -stroke none -draw "circle 172,512 172,526" \
  mark.png

# ─────────────────────────────────────────────────────────────────────────────
# mark-512.png — secondary size convenient for some upload UIs
# ─────────────────────────────────────────────────────────────────────────────
echo "building mark-512.png (512x512)…"
magick mark.png -resize 512x512 mark-512.png

# ─────────────────────────────────────────────────────────────────────────────
# social-preview.png — 1280x640 (GitHub repo social preview spec)
# ─────────────────────────────────────────────────────────────────────────────
echo "building social-preview.png (1280x640)…"
magick -size 1280x640 "xc:$PARCHMENT" \
  `# Top hairline` \
  -fill none -stroke "$RULE" -strokewidth 1 \
  -draw "line 64,56 1216,56" \
  `# Top stamp dot` \
  -fill "$OXBLOOD" -stroke none \
  -draw "circle 74,85 80,85" \
  `# Top stamp text (mono, spaced)` \
  -fill "$MUTED" -stroke none -font "$MONO" -pointsize 16 \
  -gravity NorthWest -annotate +94+76 "P O L I G R A F O . A I" \
  -fill "$FAINT" \
  -gravity NorthEast -annotate +64+76 "P O L Y G R A P H - S O   /   C O R E" \
  `# Logomark — composited from the just-built mark.png at the right size` \
  \( mark.png -resize 200x200 \) \
  -gravity NorthWest -geometry +64+136 -composite \
  `# Wordmark` \
  -fill "$INK" -stroke none -font "$SERIF_BOLD" -pointsize 92 \
  -gravity NorthWest -annotate +296+156 "poligrafo" \
  -fill "$OXBLOOD" -font "$SERIF_BOLD" -pointsize 92 \
  -annotate +746+156 "." \
  -fill "$MUTED" -font "$SERIF_ITALIC" -pointsize 92 \
  -annotate +770+156 "ai" \
  `# Positioning headline (two lines)` \
  -fill "$MUTED" -font "$SERIF" -pointsize 38 \
  -annotate +296+278 "Independent, lab-evaluated" \
  -annotate +296+330 "trust grades for AI agents." \
  `# Bottom rule + polygraph trace echo` \
  -fill none -stroke "$RULE" -strokewidth 1 \
  -draw "stroke-dasharray 4,8 line 64,540 1216,540" \
  -fill none -stroke "$OXBLOOD" -strokewidth 2.4 \
  -draw "stroke-linecap round stroke-linejoin round \
         path 'M 64,540 L 300,540 L 320,532 L 340,548 L 360,540 \
               L 380,508 L 398,572 L 416,500 L 434,576 L 452,510 L 470,568 \
               L 488,520 L 506,554 L 524,514 L 542,562 L 560,540 \
               L 820,540 L 850,534 L 880,546 L 910,540 L 1216,540'" \
  `# Footer caption (mono, low-key)` \
  -fill "$FAINT" -stroke none -font "$MONO" -pointsize 13 \
  -gravity NorthWest -annotate +64+590 "B A S E L I N E   ·   A D V E R S A R I A L   P R O B E S   ·   B A S E L I N E" \
  -gravity NorthEast -annotate +64+590 "P O L I G R A F O . A I" \
  social-preview.png

echo "done."
echo
ls -la *.png
