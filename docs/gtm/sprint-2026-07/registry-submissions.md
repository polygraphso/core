# Registry & directory submissions — @polygraphso/litmus

Mechanics verified by web research 2026-07-16/17 (every path below was checked against the live site/repo/docs). Two listing shapes:

- **Remote (preferred where accepted):** `https://www.polygraph.so/api/mcp` — Streamable HTTP, read-only lookup tools, x402-payable grade requests.
- **Stdio (npm):** `npx -y -p @polygraphso/litmus polygraphso-litmus-mcp`

**Already live (no action):** official MCP registry (via 0.34.0 `server.json`) · PulseMCP (pulsemcp.com/servers/litmus) · Glama (glama.ai/mcp/servers/polygraphso/litmus) · npm.
**Verified NOT yet listed (searched 7/16):** mcp.so, Smithery, MCPMarket, mcpservers.org, LobeHub, cursor.directory, GitHub MCP Registry (its announced auto-sync from the official registry is not picking us up).

## 0) The x402 move — do this first (it's also the owed x402 E2E)

Make the paid endpoint **Bazaar-discoverable**, then settle **one real paid request** through it. In the x402 v2 SDK we use (`@coinbase/x402` 2.1 + `@x402/core` 2.18) the old `discoverable: true` flag is gone — the mechanism is: register `bazaarResourceServerExtension` on the resource server and attach `declareDiscoveryExtension({ input, inputSchema, bodyType: "json", output })` to the route config. **Where:** `web/app/api/x402/grade-request/route.ts`, inside `getX402Server()` — extend the `x402ResourceServer(...)` setup and the `[ROUTE_PATTERN]` route config (which already sets `resource`, required for cataloging). The input schema should describe the POST body (`server_ref`, `email`, `agent_id`, `source`). Omitting the extension keeps the route private, which is why we're not listed yet despite the rail being live.

After one successful settlement, CDP's Bazaar auto-catalogs the endpoint and it propagates to **Agentic.Market** (~1,870 services, Coinbase's x402 directory) and **x402scan** (Base/Solana indexer; direct URL registration also possible for $0.01 USDC). No forms. One settlement = E2E test passed + listed across the x402 ecosystem. Docs: docs.cdp.coinbase.com/x402/bazaar. Optional follow-up: PR to `x402-foundation/x402` `docs/` (Mintlify) to appear in the Developer Tools docs.

## 1) Self-serve, minutes each (fire this week)

| # | Registry | Exact path | What's needed | Review |
|---|---|---|---|---|
| 1 | **Smithery** | smithery.ai/new — paste `https://www.polygraph.so/api/mcp` | Nothing else; endpoint already meets streamable-HTTP requirement. Post-publish: Settings → Verification | Auto tool-scan at publish |
| 2 | **mcp.so** | mcp.so/submit?type=server (alt: comment on chatmcp/mcpso#1) | GitHub repo link | Free queue (paid tier = instant + dofollow — skip for now) |
| 3 | **mcpservers.org** | mcpservers.org/submit | Name, description, link, category, email | Optional **$39 one-time** = faster review + dofollow badge — cheapest paid backlink on the board; fits the $100 budget if we want it |
| 4 | **Cline Marketplace** | github.com/cline/mcp-marketplace → issue template `mcp-server-submission.yml` | Repo URL + **400×400 PNG logo** + tested install-via-Cline from README | "Within a couple of days." Expect extra scrutiny on crypto/x402 parts — answer with the disclosure-based-independence story |
| 5 | **Azure MCP Center** | Comment on Azure/mcp-center issue #4 ("MCP Server Onboarding Request") | Remote endpoint (exactly our shape) | Stated 1–2 weeks to live |
| 6 | **Gemini CLI extensions** | No submission — publish a public repo w/ `gemini-extension.json` wrapping the remote `httpUrl`; gallery auto-indexes | ~30 min: small `polygraph-gemini-extension` repo (+ GitHub Release for faster installs) | Automatic |
| 7 | **MCPMarket.com** | mcpmarket.com/submit (site rate-limits bots; form worked via browser) | GitHub repo URL | Unstated. Also lists Agent Skills — second listing angle for litmus-skill |
| 8 | **LobeHub** | lobehub.com/mcp/publish → market.lobehub.com sign-in-gated form | LobeHub account | Unstated; big SEO footprint |

## 2) PR / prep required (this week–next)

| Registry | Path | Notes |
|---|---|---|
| **Docker MCP Registry** | PR to docker/mcp-registry — run **`task remote-wizard`** (remote listing) and optionally `task wizard` (stdio; Docker builds/signs `mcp/<name>` image) | Largest real install base (Docker Desktop MCP Toolkit). Needs `servers/<name>/server.yaml` + `tools.json` + `readme.md`; MIT license OK. ~1h incl. CI; live ~24h post-approval |
| **cursor.directory** | cursor.directory/plugins/new (cursor/mcp-servers repo is deprecated → points here) | Also, independent of listing: add "Add to Cursor" deeplink badges (cursor.com/docs/mcp/install-links) to our own docs/report pages |
| **Raycast MCP Registry** | PR to raycast/extensions → `extensions/model-context-protocol-registry/src/registries/builtin/entries.ts`, add to `COMMUNITY_ENTRIES` | Entries are stdio commands: use `npx -y -p @polygraphso/litmus polygraphso-litmus-mcp` |
| **Postman MCP Network** | Email **api-network@postman.com** | Prereq: Postman team w/ complete public profile + public workspace + collection with an MCP request per config. ~1h prep, then email. Postman forks it into the official catalog |
| **GitHub MCP Registry** | Email **partnerships@github.com** (only active path; 154 curated servers) | Send the nomination, expect nothing; their official-registry auto-sync should eventually pick us up anyway |

## 3) Higher effort / optional

- **mpak.dev** — add `manifest.json` + `mcpb-pack` GitHub Action; publishes on release via OIDC, runs a 25-control scan → public trust score. Their trust score overlapping our pitch means a good grade there is cheap credibility. (~1–2h)
- **Apify** — wrap litmus as an Actor (apify.com/mcp/developers). Highest effort, but the only one with direct revenue (keep ~80% minus compute). Park until after sprint.
- **ModelScope MCP广场** — modelscope.cn/docs/mcp/create; form has an English-name field; hostable tier needs npm (we qualify). CN-market reach; account-signup friction unverified. Park.

## Skip (verified dead/retired/no path)

Continue Hub (hub.continue.dev redirecting, docs 404) · Kiro (curated, no public path — points users at official registry) · FastMCP.me (domain parked) · Dexter MCP (DNS dead) · OpenTools (registry retired/early-access pivot).

## Description variants (never paste the same one twice — directories penalize duplicates)

- **Tagline (≤10 words):** Behavioral trust grades for MCP servers, proven onchain.
- **60-char:** A–F behavioral grades for MCP servers, reproducible onchain
- **Dev-directory long (Smithery/Docker/Cline):** "Litmus grades MCP servers A–F by behavior, not code reading: it connects like an agent, fingerprints the exact tool surface, and probes for tool-output injection, unexpected egress, planted-canary leaks, and adversarial-input handling. Grades publish as reproducible EAS attestations on Base — re-run the open harness to verify or dispute any grade. This server also exposes instant lookups of published grades before you install something."
- **Consumer/marketplace long (LobeHub/mcp.so/Raycast):** "Check whether an MCP server is safe before you connect it. Polygraph publishes independent A–F trust grades from behavioral testing — does the server hijack your agent, phone home, or leak data? — with evidence pinned to IPFS and proofs onchain. Free lookups; paid priority grading for anything ungraded."
- **x402/agent-economy (Agentic.Market metadata):** "Pre-flight trust check for agents: look up or commission an A–F behavioral grade for any MCP server and pay per request in USDC via x402. The check is paid; the verdict is never for sale."

## Tracker

| Registry | Status | Date | Listing URL |
|---|---|---|---|
| Official MCP registry | LIVE | 7/16 | registry.modelcontextprotocol.io (via 0.34.0) |
| PulseMCP | LIVE | pre-existing | pulsemcp.com/servers/litmus |
| Glama | LIVE | pre-existing | glama.ai/mcp/servers/polygraphso/litmus |
| npm | LIVE | 7/16 | npmjs.com/package/@polygraphso/litmus |
| x402 Bazaar (→Agentic.Market/x402scan) | TODO — first (also E2E) | | |
| Smithery | TODO | | |
| mcp.so | TODO | | |
| mcpservers.org | TODO ($39 optional) | | |
| Cline Marketplace | TODO (needs 400×400 logo) | | |
| Azure MCP Center | TODO | | |
| Gemini CLI extension repo | TODO | | |
| MCPMarket | TODO | | |
| LobeHub | TODO (account) | | |
| Docker MCP Registry | TODO (PR) | | |
| cursor.directory | TODO | | |
| Raycast | TODO (PR) | | |
| Postman | TODO (workspace prep) | | |
| GitHub MCP Registry | TODO (email, low expectation) | | |
| mpak / Apify / ModelScope | PARKED | | |
