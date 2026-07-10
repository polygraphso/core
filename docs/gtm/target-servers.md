# Grade-first work queue — per-ecosystem targets

*2026-07-10. Companion to `2026-07-10-ecosystem-acquisition.md`. Refs verified against
registry.npmjs.org / pypi.org from this session unless marked (unverified); popularity
signals are third-party estimates, cited in the research notes at the bottom.*

**Before queueing anything**: dedupe against the live index (`/api/cli/list`) — several
entries below (the reference servers, Playwright, Context7) are likely already graded;
the work is only the delta. Known constraints from the methodology apply throughout:
credential-gated servers show as ungraded rather than getting fabricated secrets; remote
(`https://`) endpoints cap at B; skills go through the static skills litmus.

## 1. Smithery — top hosted servers (for `outreach/smithery.md`)

Hosted-endpoint shape (verified from `smithery-ai/cli` source):
`https://server.smithery.ai/<qualifiedName>/mcp` — the gateway generally wants
`?api_key=<smithery-key>&profile=<profile>`, so hosted-remote runs need a (free) Smithery
account key. **Prefer the underlying npm/pypi ref where one exists** — local runs grade
the full ladder; the hosted remote caps at B.

Priority order blends an early-2025 Smithery usage snapshot with 2026 roundup consensus
(live Smithery counts unreachable from this environment — smithery.ai 403s our proxy):

| # | Server | Gradeable ref | Kind | Caveat |
|---|---|---|---|---|
| 1 | Sequential Thinking | `@modelcontextprotocol/server-sequential-thinking` | npm | keyless |
| 2 | Context7 (Upstash) | `@upstash/context7-mcp` | npm | key optional |
| 3 | Exa Search | `exa-mcp-server` | npm | Exa API key to exercise |
| 4 | Desktop Commander | `@wonderwhy-er/desktop-commander` | npm | keyless; shell/file access — prime C-02/C-03 target |
| 5 | Toolbox (Smithery's own) | `https://server.smithery.ai/@smithery/toolbox/mcp` | remote | Smithery key; caps at B; proxies other servers |
| 6 | GitHub (official) | `github/github/github-mcp-server` | github | PAT-gated; legacy npm server archived |
| 7 | wcgw | `wcgw` | pypi | shell agent, local-first |
| 8 | DuckDuckGo Search | `duckduckgo-mcp-server` | pypi | keyless |
| 9 | Playwright (community) | `@executeautomation/playwright-mcp-server` | npm | needs browser in sandbox |
| 10 | Brave Search | `@modelcontextprotocol/server-brave-search` | npm | archived upstream + API key — grade as-is, note staleness |
| 11 | Fetch | `mcp-server-fetch` | pypi | keyless; egress by design — likely already graded |
| 12 | Memory | `@modelcontextprotocol/server-memory` | npm | keyless |
| 13 | Tavily Search | `tavily-mcp` | npm | API key |
| 14 | Firecrawl | `firecrawl-mcp` | npm | API key |
| 15 | Browserbase | `github/browserbase/mcp-server-browserbase` | github | API key |
| 16 | Notion (official) | `@notionhq/notion-mcp-server` | npm | token-gated |
| 17 | Supabase | `@supabase/mcp-server-supabase` | npm | token-gated |
| 18 | Neon | `@neondatabase/mcp-server-neon` | npm | API key |
| 19 | Web Research | `@mzxrai/mcp-webresearch` | npm | drives local Chrome |
| 20 | SQLite | `mcp-server-sqlite-npx` | npm | needs DB path (harness can supply) |
| 21 | Obsidian Reader | `mcp-obsidian` | npm | needs vault path (harness can supply) |
| 22 | MySQL | `@f4ww4z/mcp-mysql-server` | npm | needs live DB creds |
| 23 | Shodan | `@burtthecoder/mcp-shodan` | npm | API key |
| 24 | TaskManager | `github/kazuph/mcp-taskmanager` | github | keyless *(repo unverified)* |
| 25 | iTerm | `iterm-mcp` | npm | **macOS-only — not gradeable in the Linux sandbox; skip or list as ungradeable-with-reason** |

Realistic yield: the keyless half grades fully; the credential-gated half lands as
disclosed-ungraded rows — which is itself part of the pitch (coverage ceiling is
authentication, and Smithery holds the keys as the host).

## 2. PulseMCP — most-popular listed servers (for `outreach/pulsemcp.md`)

Heavy overlap with the existing index and with §1 — dedupe first. Refs all verified
against npm/pypi; PulseMCP's own weekly-visitor estimates cited where a search snippet
surfaced one (pulsemcp.com blocks our proxy):

| # | Server | Gradeable ref | Kind | Signal / caveat |
|---|---|---|---|---|
| 1 | Playwright (Microsoft) | `@playwright/mcp` | npm | ~5.5M est. weekly visitors; needs browser |
| 2 | Chrome DevTools (Google) | `chrome-devtools-mcp` | npm | ~2.5M est.; needs Chrome |
| 3 | Context7 | `@upstash/context7-mcp` | npm | ~1M est. |
| 4 | GitHub (official) | `github/github/github-mcp-server` | github | ~131k est.; PAT-gated |
| 5 | Notion (official) | `@notionhq/notion-mcp-server` | npm | ~114k est.; token-gated |
| 6 | Zapier | `https://mcp.zapier.com/api/mcp/mcp` | remote | ~110k est.; auth-gated remote — caps at B if gradeable at all |
| 7 | Filesystem (reference) | `@modelcontextprotocol/server-filesystem` | npm | keyless — likely already graded |
| 8 | Sequential Thinking (reference) | `@modelcontextprotocol/server-sequential-thinking` | npm | keyless |
| 9 | Memory (reference) | `@modelcontextprotocol/server-memory` | npm | keyless |
| 10 | Fetch (reference) | `mcp-server-fetch` | pypi | keyless |
| 11 | Supabase | `@supabase/mcp-server-supabase` | npm | token-gated |
| 12 | Firecrawl | `firecrawl-mcp` | npm | API key |
| 13 | Desktop Commander | `@wonderwhy-er/desktop-commander` | npm | keyless |
| 14 | Task Master | `task-master-ai` | npm | wants an LLM API key |
| 15 | Puppeteer (reference) | `@modelcontextprotocol/server-puppeteer` | npm | **archived** upstream, still heavily downloaded — grade + note |

Backups (verified to exist): `@modelcontextprotocol/server-everything` (known
false-positive case — hold per blog #1), `n8n-mcp`, `@browserbasehq/mcp`,
`mcp-server-git` (pypi), `figma-developer-mcp`.

## 3. Base / x402 Bazaar (for `outreach/base-x402.md`)

`/base` index already live — this is the delta. Key structural finding: **`base-mcp` on
npm is deprecated** (repo archived as `base/base-mcp-legacy`); the successor is a remote
agent gateway at docs.base.org/ai-agents, exact endpoint URL unverified (docs 403 our
proxy).

| Target | Gradeable ref | Kind | Caveat |
|---|---|---|---|
| Base MCP (legacy snapshot) | `base-mcp` | npm | deprecated — grade as version-pinned snapshot, label as such |
| Base MCP gateway (successor) | URL via docs.base.org/ai-agents *(unverified)* | remote | caps at B; wallet-auth to exercise |
| Coinbase AgentKit | `@coinbase/agentkit` | npm | library, not an MCP server — MCP exposure via framework extension; CDP key to exercise |
| Uniswap trader MCP | `uniswap-trader-mcp` | npm | community, stale (2025-03); wants INFURA_KEY + WALLET_PRIVATE_KEY — **high-value C-03 canary target** |
| Morpho MCP | via mcp.directory/servers/morpho *(ref unverified)* | ? | pin the actual package before queueing |
| Moonwell MCP | *(existence unverified)* | ? | may only exist as a gateway plugin |
| Aerodrome MCP | *(ref unverified)* | ? | directory listing only; pin before queueing |
| Bazaar-listed resource servers | enumerate via `GET https://api.cdp.coinbase.com/platform/v2/x402/discovery/resources` | remote | **blocked by this session's proxy — enumerate from an unproxied machine.** All payable (invoking costs USDC on Base) and remote (cap B) |

Verified negatives (don't waste runs): `@base/mcp`, `@coinbase/agentkit-mcp`,
`@coinbase/cdp-mcp` don't exist on npm. `x402`, `@coinbase/x402`, `x402-express/fetch/axios`,
and Vercel's `x402-mcp` are libraries, not servers — not behavioral targets.

## 4. Bankr / x402 Cloud (for `outreach/bankr.md`)

`/bankr` index already live (skills + agents) — this is the **new** x402 Cloud surface.
x402 Cloud endpoint shape (verified from the shipped `@bankr/cli` 0.3.13 source):
`https://x402.bankr.bot/<owner-wallet-address>/<service-name>`.

| Target | Gradeable ref | Kind | Caveat |
|---|---|---|---|
| Bankr official skills | `github/BankrBot/skills` (+ skills.bankr.bot) | skill | static skills litmus; enumerate repo contents |
| x402 Cloud endpoints | `https://x402.bankr.bot/<addr>/<slug>` | remote | payable + remote (cap B); enumerate via x402scan.com or the Bazaar filtered to host `x402.bankr.bot` — **do from an unproxied machine** (`*.bankr.bot` 403s here) |
| Bankr marketplace endpoints | `agent-lookup` (free), `cred-report`, `agent-update`, `soul-lock`, `soul-share`, `mint` *(URLs unverified)* | remote | confirm exact URLs first |
| ContextKit (third-party on x402 Cloud) | `@basedchef/contextkit` (npm, verified) | npm | SDK for an x402-Cloud-hosted endpoint — concrete "graded before agents pay it" candidate |
| bankrbot-mcp | `bankrbot-mcp` (npm, verified exists) | npm | **apparently unofficial** — no repo field, not `@bankr/`-scoped; possible name-squat. Grading it is interesting *because* of that, but label it third-party, never as Bankr |

Verified negatives: `bankr-mcp` doesn't exist on npm; npm package `bankr` is an unrelated
2018 ledger CLI — do not grade as Bankr. No official Bankr remote MCP endpoint found (the
CLI's embedded host list has no `mcp.bankr.bot`).

## 5. ClawHub / OpenClaw (for `outreach/clawhub.md`)

`/clawhub` index already live. **Weakest data of the five**: clawhub.ai and every
third-party ranking article 403 our proxy, so all slugs below are best-effort
**(unverified)** — confirm on clawhub.ai (`clawhub install <slug>`) before queueing.
Skills go through the static skills litmus; grade the *popular benign-looking* surface —
the flagged-malicious set is already represented on the index.

| Skill | Slug *(all unverified)* | Signal |
|---|---|---|
| Skill Vetter | `skill-vetter` | ~256k installs (reported most-downloaded; a meta-skill that vets other skills — grading the grader is a good story) |
| GitHub | `github` | ~189k installs |
| Ontology (memory) | `ontology` | ~188k installs; writes local state |
| Gog (Google Workspace) | `gog` | ~185k installs |
| Web Browsing | slug unknown | 180k+ installs (one source calls it #1) |
| Felo Search | `felo-search` | ~145k installs |
| SSH | `ssh` | high search interest; high-privilege by design — prime static-litmus target |

To fill out the top-25: pull the registry's own install-sorted list from an unproxied
machine (the DataCamp / Composio / betterclaw ranking articles all 403'd here).
Registry context: ~13k community skills; ClawHub now SHA-256-hashes every published skill
and scans with VirusTotal — which is exactly the static layer our pitch says is
insufficient, so no need to relitigate it in outreach.

## Research provenance

Compiled 2026-07-10 by parallel research agents; npm/pypi existence checks re-run
directly from this session (all §1 refs and the two pypi refs returned 200). Popularity
signals: PulseMCP page-snippet estimates, an early-2025 Smithery usage snapshot
(`github.com/pedrojaques99/popular-mcp-servers`) blended with 2026 roundup consensus,
ClawHub install counts from search-result excerpts. Environment note: this session's
egress proxy blocks smithery.ai, pulsemcp.com, clawhub.ai, bankr.bot, docs.base.org, and
api.cdp.coinbase.com — every item marked "enumerate from an unproxied machine" is a
10-minute job from a normal laptop.
