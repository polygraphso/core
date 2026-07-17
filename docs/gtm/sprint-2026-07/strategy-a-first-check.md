# Strategy A — "Land the first check" (founder-led direct sales)

**Goal:** one paid conversion by Fri 2026-07-24. Interim targets: 5+ replies, 3 calls.
**Budget:** ~$30 (contact enrichment: Hunter/Apollo credits if a named contact lacks a channel). Rest stays with Strategy B.
**Working list:** `CRM.md` in this folder — hot sheet top-down. Log every send/reply there (stages: NEW → CONTACTED → REPLIED → CALL → PILOT/PAID → CLOSED-LOST).
**Asset paths:** outreach templates (`bankr-chat-message.md`, `outreach-emails.md`, etc.) live at the workspace root, `~/Documents/Code/polygraphso/drafts/outreach-2026-07/` — outside this repo.

## The offer ladder (never skip a rung mid-conversation)

1. **Small yes — $199/mo ecosystem monitoring**, self-serve at `polygraph.so/ecosystems/[slug]/activate`. No invoicing, no procurement. This is the "first check" most likely to land by Friday.
2. **Big yes — $2k–4k/mo invoiced pilot** (3 months → annual), per `pilot-offer-one-pager.md`. Offer only after a call.
3. **Side door — $99 priority grade** (`/request/priority`) for any vendor in the thread who wants their own server graded fast. Also: every inbound request now pays $1 minimum, so even "just try it" replies are revenue.

**Guardrail (state it in every pitch):** money buys speed, coverage, and attention — never the verdict. The graded party can never buy an outcome. Independence is disclosure-based; grades are reproducible and disprovable by re-running the open harness.

## Day-by-day

| Day | Action |
|---|---|
| **Fri 7/17** | Warm three: Bankr (paste `bankr-chat-message.md`, add the May 2026 Grok–Bankr exploit angle, disclose the $POLYGRAPH relationship), Base (week-1 template), Virtuals (`virtuals-pilot-one-pager.md` to Jansen Teng). Then hot-sheet #4–7 (Cline, Heurist, agentskill.sh, Kite). Pre-send verification pass on each (see checklist). |
| **Sat 7/18** | Hot-sheet #8–15 (Composio, Arcade, Gumloop, Obot, Postman, Kilo/Anaconda, NeuralTrust, JetStream). Composio/Arcade/Obot: pull forward the week-2/3 templates from `outreach-emails.md`, personalize with the fresh hooks in CRM §I. |
| **Sun 7/19** | Hot-sheet #16–22 (ElizaOS, Olas, Clanker, Circle, AIUC, Vanta, Drata) + gateway batch (`gateway-marketplace-batch.md`: Runlayer, MintMCP, Kong, Lunar.dev, TrueFoundry, Helmet). |
| **Mon 7/20** | Day-3 nudges on Fri sends. Registry/marketplace incident-driven batch (ClawHub/OpenClaw with ClawHavoc angle; skills.sh/Tessl reframed as contrast — Snyk-signed, so pitch what static scanning can't do). |
| **Tue 7/21** | Nudges on Sat sends. Any replies → propose a 20-min call same week. On calls: demo a live grade of *their* catalog item, then the ladder. |
| **Wed 7/22** | Nudges on Sun sends. Calls. |
| **Thu 7/23** | Day-7 close attempts on the warm three: direct ask — "activate at /ecosystems/[slug]/activate, $199/mo, cancel anytime; or I'll set up the pilot invoice." |
| **Fri 7/24** | Final follow-ups, log outcomes in CRM, retro: what got replies, what died. |

Mornings = sends and nudges (Strategy B owns afternoons). ~10–14 personalized sends/day max — personalization beats volume.

## Pre-send checklist (every email)

- Spot-check the lead's claims from CRM (only 5/110 of the 7/04 batch were verified; wave-2 verdicts in CRM §L).
- Check their servers' grade freshness on polygraph.so; regrade if stale (don't stack grading batches — Docker ENOSPC, conc 2).
- One personal line from the CRM "hook" column, with the date.
- Humanizer/anti-slop pass; preprint voice; no hype words; no "100% safe"/"guaranteed."
- Litmus-public-wording rules apply to anything that might get screenshotted.
- Bankr/any token-adjacent lead: disclose the $POLYGRAPH/Bankr relationship explicitly.
- Glama (punkpeye): also holds the open awesome-mcp-servers PR #8339 — keep the two threads separate, no pressure coupling.

## Objection cribs

- "We already scan" (Snyk/MseeP/in-house heuristics) → static scans read code; the litmus runs behavior (egress sandbox, planted canaries, live-fingerprint rug-pull recheck) and publishes a reproducible onchain proof anyone can dispute by re-running. postmark-mcp had no CVE.
- "Why trust a self-run grade?" → you don't have to: the harness is open, deterministic, re-runnable; a false grade is disprovable. That's the whole design.
- "Not a priority" → the NSA MCP CSI (5/20/26) and Five Eyes agentic guidance (4/30/26) recommend exactly this vetting; your enterprise customers will ask.

## What success looks like

Minimum: 1 × $199/mo activation OR 1 × $99 priority grade + 2 scheduled calls. Good: a $2k–4k/mo pilot verbally agreed with paperwork in flight. Every outcome logged in CRM.md so week 2 starts warm.
