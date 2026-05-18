# polygraph

Source-of-truth code repo for **polygraph.so** — independent, lab-evaluated trust grades for AI agents. (Originally `poligrafo.ai`; renamed for findability.)

## Layout

```
core/
├── web/         # launch landing page (Next.js 16, App Router)
├── brand/       # logomark, wordmark, social preview (SVG + PNG)
└── .claude/     # local dev tooling (preview launch config, etc.)
```

Future siblings (not yet built): `cli/` (the `npx polygraph check` runtime), `probes/` (the litmus-test sandbox + probe pack), `infra/` (deploy plumbing).

## Strategy & decision log

Lives outside this repo, in `~/Documents/workspace/assistant/polygraph/`:

- `pivot-2026-05-15.md` — current direction (read first when context shifts).
- `brand-foundation.md` — mission / vision / positioning / tagline / voice / principles. Settled core.
- `landing-brief.md` — content + tone + visual spec the landing page is built against.
- `litmus-test-v1.md` — MCP behavioral evaluation spec (5 probes / 4 categories).

## Working on the landing page

```bash
cd web
pnpm install   # if you haven't
pnpm dev       # http://localhost:3000
pnpm build     # production build (also typechecks)
```

Hosted on Vercel or Cloudflare Pages — either works. The waitlist endpoint at `app/api/waitlist/route.ts` is a v0 placeholder: validates + logs. Swap for the chosen email service before launch.

## Conventions

- Pre-traction default: anything not gating litmus-v1 + landing is parking-lot.
- Clean slate from Talent Protocol heritage. Don't drag in Builder Score, Talent Passport, or other legacy concepts.
- Independence is disclosure-based, not refusal-based — see `brand-foundation.md` principle #1.
