# Strategy B — "Launch wave" (public launch → self-serve revenue)

**Goal:** drive traffic into the now-fee-gated funnel where every grade request = $1 minimum, priority = $99, Pro = $15/$79. Secondary: installs, badge adopters, registry presence.
**Budget:** ~$50 X promoted-post boost on the launch thread, ~$20 optional Reddit test. ($30 reserved by Strategy A.)
**Status:** $1 fee gate SHIPPED 7/16 (core #190 live-verified, litmus 0.34.0 released). Dual rail live: web $POLYGRAPH + agents x402 USDC.
**Asset paths:** launch assets (`show-hn.md`, `badge-emails.md`, `campaign-refresh.md`, etc.) live at the workspace root, `~/Documents/Code/polygraphso/drafts/outreach-2026-07/` — outside this repo.

## Day 0 — remaining blockers (do BEFORE anything fires)

1. **First real fee E2E, both rails** (still owed as of 7/16): one real $1 web request end-to-end; one x402 request (needs an x402 client + funded wallet). Nothing launches until both pass.
2. **Verify every number in outward copy morning-of** (per twitter conventions): grade counts for the Show HN title, universe size, x402 stats (quote CoinDesk 7/15 75M txns/$24M *with* the meme-farming caveat — clean Base ≈3.1M txns/30d).
3. Add a **10th objection reply** to `show-hn.md` covering the $1 fee + crypto rail ("lookups are free; only *requests* are paid; $1 kills spam; x402 means an agent can pay without a human").

## Launch sequence

| Day | Action |
|---|---|
| **Fri–Sun 7/17–19** | Fire the free distribution batch (below). Prep: X campaign v16 re-render per `campaign-refresh.md`; re-verify `show-hn.md` numbers; draft launch-day X thread (humanizer + anti-slop pass, ≤270 X-weighted chars/tweet, DB-backed scheduler). |
| **Mon 7/20** | Final dry run: incognito walkthrough of / → /request → $1 payment → confirmation. Queue the X thread. Warm the 41 badge emails (`badge-emails.md`) for send. |
| **Tue 7/21 or Wed 7/22, morning ET** | **Show HN** (`show-hn.md`). Full-day comment presence, answer with the objection FAQ. Same morning: X thread + $50 boost. Badge emails go out (each A-graded maintainer = a user + a backlink + social proof). |
| **Wed–Thu** | Ride the wave: reply everywhere, tl;dr sec pitch to @clintgibler (note: he's now at OpenAI — keep it a tool tip, not a sponsorship ask), Latent.Space guest-post form, r/LocalLLaMA findings post ("we graded the top N MCP servers; here's what failed") — 90/10 rule, findings not product. |
| **Fri 7/24** | Recap post on polygraph.so/blog + dev.to cross-post (canonical). Log conversions; retro. |

## Free distribution batch (minutes each, fire Fri–Sun)

- **MCP registry community PR** — `registry-community-pr.md` (5-min execute). *(Official registry listing itself already live via 0.34.0.)*
- **Plugin directory submission** — `plugin-directory-submission.md` (check its litmus PR #92/v0.6.0 prerequisite is satisfied by 0.34.0 before submitting).
- **Registry expansion** — `registry-submissions.md` in this folder: work the self-serve tier first (details + exact mechanics per registry there). Already live: official registry, PulseMCP, Glama, npm.
- **MCP Discord #security-ig + OWASP GenAI Slack** — presence, answer questions, share the methodology page when relevant. No pitching.
- **Agent.market / x402 ecosystem listing** — list the x402-payable grade-request endpoint where agents shop for paid services (mechanics in `registry-submissions.md`).

## Risks, stated plainly

- **HN is one-shot.** Don't fire until the fee E2E passes and numbers are verified. If Tuesday slips, Wednesday is fine; don't launch Fri–Sun.
- **Crypto-only rail will cost some HN conversions.** Mitigations: lookups/reports stay free; the $1 fee has a plain-English "why" answer; $99 priority lane exists for people who just want speed.
- **A request wave can flood grading.** Don't stack batches: concurrency 2, reap pg-* containers, watch Docker.raw (ENOSPC history).
- **Numbers rot.** Every stat in public copy gets re-verified the morning it ships. The CRM's VERIFY ledger (§L) lists known-shaky numbers.

## Metrics (log daily in CRM.md)

Paid requests × $1 · priority grades × $99 · Pro subs · ecosystem activations · HN placement/comments · site sessions · plugin installs + CLI lookups · badge adoptions (of 41) · new registry listings live.
