# Ecosystem acquisition — target pipeline and outreach plan

*2026-07-10. Research verified by live web search on this date; anything not verified is marked.*

This is the first written GTM motion. Scope: find ecosystems willing to try the product —
directory operators, registries, and agent networks whose users install the servers and
skills we grade. The deliverables are this plan, five ready-to-send outreach drafts
(`outreach/`), and the grade-first work queue (`target-servers.md`).

## 1. Where we actually are

The acquisition machinery is built; nobody has been pitched. In place today:

- **119 published grades / 235 tracked servers** and a flagship data post
  (`web/content/blog/state-of-mcp-security-1.md`) that reads as the launch asset.
- **Six live ecosystem indices** — `/base`, `/bankr`, `/virtuals`, `/uniswap`, `/clawhub`,
  `/skills-sh` — proving the grade-first motion end to end. The `/clawhub` index already
  shows Snyk-flagged malicious skills graded D next to the popular skills an agent would
  install; that page is an outreach opener as it stands.
- **Self-serve surfaces**: the README badge (`/api/badge`), `/builders` (CLI, Cursor
  deeplink, Claude Code plugin, GitHub Action CI gate), the grade-request funnel, and the
  DB-backed `/ecosystems/[slug]` pages — a new index is Supabase rows, zero new code.
- **A paid conversion target**: the monitored-ecosystem engagement (continuous re-grades,
  drift alerts, private dashboard; subscription streamed in $POLYGRAPH on Base). The
  `/ecosystems` hub is the sales page.

What's missing is only the motion: nobody outside has been asked to look.

## 2. Why now

Timing evidence, strongest first:

- **The NSA published MCP-security guidance (CSI, May 2026)** recommending sandboxing,
  egress filtering, and local MCP scans — government telling every enterprise to want what
  the litmus measures. Five Eyes joint agentic-AI guidance followed the same month.
  ([NSA release](https://www.nsa.gov/Press-Room/Press-Releases-Statements/Press-Release-View/Article/4496698/),
  [CSI PDF](https://media.defense.gov/2026/Jun/02/2003943289/-1/-1/0/CSI_MCP_SECURITY.PDF))
- **The official MCP registry punts security to us by name**: its docs do namespace auth +
  metadata only and invite "downstream aggregators" to layer "additional security checks,
  ratings, or curation" on top. ([registry about](https://modelcontextprotocol.io/registry/about))
- **The incident record makes the pitch concrete**: GitHub MCP private-repo exfiltration via
  prompt injection (May 2025) → Asana cross-tenant MCP leak (June 2025) → the postmark-mcp
  npm backdoor BCC'ing mail (Sept 2025, first in-the-wild malicious MCP server) → Smithery
  path traversal exposing 3,000+ hosted servers and API keys (Oct 2025) → Cursor
  RCE-via-MCP CVEs → the ClawHub malicious-skills wave (Feb–May 2026, ~1,184 confirmed
  malicious skills; Snyk's "ToxicSkills" found prompt injection in 36% of a sample).
- **Payments raise the stakes**: x402 reports 165M transactions and 69k active agents
  (Coinbase, Apr 2026); the x402 Bazaar catalogs 13,000+ payable resource servers; and two
  2026 papers ("Five Attacks on x402", "Free-Riding the Agentic Web") show the discovery
  layer can steer agents to adversarial servers before payment begins.

The differentiation line, verified against the field: every incumbent trust signal is
**static** (Snyk agent-scan / mcp-scan, mcpscan.ai, AgentSeal), **metadata** (Glama scores,
MseeP), or **supply-chain** (Docker signing/SBOM). None connects as an agent, probes live
behavior, and publishes a reproducible, content-addressed evidence bundle. The ClawHub
episode — skills benign at review, malicious at runtime, surviving VirusTotal and ClawScan —
and the x402 discovery-layer papers are the public proof that static review fails exactly
where behavioral grading works. Say it plainly, claim no more: a grade is a measurement,
not a guarantee; the run is reproducible and its limits are disclosed.

## 3. What "willing to try" converts to

A ladder, cheapest first. Every rung is already built:

1. **Badge embed** — a server author or directory puts the live badge in a README/listing.
2. **Grade column** — a directory reads `/api/cli/list` (or the badge per row) and shows
   A–F next to listings.
3. **Ecosystem index** — we publish `/ecosystems/<slug>` for their surface; they link it.
4. **Monitored activation** — the paid engagement: their whole surface re-graded on a
   schedule, drift alerts, dashboard. This is the revenue event.
5. **Gate integration** — an agent platform or payment router calls `gateDecision` /
   `check_server` before dispatching or paying. Deepest, slowest, most defensible.

Independence framing is non-negotiable in every conversation: nobody can pay for a grade;
a monitoring engagement changes what we re-grade and how often, never the letter.

## 4. The motion — grade first, then pitch

Per target: **compile top-N surface → queue grades (manual runner) → publish the index
(DB rows; `/ecosystems/[slug]` renders it) → outreach opens with the live link → convert
up the ladder.** Never pitch from a deck; always pitch from published results the target
can falsify by re-running the open harness.

Per-target checklist:

- [ ] Server/skill list compiled with exact refs (`target-servers.md`)
- [ ] Grades queued and published (runner drained manually — Rúben)
- [ ] Index page live (seed `ecosystems` / `ecosystem_entries` rows via admin)
- [ ] Outreach sent (draft in `outreach/`, live link filled in)
- [ ] Follow-up at +5 business days (one bump, new information only — e.g. a fresh grade
      or a regression caught), then park; no drip sequences
- [ ] Outcome logged at the bottom of this file

## 5. First wave — five targets, in order

### 1. Smithery — warmest commercial door
- **Who**: Henry Mao (@Calclavia on X, GitHub `smithery-ai`). ~7,300 listed servers,
  thousands hosted on their own infra.
- **Why they'd care**: burned by the Oct 2025 path-traversal incident; already integrates
  third-party scanning (Invariant mcp-scan, now Snyk) — so paying attention to external
  security signals is established behavior; an independent March 2026 scan still found
  findings in 22 of 100 listed servers. Hosting means the whole catalog is gradeable.
- **Hook**: static scanning of manifests didn't stop tool-description injection from
  shipping; we grade what the server *does*. Here are your top 25, graded.
- **Ask**: grade column on listings (rung 2) → monitored catalog (rung 4).

### 2. PulseMCP — highest leverage per email
- **Who**: Tadas Antanavicius (tadas@tadasant.com) + Mike Coughlin. ~21,800 listed,
  hand-reviewed daily; sells a curated managed sub-registry to enterprises.
- **Why they'd care**: the paid sub-registry gives a direct revenue reason to carry an A–F
  column; Tadas also maintains the official registry and sits on the MCP steering group —
  one email reaches all three. Even a no returns ecosystem intelligence.
- **Hook**: your curated registry hand-reviews metadata; we supply the behavioral layer.
- **Ask**: A–F column in the curated sub-registry, sourced from the public index.

### 3. Base / x402 Bazaar — biggest strategic prize, slower
- **Who**: Coinbase CDP / x402 Foundation (Coinbase + Cloudflare); Base Discord;
  @jessepollak. 13,000+ payable resource servers in the Bazaar.
- **Why they'd care**: published academic attacks target their discovery layer; their own
  docs mention "trust signals" (onchain activity — not behavioral safety); our proof is
  literally an EAS attestation on Base, so the verify-before-pay gate is native to their
  stack. `/base` index already live.
- **Hook**: an agent about to pay an unknown x402 endpoint checks the attestation first —
  `gateDecision` defaults to A-only for payments. A live demo on Bankr (target 4) is the
  sales asset here.
- **Ask**: Bazaar surfaces the grade as a trust signal (rung 2/5).

### 4. Bankr / x402 Cloud — smallest, fastest onchain win
- **Who**: Bankr (bankr.bot; X @bankrbot *(handle unverified)*). Base MCP skill plugin;
  x402 Cloud lets builders monetize endpoints in USDC on Base.
- **Why they'd care**: `/bankr` index is already live (skills + agents graded), so the
  relationship starts from delivered work; grading x402 Cloud endpoints before agents pay
  them is a feature they can market.
- **Hook**: every endpoint on x402 Cloud gets a grade before agents pay it.
- **Ask**: link the index from bankr.bot; grade new x402 Cloud endpoints as they list
  (rung 3 → 4). This engagement is also the demo for target 3.

### 5. ClawHub / OpenClaw — the credibility/PR play
- **Who**: ClawHub maintainers (GitHub) / OpenClaw Discord *(specific maintainer contact
  unverified)*. Community-run; the loudest security story in agent-land.
- **Why they'd care**: ~1,184 confirmed malicious skills and persistent evasion despite
  VirusTotal + ClawScan; 2.9% of skills fetch remote content at runtime — the exact gap
  static review can't close and the live-fingerprint recheck can. `/clawhub` is already
  live with Snyk-flagged skills graded D next to popular ones.
- **Hook**: the index exists — "here is your registry's popular surface, graded, with the
  known-malicious set correctly failing."
- **Ask**: link grades from ClawHub listings; more a distribution/credibility win than
  revenue. The "we graded the top 50 ClawHub skills" post is the launch content that makes
  targets 1–4 answer email.

## 6. Second wave and deliberately deferred

**Second wave** (approach once first-wave grades/index links exist to point at):

| Target | Why | Channel |
|---|---|---|
| Official MCP registry | Their docs invite downstream ratings; Tadas (target 2) is the warm path | GitHub `modelcontextprotocol/registry` |
| Docker MCP Catalog | Signing proves who built it, not what it does; they market on MCP fear ("MCP Horror Stories") | Docker DevRel, GitHub `docker/mcp-registry` |
| Cursor | Enterprise MCP allowlists need a security-team-legible signal; 2025 CVE history | security/partnership contact *(unverified)* |
| ElizaOS | Plugin registry + `plugin-mcp`; crypto-native overlap with Base | GitHub / Discord |
| SendAI / solana-agent-kit | Wallet-touching MCP servers = high-stakes showcase | GitHub `sendaifun` |
| Virtuals ACP | Evaluator role in their commerce protocol could consume grades; `/virtuals` index live | @virtuals_io |
| ERC-8004 validation registry | EAS attestation is a ready-made validation source; standards alignment | Ethereum Magicians thread |
| Gateway vendors (Cloudflare, MintMCP, Zuplo, TrueFoundry) | "Route only to ≥B" is a feature they can ship in a sprint; Cloudflare doubles via x402 Foundation | Blog/DevRel channels |
| mcp.so | ~19,700 listed, 11M visits; low editorial bar → easy badge win, low strategic value | GitHub `chatmcp/mcpso` (idoubi) |
| VS Code / GitHub gallery, Anthropic directories, Microsoft/AWS | Real fits, long BD cycles — approach with traction | — |

**Deferred with reasons:**

- **Glama** — competitor-adjacent (already scores servers, static/metadata). Engage only
  after our grades are published, linked, and defensible; the open harness already prices
  in the copy risk.
- **MseeP.ai, NimbleBrain** — competitors; differentiate in content, don't partner.
- **Snyk (ex-Invariant)** — the enterprise competitor; their model is scan-your-own-config,
  ours is a public independent grade. Watch, cite, don't approach.

## 7. Cadence and measurement

- One target in motion at a time; ship the grade → index → email loop completely before
  starting the next. Smithery and PulseMCP can run in the same week (disjoint work).
- Track per target: date sent, channel, reply (y/n), rung reached (badge / column / index /
  monitored / gate), and what the objection was verbatim. Log below.
- The number that matters this quarter is **replies from operators and rungs climbed**, not
  grades published — grading is input, adoption is output.
- Every claim in outreach must trace to a published page or a cited source. When a fact is
  ours, link the report; when it's theirs, link their incident/docs. No claims from memory.

## Outcome log

| Date | Target | Channel | Result |
|---|---|---|---|
| — | — | — | — |
