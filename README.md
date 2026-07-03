# polygraph

Source-of-truth code repo for **polygraph.so** — independent, lab-evaluated trust grades for AI agents: MCP servers (behavioral litmus) and Claude Code / Agent Skills (static litmus). (Originally `poligrafo.ai`; renamed for findability.)

## Layout

```
core/
├── web/              # the polygraph.so site (Next.js 16, App Router): landing, the MCP
│                     #   Security Index (/rankings), per-server (/mcp) & per-skill (/skill)
│                     #   grade reports, ecosystem indices (/bankr, /base), blog, brand kit,
│                     #   API docs, and the embeddable grade badge/card (/api/badge)
├── packages/
│   ├── core/         # @polygraph/core — the data model: Supabase migrations (append-only),
│   │                 #   row types, server identity. Owns the shared `hosted_runs` schema.
│   ├── scoring/      # @polygraph/scoring — the daily adoption-signal pipeline
│   │                 #   (npm/pypi/github + OpenSSF + Glama/Smithery + deps.dev)
│   └── cli/          # polygraphso — the published lookup CLI (sub-second over precomputed grades)
├── brand/            # logomark, wordmark, social preview (SVG + PNG)
└── .claude/          # local dev tooling (preview launch config, etc.)
```

The grading **engine** (the litmus probes) and the deploy **infra** live in the separate
`litmus` (`@polygraphso/litmus`, public) and `hosted-service` (private) repos. The behavioral
grades the site reads are written to the shared `hosted_runs` table by the hosted-service
runner; `packages/core` owns that table's schema.

## Strategy & decision log

The cross-repo map and standing conventions live in this repo's `CLAUDE.md` and the
workspace-level `CLAUDE.md` (the `polygraph` workspace root, alongside `litmus/` and
`hosted-service/`). The behavioral methodology (categories C-01..C-04, probes, A–F rubric)
is the litmus spec — `hosted-service/docs/litmus-test.md`, mirrored publicly at
[polygraph.so/methodology](https://polygraph.so/methodology).

## Working on the site

```bash
cd web
pnpm install   # if you haven't
pnpm dev       # http://localhost:3000
pnpm build     # production build (also typechecks)
```

Deployed on Vercel. The site is live; grade reads come from the shared `hosted_runs` table. The `/notify` and `/request` funnels capture demand (notify-on-grade and request-a-grade); `app/api/waitlist/route.ts` remains a lightweight validate+log endpoint.

## Conventions

- Keep changes scoped to what a task needs — don't add features, abstractions, or shims ahead of demand.
- Clean slate from Talent Protocol heritage. Don't drag in Builder Score, Talent Passport, or other legacy concepts.
- Independence is disclosure-based, not refusal-based (see `CLAUDE.md`).
