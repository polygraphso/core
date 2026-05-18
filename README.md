# poligrafo

Source-of-truth code repo for **poligrafo.ai** — independent, lab-evaluated trust grade for AI agents.

## Layout

```
poligrafo/
├── web/         # v0 landing page + waitlist (Next.js 16, App Router)
└── .claude/     # local dev tooling (preview launch config, etc.)
```

Future siblings (not yet built): `cli/` (the `npx poligrafo check` runtime), `probes/` (the litmus-test sandbox + probe pack), `infra/` (deploy plumbing).

## Strategy & decision log

Lives outside this repo, in `~/Documents/workspace/assistant/poligrafo/`:

- `pivot-2026-05-15.md` — current direction (read first when context shifts).
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
- Independence covenant is non-negotiable: **vendors never pay us.**
