# brand

Visual identity assets for polygraph.so. SVGs are the source-of-truth for any web/print use; PNGs are the GitHub-ready exports built from the same designs.

## What's here

| File | What it is | Where to use it |
|---|---|---|
| `mark.svg` | Square logomark — polygraph oscillograph trace on ink ground | App icons, favicons, anywhere a single-glyph mark is wanted (web) |
| `mark.png` | 1024×1024 raster of the mark | **GitHub org avatar** (`polygraph-so`), Twitter/X, LinkedIn |
| `mark-512.png` | 512×512 raster of the mark | Upload UIs that cap at 512 |
| `wordmark.svg` | Horizontal mark + "polygraph.so" wordmark | README headers, deck title slides, email signatures |
| `social-preview.svg` | 1280×640 social preview composition | Source for the PNG below; embed anywhere SVG works |
| `social-preview.png` | 1280×640 raster of the above | **GitHub repo social preview** (Settings → Social preview) |
| `build.sh` | Rasterizer — composes the PNGs from `magick` primitives | Re-run any time the design changes |

> **Web mirror:** `web/public/brand/` holds copies of `mark.{svg,png}`,
> `mark-512.png`, `wordmark.svg`, and `social-preview.{svg,png}` so the
> `/brand-kit` page can serve them for download. If you change any source
> asset here, re-copy it into `web/public/brand/` — there is no build step
> that does this automatically.

## How to upload to GitHub

**Org avatar** (`polygraph-so`):
1. github.com/organizations/polygraph-so/settings/profile
2. Upload `mark.png` under "Profile picture"

**Repo social preview** (`polygraph-so/core`):
1. github.com/polygraph-so/core/settings (the General tab)
2. Scroll to "Social preview" → Edit → upload `social-preview.png`

GitHub will downscale automatically for the various places these appear (notifications, search, OG cards). Both files are already sized to GitHub's stated specs.

## Design notes

- **Logomark** is a polygraph trace: calm baseline · spike cluster · calm baseline — the same shape as the divider on the landing page hero. The tiny oxblood dot at the left baseline is the brand pulse, echoing the pulse-soft dot on the site's top stamp.
- **Wordmark** sets "polygraph" in a transitional serif (Source Serif 4 in the web SVG, Georgia in the PNG fallback), with ".so" in lighter italic and a red period — a quiet brand cue that scales down without breaking.
- **Palette**: ink `#161512`, parchment `#f5f1e5`, oxblood `#7a1f2b`, muted `#5c5550`, faint `#8a8378`, rule `#d9d2c2`. Same tokens as `web/app/globals.css`.

## Rebuilding

```bash
./build.sh
```

Requires ImageMagick 7 (`magick` on the PATH). Uses Georgia + SF Mono — both are macOS system fonts. On Linux the script will still run; the type will fall back to whatever serif/mono Fontconfig resolves to. If you redesign anything in `mark.svg` or change the brand palette, update the matching variables and waveform path in `build.sh` so the SVG and PNG stay in sync.

The PNGs are committed to the repo so you don't need ImageMagick installed just to upload them — they're ready to go straight from disk.

## Why magick draw and not just SVG-to-PNG

ImageMagick's native SVG renderer (MSVG) drops complex strokes. We compose the PNGs from draw primitives instead so the output is predictable. The SVGs are still real designs you can render in any browser or vector editor — they're just not the path we take to PNG.
