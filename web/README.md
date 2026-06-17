# web — polygraph.so landing page

Launch landing page. Built against `landing-brief.md` in the strategy folder, with `pivot-2026-05-15.md` (three-layer architecture) and `brand-foundation.md` (voice / positioning / principles) as supporting source-of-truth.

## Stack

- Next.js 16 (App Router, Turbopack)
- React 19
- Tailwind CSS v4 (CSS-first, `@theme inline` tokens in `app/globals.css`)
- TypeScript
- Fonts: Source Serif 4 + IBM Plex Sans + IBM Plex Mono, all self-hosted via `next/font/google`

## Dev

```bash
pnpm install
pnpm dev          # http://localhost:3000
pnpm build        # production build + typecheck
pnpm start        # serve the built output
```

## Layout

```
app/
├── layout.tsx              # fonts + metadata + html shell
├── page.tsx                # composes the sections in order
├── globals.css             # design tokens, paper grain, animations
├── icon.svg                # polygraph waveform favicon
├── _components/
│   ├── Hero.tsx            # nav strip + tagline H1 + positioning subhead + CTAs + install card
│   ├── InstallCard.tsx     # copy-paste $ npx polygraphso check + lookup-flow steps
│   ├── PolygraphTrace.tsx  # oscillograph divider SVG
│   ├── Problem.tsx         # § 01
│   ├── HowWeTest.tsx       # § 02 — categories mirror litmus-test.md
│   ├── WhereWeSit.tsx      # § 03 — three-axis table
│   ├── GradesUpdates.tsx   # quiet down-page "notify me when grades publish" tile
│   ├── Footer.tsx          # tagline + vision + contact + disclosures
│   ├── SectionHeader.tsx
│   ├── MinimalSignup.tsx   # single-field signup, posts to /api/waitlist
│   └── WaitlistForm.tsx    # legacy two-field form (currently unused)
└── api/
    └── waitlist/route.ts   # v0 placeholder — validates + logs. Swap before launch.
```

## Design system

Tokens live in `app/globals.css` under `@theme inline`. Palette is **warm parchment** + **ink** + a single **oxblood** accent, plus a five-step **grade scale** (A → F). Type pairing: Source Serif 4 for display, IBM Plex Sans for body, IBM Plex Mono for evidence/CLI/labels.

Aesthetic target: arXiv-preprint / lab-report **for the chrome**, product-page **for the posture**. Avoid SaaS marketing tropes — no padlock icons, no shield iconography, no green-checkmark trust badges, no purple gradients.

## Launch posture

Page is built for **launch-with-product**. Hero leads with the tagline ("We polygraph AI tools so you don't have to."), positioning sits as the sub-headline ("Independent, lab-evaluated trust grades for MCP servers and the agents that use them. Free public grades. CLI for runtime checks."). The single primary CTA is **Install the CLI**. The waitlist demotes to a single-field "notify me when grades publish" tile down-page. "PREPRINT V0.1 / DEPOSITED" framing is off the main landing.

The `Hero` includes a copy of `npx polygraphso check <mcp-server>` plus a three-step explanation of what the CLI does. Per pivot's three-layer model: **the CLI is a thin lookup over precomputed grades (layer 3) — it does not run probes locally.** If a server isn't yet evaluated, the CLI returns `queued, position #N` and notifies on completion.

## Launch dependencies (gate v1 ship)

The brief is firm: *if real grades aren't ready, the page isn't ready.* Track both:

- [ ] **`npx polygraphso` CLI binary is publishable.** The hero install card surfaces `npx polygraphso check <mcp-server>` as the primary CTA — that command needs to actually work. Replace the three-step explainer with embedded asciinema of a real run when available.
- [ ] **Grading pipeline has produced ≥1 Top-10 real grade with a working evidence link.** The Public-grades matrix (formerly `Top50.tsx`) has been **pulled** until this lands — an empty grid actively undercuts credibility per the brief. Restore the section with real `cells` data when the pipeline ships output. Renumber subsequent sections accordingly.

## Before launch (rest of the checklist)

- [ ] Swap `app/api/waitlist/route.ts` for a real subscription endpoint (ConvertKit / Buttondown / Loops / Postgres). The `MinimalSignup` component posts `{ email, source }`.
- [ ] Wire the methodology link in `HowWeTest.tsx` (and footer) to the published `/methodology` page.
- [ ] Add a real OG image (currently inferred from metadata).
- [ ] Lighthouse audit: a11y must pass.

## Spec source-of-truth

`§ 02 How we test` in `app/_components/HowWeTest.tsx` is anchored to `litmus-test.md` (litmus-v5). Four categories, nine probes, all live: **C-01** (1.1, 1.2, 1.3), **C-02** (2.1, 2.2), **C-03** (4.1, 4.2), **C-04** (3.1, 3.2). **Secrets handling is not in the spec** — do not re-add without updating the spec first.
