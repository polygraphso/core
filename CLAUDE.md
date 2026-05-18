# poligrafo — workspace context for Claude

This is the source-of-truth code repo for **poligrafo.ai**, an independent, lab-evaluated trust grade for AI agents and MCP servers. New brand, separate from any Talent Protocol heritage. Pre-traction.

## Where to look first

- `README.md` — repo layout and dev commands.
- `web/` — the v0 landing page (Next.js 16, App Router, Tailwind v4). Has its own `AGENTS.md` warning that this Next.js may differ from training-data conventions; consult `web/node_modules/next/dist/docs/` before guessing.
- Strategy & decision log lives outside this repo at `~/Documents/workspace/assistant/poligrafo/`. Read `pivot-2026-05-15.md`, then `landing-brief.md`, then `litmus-test-v1.md`. Don't restate or relitigate decisions captured there — anchor against them.

## What this product is (one paragraph)

Behavioral evaluation for MCP servers and the agents that use them. Free public grades + a CLI for runtime checks. Subscriber-pays only — **vendors never pay us, ever**. Two tiers: dev subscription on a runtime gateway (CLI/MCP), and enterprise vendor-risk scoring. Independence is the moat: frontier labs are too conflicted to grade their own ecosystem, Trustpilot-style ratings are too gameable.

## What we are NOT building

- Not "AI safety" framing — too crowded and politicized.
- Not a vendor marketplace or rating-for-pay model.
- Not Talent Protocol v2 — clean slate. No Builder Score, Talent Passport, etc.

## How to help

- Pre-traction default: focus only on what gates litmus-v1 + the landing page. Anything else is parking-lot.
- Tone in any user-facing copy: serious, calm, expert. Plain English. Avoid VC-bro / Web3-bro / "revolutionize" / "empower" / generic "AI safety" language.
- The visual identity is **scientific preprint**, not SaaS marketing. Source Serif 4 + IBM Plex Sans + IBM Plex Mono. Warm parchment background, ink text, oxblood accent. Don't drift into gradient-purple-startup territory.
- When the user describes a new decision, ask what it *supersedes* and update the strategy folder accordingly — don't accept it as additive without checking.

## What not to do

- Don't add features, abstractions, or backwards-compat shims beyond what each task requires.
- Don't drag in deferred questions: legal-entity structure, fundraise mechanics, IP transfer, fate of legacy TP artifacts. Assumed handled until traction warrants revisiting.
- Don't claim "100% safe" or "guaranteed." Underclaim, then over-deliver.
