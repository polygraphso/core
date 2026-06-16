# Brand-kit page — design

**Date:** 2026-06-16
**Status:** Approved, ready for implementation plan
**Route:** `/brand-kit`

## Purpose

A public brand-kit page for polygraph.so that lets press, partners, and the
community grab the logo assets and reference the core palette and typography.
Scope is **Essentials**: logos (with downloads), color palette, typography. No
usage rules, clearspace specs, press boilerplate, or download-all zip — those
are explicitly deferred.

This ships alongside the three gated PRs (a GTM-timed merge), so it must be a
self-contained change with no dependency on those PRs.

## Conventions to follow

The page mirrors the existing subpages `web/app/methodology/page.tsx` and
`web/app/docs/api/page.tsx`:

- Static server component (no client JS).
- `<main className="flex-1">` wrapping an `<article className="mx-auto max-w-3xl px-6 pt-14 pb-24 md:pt-20 md:pb-32">`.
- A locally-defined `Section` helper with a numbered `§NN` mono label and a
  Source Serif 4 heading. Each subpage defines its own `Section` — match that,
  do **not** extract a shared component.
- Brand tokens from `web/app/globals.css`: parchment background, ink text,
  oxblood accent, `hairline` rule borders, `section-label` mono labels.
- `metadata` export with `title`, `description`, and
  `alternates: { canonical: "/brand-kit" }`.

Heed `web/AGENTS.md`: this Next.js may differ from training data — consult
`web/node_modules/next/dist/docs/` before guessing at App Router / metadata
APIs.

## Asset serving

`brand/` lives at the repo root; the site deploys from `web/`. Next.js only
serves files under `web/public/`. Therefore:

- Copy the already-built brand assets into `web/public/brand/`:
  - `mark.svg`, `mark.png` (1024), `mark-512.png`
  - `wordmark.svg`
  - `social-preview.svg`, `social-preview.png`
- These are committed (copies, not symlinks — symlinks are fragile across
  build systems / Vercel).
- Add one line to `brand/README.md` noting that `web/public/brand/` mirrors
  these files and must be re-copied if the source assets change. This is the
  drift guard; no build automation is added.
- No new assets are generated. The page only exposes what `brand/build.sh`
  already produces. (`wordmark` is SVG-only by design — there is no wordmark
  PNG to link.)

Download links use the `download` attribute pointing at `/brand/<file>`.

## Page structure

1. **Header** — `section-label` eyebrow, `<h1>` "Brand kit", one-line serif
   intro: assets and the basics for polygraph.so; SVGs are source-of-truth,
   PNGs are ready-to-use exports.

2. **§01 Logo** — render `mark.svg` and `wordmark.svg` inline on a parchment
   panel (bordered with `hairline`). Download rows:
   - Mark → `mark.svg` · `mark.png` (1024) · `mark-512.png`
   - Wordmark → `wordmark.svg`
   - Social preview (smaller sub-row) → `social-preview.svg` · `social-preview.png`

3. **§02 Color** — swatch grid of the six core tokens, each showing a color
   chip, the human name, the hex, and the CSS variable:
   - ink `#161512` (`--color-ink`)
   - parchment `#f5f1e5` (`--color-parchment`)
   - oxblood `#7a1f2b` (`--color-oxblood`)
   - ink-muted `#5c5550` (`--color-ink-muted`)
   - ink-faint `#8a8378` (`--color-ink-faint`)
   - rule `#d9d2c2` (`--color-rule`)

   A smaller secondary row for the five-grade scale (it is part of the
   identity): grade-a `#2f5132`, grade-b `#4f6b36`, grade-c `#a86b19`,
   grade-d `#b85024`, grade-f `#7a1f2b`.

   Hex/token values are taken verbatim from `globals.css` — the page must not
   invent or drift from those.

4. **§03 Typography** — three specimens, each with role label and a sample
   line:
   - **Source Serif 4** — display / headings (`--font-serif`)
   - **IBM Plex Sans** — body / UI (`--font-sans`)
   - **IBM Plex Mono** — labels / code (`--font-mono`)

5. **§04 See also** — dotted-underline links (matching `/methodology`) back to
   `/`, `/methodology`, `/docs/api`.

## Footer change

In `web/app/_components/Footer.tsx`, add a "Brand kit →" link beneath the
existing "Methodology →" link in the CLI column (where the resource links
already sit). Same styling: `font-sans text-[11.5px]`, `text-ink
hover:text-oxblood transition-colors`. No new column or structural change.

## Out of scope (deferred)

- Usage do/don't rules and clearspace / minimum-size specs.
- Press boilerplate, name/pronunciation note, press contact.
- A "download all" zip / archive build step.
- Generating any new asset (e.g. a wordmark PNG).
- Refactoring the shared `Section` pattern into one component.

## Verification

- `pnpm dev` in `web/`, load `/brand-kit`: page renders, logos visible, all
  download links resolve (200) and download the right file.
- Footer "Brand kit →" link navigates to `/brand-kit`.
- Build passes (`pnpm build`) and no type errors.
