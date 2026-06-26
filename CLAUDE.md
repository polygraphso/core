# polygraph — workspace context for Claude

This is the source-of-truth code repo for **polygraph.so** (formerly `poligrafo.ai` — renamed for findability). Independent, lab-evaluated trust grades for AI agents and MCP servers. New brand, separate from any Talent Protocol heritage. Pre-traction.

## Where to look first

- `README.md` — repo layout and dev commands.
- `web/` — the polygraph.so site (Next.js 16, App Router, Tailwind v4): landing, the MCP Security Index (`/rankings`), per-server (`/mcp`) and per-skill (`/skill`) grade reports, ecosystem indices (`/bankr`, `/base`), blog, and the embeddable grade badge. Has its own `AGENTS.md` warning that this Next.js may differ from training-data conventions; consult `web/node_modules/next/dist/docs/` before guessing.
- `packages/` — `core` (the data model: Supabase migrations, row types, server identity; owns the `hosted_runs` schema), `scoring` (`@polygraph/scoring`, the daily adoption-signal pipeline), `cli` (`polygraphso`, the published lookup CLI), `mcp` (`@polygraphso/mcp`, the lookup MCP server).
- `brand/` — logomark, wordmark, social-preview source SVGs + GitHub-ready PNGs.
- Strategy & standing conventions live in the workspace-level `CLAUDE.md` (the cross-repo map across `litmus/`, `hosted-service/`, `core/`) and this repo's `README.md`. The behavioral methodology is the litmus spec — `hosted-service/docs/litmus-test.md`, mirrored at [polygraph.so/methodology](https://polygraph.so/methodology). Don't restate or relitigate decisions captured there — anchor against them.

## What this product is (one paragraph)

Behavioral evaluation for MCP servers and the agents that use them. Free public grades + a CLI (`npx polygraphso check <server>`) that's a sub-second lookup over precomputed grades. Subscriber-pays only. Independence is disclosure-based — material support is allowed if publicly registered, never undisclosed; no graded party gets review or approval rights. Two tiers: dev subscription on a runtime gateway and enterprise vendor-risk scoring. Independence is the moat: frontier labs are too conflicted to grade their own ecosystem, Trustpilot-style ratings are too gameable.

## What we are NOT building

- Not "AI safety" framing — too crowded and politicized.
- Not a vendor marketplace or rating-for-pay model.
- Not Talent Protocol v2 — clean slate. No Builder Score, Talent Passport, etc.

## How to help

- Keep changes scoped to what a task needs — don't build ahead of demand.
- Tone: serious, calm, expert. Plain English. Avoid VC-bro / Web3-bro / "revolutionize" / "empower" / generic "AI safety" language.
- The visual identity is **scientific preprint chrome over product-page posture**. Source Serif 4 + IBM Plex Sans + IBM Plex Mono. Warm parchment background, ink text, oxblood accent. Don't drift into gradient-purple-startup territory.
- When the user describes a new decision, ask what it *supersedes* and update the strategy folder accordingly — don't accept it as additive without checking.

## What not to do

- Don't add features, abstractions, or backwards-compat shims beyond what each task requires.
- Don't drag in deferred questions: legal-entity structure, fundraise mechanics, IP transfer, fate of legacy TP artifacts. Assumed handled until traction warrants revisiting.
- Don't claim "100% safe" or "guaranteed." Underclaim, then over-deliver.
