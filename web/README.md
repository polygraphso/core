# web — polygraph.so site

The polygraph.so site (Next.js 16, App Router): the landing page plus the MCP Security Index, per-server and per-skill grade reports, ecosystem indices, blog, and the embeddable grade badge. Voice, positioning, and standing conventions live in the repo's `CLAUDE.md` and `../README.md`; the behavioral methodology is the litmus spec, mirrored at [polygraph.so/methodology](https://polygraph.so/methodology).

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
├── page.tsx                # the landing page (composes the sections below)
├── globals.css             # design tokens, paper grain, animations
├── rankings/               # the MCP Security Index — adoption-ranked, grade column
├── mcp/[...ref]/           # per-server grade report
├── skill/[...ref]/         # per-skill grade report
├── bankr/ · base/          # unlisted ecosystem indices
├── fix/                    # remediation guidance for a non-A report
├── notify/ · request/      # demand funnels (notify-on-grade · request-a-grade)
├── brand-kit/ · blog/ · docs/api/   # brand assets · blog · API reference
├── _og/                    # OG image generation (next/og)
├── _components/            # shared UI — key ones below
└── api/                    # cli/check · cli/list · badge (+ /badge/card) · grade-requests · waitlist · notify
```

Key `_components`: `Hero` / `HeroPolygraph` / `Install` (landing hero + CLI install),
`HowWeTest` (§02, mirrors the litmus categories), `WhereWeSit` (§03 positioning),
`ChecksSoFar` / `ChecksSoFarView` / `checksMapper` (the published-grade browser — reads
`hosted_runs` and maps both server `C-01..C-04` and skill `S-01/S-03/S-04` rows),
`EmbedYourGrade` (badge/card embed snippets), `FixCta` (the "How to fix" link on non-A
reports), `SiteHeader` / `MobileNav` / `Footer` (chrome). `WaitlistForm` is a legacy
two-field form (unused); `MinimalSignup` posts to `/api/waitlist`.

## Design system

Tokens live in `app/globals.css` under `@theme inline`. Palette is **warm parchment** + **ink** + a single **oxblood** accent, plus a five-step **grade scale** (A → F). Type pairing: Source Serif 4 for display, IBM Plex Sans for body, IBM Plex Mono for evidence/CLI/labels.

Aesthetic target: arXiv-preprint / lab-report **for the chrome**, product-page **for the posture**. Avoid SaaS marketing tropes — no padlock icons, no shield iconography, no green-checkmark trust badges, no purple gradients.

## Current state

Shipped and live. The landing hero leads with the tagline ("We polygraph AI tools so you don't have to."), positioning as the sub-headline, and a single primary CTA — **Install the CLI** (`npx polygraphso check <mcp-server>`). Behavioral grades are live across the site, read from the shared `hosted_runs` table: the MCP Security Index (`/rankings`), per-server (`/mcp`) and per-skill (`/skill`) reports, and the homepage grade browser (`ChecksSoFar`). The `polygraphso` CLI and `@polygraphso/mcp` are published; the `/methodology` page is live. Per the three-layer model, **the CLI is a thin lookup over precomputed grades — it does not run probes locally**; an unevaluated server returns "not available yet" with a notify link.

Open follow-ups:

- `app/api/waitlist/route.ts` stays a lightweight validate+log endpoint — the `/notify` and `/request` funnels carry the real demand capture (`notify_requests` / `grade_requests`).
- Onchain minting is built but not yet wired, so grades publish without an attestation for now (they become onchain-verifiable when minting goes live).

## Spec source-of-truth

`§ 02 How we test` in `app/_components/HowWeTest.tsx` is anchored to the current litmus methodology (see the `/methodology` page; presently `litmus-v11`). Four categories, nine probes, all live: **C-01** (1.1, 1.2, 1.3), **C-02** (2.1, 2.2), **C-03** (4.1, 4.2), **C-04** (3.1, 3.2). **Secrets handling is not in the spec** — do not re-add without updating the spec first.

`§ 03 Browse the checks we've run` (`ChecksSoFar` / `ChecksSoFarView`) renders **both** MCP-server grades and **Claude Code skill** grades from `hosted_runs`, with a search box and an `All / MCP servers / Skills` type filter. Skill grades come from a **separate** methodology, `litmus-skill-v2` — a deterministic static scan (**S-01** prompt injection, **S-03** data-exfiltration instructions, **S-04** dangerous commands in bundled scripts) anchored by a whole-directory **content hash**, plus an advisory, never-lettered quality signal. A skill **A means static-clean, not behavioral proof.** The server-vs-skill split keys off `target_kind` and the per-kind row mapping lives in `checksMapper.ts` (server `C-01..C-04` vs skill `S-01/S-03/S-04`).
