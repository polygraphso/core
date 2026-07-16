# CRM v1 — polygraph.so pipeline (built overnight 2026-07-16→17)

**Sources:** 7 web-research agents (2 waves, ~180 searches) + existing `drafts/client-sources-research-2026-07-04.md` (110 leads) + `drafts/outreach-2026-07/` assets. Every row traces to a page an agent actually fetched; nothing invented. Emails listed only where printed publicly.

**Pipeline stages:** `NEW → CONTACTED → REPLIED → CALL → PILOT/PAID → CLOSED-LOST`. All rows start NEW unless marked (existing outreach assets = "ASSET READY").

**Priority:** P0 = live catalog/ecosystem + reachable decision-maker + money (fresh funding/treasury/fees). P1 = real fit, smaller or harder to reach. P2 = speculative/long-cycle. KNOWN+ = already in the 7/04 research, new 2026 development noted.

**Offer codes:** `MON` = ecosystem/catalog monitoring ($199/mo self-serve → $2k–4k/mo pilot) · `OEM` = grade feed licensed into their product · `PRI` = $99 priority grade · `BADGE` = free badge → funnel · `PART` = partnership/co-marketing (not near-term revenue).

**Status update 7/16–17:** $1 fee gate SHIPPED (core #190 merged + deployed + live-verified; litmus #118/#119 merged; 0.34.0 on npm + official MCP registry + GH release). Dual rail live: web = $POLYGRAPH, agents = x402 USDC. Still owed: first real fee E2E. Registry presence already LIVE: official MCP registry, PulseMCP (pulsemcp.com/servers/litmus), Glama (glama.ai/mcp/servers/polygraphso/litmus), npm. Expansion plan: `registry-submissions.md` in this folder.

## 0) HOT SHEET — first 22 sends (work top-down)

| # | Company | Person → channel | Hook (dated) | Offer | Asset/next action |
|---|---|---|---|---|---|
| 1 | Bankr (warm) | @bankrbot; existing relationship | May 2026 Grok–Bankr Morse-code prompt-injection drained ~$150–200K (oecd.ai incident 2026-05-04-4a73) | MON | `bankr-chat-message.md` — add exploit angle; DISCLOSE $POLYGRAPH relationship |
| 2 | Virtuals Protocol (warm) | Jansen Teng — linkedin.com/in/jansenteng; @virtuals_io | ACP Revenue Network pays up to $1M/mo to agents (Feb 2026); Robinhood Chain integration 7/02; curated agent board 7/13 | MON | `virtuals-pilot-one-pager.md` ready to send |
| 3 | Base (warm) | existing contact path | /base ecosystem page live with grades | MON | `outreach-emails.md` week-1 template |
| 4 | Cline | Saoud Rizwan, CEO — linkedin.com/in/saoud-rizwan | 5M+ installs (confirmed 1/26); users openly requested pre-connect MCP security scanning (cline/cline#9786); suffered "Clinejection" supply-chain attack; $32M raised | OEM+MON | New email: "your users asked for this in #9786" |
| 5 | Heurist | @heurist_ai; discord.gg/heuristai | Mesh sells 100+ crypto MCP tools as "verifiable" via x402/ERC-8004 — no behavioral proof behind the word | MON | New email/DM; grade 2–3 Mesh tools first as evidence |
| 6 | agentskill.sh | Romain Simon — @romainsimon (X), github.com/romainsimon | Solo-run, markets "two-layer security scanning" + grade-A-only defaults; 274k skills claimed (VERIFY) | OEM+BADGE | DM: his security dashboard + our behavioral grade = upgrade |
| 7 | Kite AI | discord.com/invite/gokiteai; @GoKiteAI | Kite Chain mainnet 4/30/26; $35M PayPal Ventures/General Catalyst; 90+ paid service providers, no vetting | MON | New email via Discord/form |
| 8 | Composio | Soham Ganatra, CEO — @GanatraSoham | Enterprise MCP Gateway push; "500+ vetted integrations" claim with no published methodology | OEM | `outreach-emails.md` week-3 template — pull forward |
| 9 | Arcade.dev | Alex Salazar, CEO — LinkedIn | $60M Series A 6/15/26 (SYN + Morgan Stanley); "secure action layer" needs independent evidence | OEM | Week-3 template — pull forward; cite raise |
| 10 | Gumloop / Gumstack | Max Brodeur-Urbas, CEO — via YC page/LinkedIn | $50M Series B 3/12/26; Gumstack audits MCP *usage* but has no pre-trust signal; hosts 100+ MCP servers | OEM+MON | New email |
| 11 | Obot AI | Sheng Liang, CEO — linkedin.com/in/shengliang (active) | $35M seed; MCP gateway + catalog with access policies but no behavioral vetting; MCP Dev Summit keynoter | OEM | Week-2 template exists — personalize w/ keynote |
| 12 | Postman MCP Network | Noah Schwartz, Head of Product API Network + **api-network@postman.com** | "Trusted MCP Server List" — trust claim rests on manual fork-and-approve | OEM+BADGE | New email to printed address |
| 13 | Kilo Code / Anaconda | Scott Breitenother, CEO — LinkedIn | **Anaconda acquired Kilo 7/15/26 (yesterday)** citing enterprise governance; courting Roo's ~3M-install base (corrected: Roo officially recommended Cline — both compete for it) | OEM | New email while acquisition is hot |
| 14 | NeuralTrust | Joan Vendrell, CEO — LinkedIn/Forbes Council | $20M seed 6/17/26 (largest EU cyber seed); TrustGate brokers "every LLM, MCP, and tool call"; EU-independence angle | OEM | New email; EU + reproducibility story |
| 15 | JetStream | Raj Rajamani, CEO (ex-CrowdStrike CPO) — LinkedIn | $34M seed 3/03/26; AI Blueprints graph agents→tools but tool nodes carry no risk attribute | OEM | New email |
| 16 | ElizaOS | Shaw — @shawmakesmagic; GitHub elizaOS | Open npm-tagged plugin registry = ClawHub-shaped supply chain; Eliza Cloud monetizes plugins | MON | DM/GitHub; grade 2–3 popular plugins first |
| 17 | Olas (Pearl) | David Minarsch (Valory) — via olas.network/Discord | Pearl app store distributes fund-holding agents; 834 DAA, 15.6M tx; $13.8M raise | MON | New email/DM |
| 18 | Clanker | @clanker_world; Farcaster /clanker; owner Neynar @neynarxyz | $50M+ cumulative fees; $8M Ecosystem Fund actively deploying into infra | MON (fund-funded) | DM: ecosystem-fund-funded grading of Clanker-built agent tooling |
| 19 | Circle (Agent Stack) | Nikhil Chandhok, CPTO — LinkedIn; pressroom | Agent Stack launch 5/11/26: Agent Marketplace + "Circle Skills" (litmus-skill fit) + nanopayments (Preflight fit) | PART→OEM | New email; also x402 Foundation door |
| 20 | AIUC | Rune Kvist, CEO — linkedin.com/in/runekvist; aiuc.com/team | AIUC-1 added to CSA STAR registry 6/30/26; certs are point-in-time — polygraph = continuous behavioral layer | OEM/PART | New email; cite ElevenLabs/UiPath certs |
| 21 | Vanta | partnerships/integrations team | Agent for Risk launched 6/02/26 — auto-assesses vendors incl. AI tools with **no behavioral evidence source**; Trust Graph 400+ integrations | OEM | New email: grades as the evidence feed their risk agent cites |
| 22 | Drata | product/partnerships via drata.com | Agentic TPRM Assessment launched RSA 2026; VRM Agent "for teams managing thousands of third parties" | OEM | New email — same evidence-feed pitch as Vanta |

Also fire immediately (free, minutes each): MCP registry community PR (`registry-community-pr.md`), plugin directory submission (`plugin-directory-submission.md`, check its PR #92 prereq), 41 badge emails (`badge-emails.md`).

## A) Onchain agent ecosystems & launchpads

| Company | Pri | What / why they'd pay | Contact | Evidence | Offer |
|---|---|---|---|---|---|
| Heurist | P0 | Mesh: 100+ crypto tools as MCP servers/skills, x402-monetized, marketed "verifiable" — grade per Mesh tool is the missing proof | @heurist_ai; Discord; TG | heurist.ai | MON |
| Kite AI | P0 | Agent-payments chain (mainnet 4/30), Agent Passport, 90+ service providers; $35M raised — catalog ungated | Discord; @GoKiteAI | dailyhodl.com 4/30/26 | MON |
| ElizaOS (ai16z) | P0 | v2.0.3; open plugin registry (any npm tagged `elizaos`) + Eliza Cloud monetization; DAO treasury | @shawmakesmagic; GitHub | docs.elizaos.ai | MON |
| Olas / Valory | P0 | Pearl agent app store; 834 daily active agents, 15.6M tx; agents hold user funds | David Minarsch; Discord | theblock.co ($13.8M) | MON |
| Fetch.ai / ASI | P0 | Agentverse ~2.7–3M agents, consumer-discoverable, zero behavioral vetting; real treasury | CEO Humayun Sheikh; @Fetch_ai | cryptobriefing.com | MON |
| Clanker | P0 | $18B+ volume, $50M+ fees, $8M Ecosystem Fund deploying into infra/community | @clanker_world; Neynar | crypto.news | MON |
| OpenClaw/ClawHub | P1 | 2,857+ skills; ClawHavoc = 341 malicious (11.9%), Antiy counted 1,184; their fix (VirusTotal) misses behavior — litmus already caught what scanners missed | Peter Steinberger @steipete | unit42 + thehackernews 2/26 | MON |
| NEAR AI | P1 | Agent Market + "verified agent templates" (self-verified — independent grade stronger) | Illia Polosukhin @ilblackdragon | near.ai blog | MON |
| SendAI | P1 | Solana Agent Kit, 60+ actions, de-facto Solana agent standard; plugin surface | GitHub sendaifun | github | MON/BADGE |
| Sahara AI | P1 | Marketplace scaling to forkable third-party agents in 2026 | CEO Sean Ren; blog | saharaai.com/blog | MON |
| Recall Network | P1 | 175K agents, 10 skill markets incl. "Safety" — partner or rival; data-feed sale | Discord; @recallnet | gate.com wiki | OEM/PART (careful) |
| Catena Labs | P1 | AI-native regulated bank ($30M a16z, OCC charter filed) — needs auditable tool risk | CEO Sean Neville (Circle co-founder) | fortune.com 5/20/26 | OEM |
| Halliday | P1 | AWP "immutable guardrails" ($20M a16z) — guardrails lack third-party service trust input | @HallidayHQ | fortune.com | PART |
| Giza (ARMA) | P1 | $3.96B agentic volume, 25K+ agents shuffling user stablecoins; grade = marketing weapon vs Axal/Almanak | @gizatechxyz; CEO Renç Korzay | cryptodaily 5/26 | PRI/MON |
| AltLayer Autonome | P1 | "Verifiable Agentic Web" = restaking attestations only; behavioral leg missing | @alt_layer | theblock.co | PART/MON |
| Phala Network | P1 | TEE hosting for MCPs, 1,000+ teams; TEE proves integrity, polygraph proves behavior — bundle | @PhalaNetwork; Marvin Tong | phala.com MCP post | PART |
| Questflow | P1 | MAOP agent-swarm orchestration ($6.5M; partners Google/CDP/Circle) | @questflow | blog.questflow.ai | PART |
| Injective | P1 | Shipped own MCP server ~7/05/26 + iAgent SDK; ecosystem budget exists | Eric Chen; @injective | cryptonews 7/26 | PRI/MON |
| Cookie.fun | P1 | Tracks 1,500 agents (mindshare) — add a trust-grade column; grade feed sale | @cookiedotfun | cryptorank.io | OEM |
| x402 Foundation | P1 | LF-governed, 40 members (Visa/MC/Google/AWS/Stripe/Coinbase); ecosystem directory of paid MCP servers has no trust layer — one door to all payers | x402.org; LF membership | opensourceforu 7/26 | PART→OEM |
| Nevermined | P2 | Monetizes MCP servers (1.38M tx); "pay only graded endpoints" upsell; content-hungry | nevermined.ai | their MCP blog | PART |
| Almanak | P2 | Vaults sell third-party agent strategies to retail | almanak.co | site | PRI |
| Axal | P2 | TEE + slashing "verified agents" — philosophically pre-sold, small | GitHub getaxal | blockworks | BADGE |
| Talus | P2 | Sui agent L1, "verifiable agents" headline; accelerator needs vetting | talus.network | blog.talus | MON |
| Freysa | P2 | ML.INK deploys third-party agents; pseudonymous team, hard to reach | freysa.ai | phemex academy | PRI |
| Wayfinder | P2 | Paths = pre-built action routes agents trust blindly (rug-pull-recheck shaped) | wayfinder.ai | mexc news | PART |
| Daydreams | P2 | ERC-8004 + x402 agentic commerce; small | GitHub daydreamsai | bitget academy | PART |
| Creator.bid | P2 | Binance delisted BIDUSDT 1/21/26 — motivated but weakened treasury | @CreatorBid | coinmarketcap | BADGE |
| Griffain | P2 | Permission-grant UI could surface grades; token depressed | griffain.com | solanacompass | BADGE |
| Zerebro/ZerePy | P2 | Framework largely superseded; skip unless registry revives | GitHub blorm-network | messari | — |
| Theoriq | P2 | Pivoted to RWA yield; weak fit now | theoriq.ai | site | — |
| Virtuals | KNOWN+ | ACP escrow settles on unverified provider agents; Revenue Network $1M/mo; Robinhood 7/02 | Jansen Teng | prnewswire | MON — asset ready |
| Bankr | KNOWN+ | Grok–Bankr exploit 5/26 (~$150–200K drained) = the door-opener | @bankrbot (warm) | oecd.ai incident | MON — asset ready |

## B) MCP & skill registries, marketplaces, IDE directories

| Company | Pri | What / why they'd pay | Contact | Evidence | Offer |
|---|---|---|---|---|---|
| Cline MCP Marketplace | P0 | CONFIRMED 5M+ installs / 2.7M devs; review = README test-install; users requested scanning in #9786; "Clinejection" supply-chain attack = narrative fuel | Saoud Rizwan, CEO; submission repo | cline.bot/blog 5m-installs | OEM+MON |
| agentskill.sh | P0 | "274k skills" claim REAL but internally inconsistent (a subcategory claims 288k) — unaudited scraped index, don't cite the number; sells 0–100 static security scores; Snyk took Tessl+skills.sh — they're unsigned | Romain Simon @romainsimon | agentskill.sh | OEM |
| Kilo Marketplace | P0 | Curated skills+MCP for Kilo; **Anaconda acquisition 7/15/26**, governance-framed; genuinely forked Roo but Roo recommended Cline — Kilo is fighting for that 3M-install base (trust signal = weapon) | Scott Breitenother, CEO | anaconda.com/blog + blog.kilo.ai | OEM |
| Postman MCP Network | P0 | "Trusted MCP Server List", verified publishers; manual review only | Noah Schwartz + api-network@postman.com | learning.postman.com | OEM+BADGE |
| Docker MCP Catalog | P1 | 300+ servers; provenance/SBOM trust only — no behavioral testing (their own blog admits gap) | GitHub docker/mcp-registry | docker.com blog | OEM |
| GitHub MCP Registry | P1 | Curated registry → one-click VS Code installs; curation = stars, not behavior; allowlists need data | github.com/mcp; blog authors | github.blog | OEM |
| Official MCP Registry | P1 | 9,652 servers; moderation removes flagged malware only; upstream chokepoint — grades propagate downstream | modelcontextprotocol/registry maintainers | moderation-policy doc | PART/BADGE |
| Windsurf Plugin Store | P1 | Curated one-click MCP store in Cascade | Cognition — form/X | docs.windsurf.com | OEM |
| Continue Hub | P1 | Community MCP blocks compose into assistants — one bad block poisons many | GitHub/Discord | blog.continue.dev | OEM |
| Kiro (AWS) | P1 | One-click MCP directory; inheriting Amazon Q base | kiro.dev; AWS builder channels | kiro.dev/docs | OEM |
| HF Spaces MCP | P1 | Every Gradio Space auto-gets MCP badge — zero review by design | HF hub team; GitHub | huggingface.co/docs | PART |
| Apify | P1 | 7,000+ Actors as MCP tools; already engaged a free MSEEP scan (issue #620) — proven appetite | GitHub apify | apify issue #620 | MON |
| mcpservers.org | P1 | Directory + skill library, no review; badge licensing | site/GitHub | mcpservers.org | BADGE→OEM |
| Anthropic plugins dir | P1 | External submissions must meet "quality and security standards" — litmus-skill maps exactly; partnership not sale | GitHub submission | claude-plugins-official | PART |
| JetBrains MCP plugin | P2 | In-IDE MCP discovery in the most enterprise IDE family | Marketplace vendor page | plugins.jetbrains.com | OEM |
| Zed | P2 | Deprecating own MCP extensions → official registry; grade layer = the trust story they're dropping | GitHub zed-industries | zed.dev/docs | PART |
| Raycast MCP Registry | P2 | Consumer one-click installs incl. community entries; highest blast radius per bad server | GitHub raycast/extensions | raycast.com | OEM |
| AWS Marketplace AI Agents & Tools | P1 | 900 listings at launch → **3,300+ in under a year**, MCP/A2A flags but zero behavioral trust signal; near-term wedge = listed vendors buy grades/badges | APN partner team (APN blog authors) | aws.amazon.com/blogs/apn | OEM/BADGE |
| Azure API Center / mcp.azure.com | P2 | "Review and verify every server" pitch with no verifier shipped | MS Integration team | techcommunity post | OEM |
| Cloudflare managed MCP catalog | P2 | (see row in C — consolidated) | — | — | — |
| Gemini CLI extensions | P2 | Google's own docs: "does not vet, endorse, or guarantee… security" — verbatim gap | GitHub google-gemini | cloud.google.com blog | OEM |
| geminicliextensions.com | P2 | Community aggregator, zero review; cheap badge deal | site form | site | BADGE |
| ChatGPT apps/plugin directory | P2 | Runs own review; watch, not payer | developers.openai.com | help.openai.com 7/09/26 | — |
| MseeP.ai | P2 | Competitor-adjacent: 7,758 servers, static scores, cold-outreach-by-issue tactic; license or contrast | mseep.ai | mseep.ai | OEM/contrast |
| Claude Skills Hub | P2 | 381 editor-curated skills; small, SEO-visible | site | claudeskills.info | BADGE |
| Claude Directory | P2 | Skill SEO directory, no review | site form | claudedirectory.org | BADGE |
| ClaudePluginHub | P2 | Indexes marketplaces themselves; "graded marketplace" layer | site form | claudepluginhub.com | BADGE |
| Tessl Registry | KNOWN+ | Snyk security scores now on every public skill — slot taken by static scanning; wedge = behavioral+onchain | tessl.io | tessl.io/blog | contrast |
| skills.sh (Vercel) | KNOWN+ | Snyk×Vercel 2/17/26: scan on every install + leaderboard; ~147 skills/day growth | vercel.com | snyk.io/blog | contrast |
| ClawHub | KNOWN+ | see row in A (OpenClaw) | — | — | MON |

## C) Enterprise MCP gateways, governance, agent identity (OEM grade-feed lane)

| Company | Pri | What / why they'd pay | Contact | Evidence | Offer |
|---|---|---|---|---|---|
| Obot AI | P0 | $35M seed; gateway+catalog+policies, no behavioral vetting — grade feed per catalog entry | Sheng Liang, CEO (LinkedIn, active) | obot.ai blog | OEM |
| JetStream | P0 | $34M seed 3/03/26; AI Blueprints graph agents→tools→identities; tool nodes lack risk attribute | Raj Rajamani, CEO | techstartups.com | OEM |
| NeuralTrust | P0 | $20M seed 6/17/26 (largest EU cyber seed); TrustGate policy per tool call; EU independence resonance | Joan Vendrell, CEO | neuraltrust.ai/news | OEM |
| ServiceNow AI Control Tower | P0 | June 2026 release: MCP servers = governed asset type; AI Steward approval mandate with no evidence source | Jon Sigler EVP AI Platform (alt: Nenshad Bardoliwalla) | servicenow community 6/26 | OEM |
| Salesforce AgentExchange | P0 | "Verified MCP server" listings from 35 partners; verification = partner review; $50M builders fund | Brian Landsman EVP BD (alt: Alice Steinglass); partner form | salesforce.com blog | OEM/BADGE |
| AWS AgentCore Gateway + Marketplace | P0 | Marketplace MCP listings with no behavioral trust signal; Gateway GA motion H1 2026 | Marketplace seller/partner desk | docs.aws.amazon.com | OEM |
| Cloudflare (Portals + managed catalog + **Monetization Gateway**) | P0 | MCP Server Portals (admin picks servers, 6/26 service tokens); Monetization Gateway 7/01/26 charges for MCP tools via x402 — "graded tools are payable tools"; x402 Foundation co-founder | Portals: Kenny Johnson (byline); MG bylines Rohin Lohe/Justin Ridgely/Will Papper (VERIFY on-page) | blog.cloudflare.com | OEM/PART |
| Keycard | P1 | $38M; agent access scoping (ex-Snyk CTO Ian Livingstone — gets advisory-feed model); Anchor.dev acquired 2/26 | Ian Livingstone, CEO | globenewswire 5/14/26 | OEM |
| WitnessAI | P1 | $58M 1/13/26; monitors which MCP servers agents access — no server grading | witness.ai demo form | witness.ai | OEM |
| Operant AI | P1 | MCP Gateway runtime defense ($13.5M); pre-admission grade = static complement | Vrajesh Bhavsar, CEO | globenewswire | OEM/PART |
| Aembit | P1 | MCP Identity Gateway issues credentials per session — grade as admission criterion; Netskope partner | Emma Zaballos, Sr PMM (writes their MCP posts) | aembit.io blog | OEM |
| Prefect / FastMCP Cloud | P1 | Horizon registry+gateway; FastMCP = dominant Python MCP framework; **acquired Dagster 7/13/26** | Jeremiah Lowin — GitHub jlowin, jlowin.dev | businesswire 7/13 | OEM/PART |
| Aurascape | P1 | Zero-Bypass MCP Gateway 3/17/26 signs "approved" tool calls — approval needs evidence | aurascape.ai demo | businesswire | OEM |
| Trust3 AI | P1 | MCP Security launch 5/20/26; early-stage, needs credibility | Don Bosco, co-founder | prnewswire | OEM |
| Okta (XAA / OIN) | P1 | XAA stable ~6/18; Auth0 EA end July 2026, OIN Aug 2026 — listing vetting slot; governs connection not safety | Okta partner/OIN program | okta.com newsroom | OEM |
| Google Gemini Enterprise Agent Platform | P1 | Agent Registry needs trust metadata; managed remote MCP 6/30/26; F5 guardrails precedent for partners | GC partner program | nerova.ai 6/30 | OEM |
| GitHub Copilot MCP allowlists | P1 | Registry-only allowlists enforce by name-match (gap they admit); every enterprise needs populate-data | Copilot admin/registry team | github.blog changelog 4/16 | OEM |
| F5 (AI Guardrails) | P1 | CalypsoAI $180M acquisition; no MCP-server reputation source; Google Agent Gateway integration | f5.com AI security team | f5.com blog | OEM |
| Manufact (mcp-use) | P1 | $6.3M Peak XV 2/12/26; mcp-use SDK 5–7M downloads — check_server lookup baked into SDK = distribution | Luigi Pederzani & Pietro Zullo (YC S25) | manufact.com/blog | PART/OEM |
| Zuplo | P2 | MCP gateway beta; "tool curation" needs curation input; content-hungry | zuplo.com | zuplo.com/blog | OEM |
| Gravitee | P2 | Agent Mesh + MCP analytics (usage, not trust) | partner form | gravitee.io | OEM |
| Token Security | P2 | NHI inventory covers MCP servers; $27M; RSAC sandbox | token.security | zeltser.com | OEM |
| Oasis Security | P2 | $120M Series B 3/26 for NHI + agentic access governance | oasis.security | softwarestrategiesblog | OEM |
| Vijil | P2 | Trust scores for *agents* (adjacent) — co-referral; watch positioning overlap | vijil.ai | vijil.ai/blog | PART (careful) |
| ModelCop | P2 | Launched 7/04/26; identity-first agent security; needs differentiators | David Stanton, CEO | prnewswire | OEM |
| Teleport | P2 | Secure MCP GA (RBAC/JIT on MCP servers); pre-enrollment check slot | goteleport.com sales | securitybrief.ca | OEM |
| 1Password | P2 | Agentic credential access; explicitly building MCP-gateway partner ecosystem; Codex MCP w/ OpenAI 5/19 | partnerships via press page | siliconangle 5/20 | PART |
| Smithery | P2 | 9,400+ servers + hosting; competitor-adjacent — approach as data licensee | Henry Mao, founder | tooldirectory.ai | OEM (careful) |
| WorkOS | P2 | AuthKit MCP OAuth + FGA tool-level permissions could consume grades; publishes MCP comparisons | workos.com | workos.com/blog | PART |
| Netskope One AI Gateway | P2 | SASE-scale MCP inspection, no server-reputation feed (they buy URL-reputation feeds — same model) | partner program | aembit partnership post | OEM |
| Microsoft Agent 365 | KNOWN | already in 7/04 research — gateway at $15/user/mo GA 5/26 | — | — | OEM |
| Runlayer, MintMCP, Kong, Lunar.dev, TrueFoundry, Helmet, Usercentrics | KNOWN | `gateway-marketplace-batch.md` emails ready — send in sprint | see asset | 7/04 research | OEM — ASSET READY |

## D) Tool-integration platforms & agent frameworks

| Company | Pri | What / why they'd pay | Contact | Evidence | Offer |
|---|---|---|---|---|---|
| Composio | P0 | 1,000+ toolkits/~20k tools; enterprise MCP Gateway push; $29M (Lightspeed); "vetted" claim unproven | Soham Ganatra, CEO @GanatraSoham | composio.dev/mcp-gateway | OEM |
| Arcade.dev | P0 | 7,500+ tools/81 servers; $60M A 6/15/26; policy runtime needs per-tool evidence; co-authored MCP SEP w/ Anthropic | Alex Salazar, CEO | businesswire 6/15 | OEM |
| Gumloop / Gumstack | P0 | $50M B 3/12/26; Gumstack = MCP hosting/audit/governance, no pre-trust signal; 100+ hosted MCPs; v10.5.0 6/26 proxied-MCP creds | Max Brodeur-Urbas, CEO (+Rahul Behal) | gumloop.com blog/changelog | OEM+MON |
| Pipedream (Workday) | P1 | ~3,000 apps/10k tools via MCP; Workday acquisition closed 2/26 — enterprise procurement ammunition | Tod Sacerdoti — /in/sacerdoti | pipedream.com blog | OEM |
| Zapier MCP | P1 | 30,000+ actions/9,000 apps — biggest single MCP action surface | zapier.com/mcp | zapier blog | OEM |
| n8n | P1 | 1,348 community nodes + native MCP server (preview 4/26) — ungraded supply chain users opt into | forum/GitHub | nodesify guide | MON |
| Paragon ActionKit | P1 | 1,000+ actions/130+ connectors; Triggers beta 5/06/26; sells to B2B SaaS embedding agents | useparagon.com demo | prnewswire 5/06 | OEM |
| Klavis AI | P1 | YC; hosted MCP, ~40k users; cheapest "graded catalog" differentiation vs giants | Zihao Lin & Xiangkai Zeng | tooldirectory.ai | MON |
| Merge Agent Handler | P1 | MCP endpoint → 200+ integrations w/ DLP/audit; grades extend security story | merge.dev demo | docs.merge.dev | OEM |
| StackOne | P1 | 430+ connectors/26k actions; $24M GV+Workday; fights trust-content war — grades = evidence | stackone.com | stackone blog | OEM |
| Nango | P1 | 800+ APIs, OSS, hosted MCP; transparency positioning matches reproducibility | GitHub NangoHQ | nango.dev blog | OEM/BADGE |
| CrewAI | P1 | AMP: 100+ tools, tool publish/install, F500 claims | enterprise form; GitHub | docs.crewai.com | OEM |
| Make.com | P1 | MCP Server (3k apps/30k actions) + MCP Client importing third-party MCP risk | community | help.make.com | OEM |
| Dust.tt | P1 | Curates MCP integrations into customer workspaces monthly | dust.tt | dust.tt blog | OEM |
| Cursor | P1 | 3.10 (6/30/26): admin-approved Team MCP marketplaces — approval input missing; also KNOWN week-3 target | cursor.com teams | mcp.directory blog | OEM — asset ready |
| Relevance AI | P1 | 1,000+ cloneable agents; community submissions unvetted | marketplace submissions team | relevanceai blog | OEM/BADGE |
| Activepieces | P1 | ~400 pieces auto-exposed as MCPs; 60% community-contributed; MIT | Ashraf Samhouri, CEO — GitHub | github activepieces | MON/BADGE |
| Retool Agents | P2 | Agents attach remote MCPs; governance gap documented not solved | retool.com | retool blog | OEM |
| Goose (Block/AAIF) | P2 | Allowlist mechanism with no data source — grade feed is literally the file it points at | GitHub block/goose | goose docs /allowlist | PART/OEM |
| Unified.to | P2 | 500+ SaaS MCP; trust-posture competitor content | unified.to | their blog | OEM |
| Truto | P2 | MCP buyer's-guide content engine; next comparison axis = behavior | truto.one | their blog | OEM |
| Toolhouse | P2 | App-store model, >$1M TSV; listing standards need grades | LinkedIn/GitHub | toolhouse blog | BADGE/OEM |
| Superface | P2 | "Agentic reliability" small player; A-grade = outsized differentiation | @superfaceai | superface.ai | BADGE |
| LangChain | P2 | mcp-adapters funnel ungraded MCPs into agents; docs-level integration | GitHub langchain-ai | changelog.langchain | PART |
| LlamaIndex | P2 | LlamaHub 200+ tools, no vetting layer | GitHub run-llama | llamahub.ai | PART |
| Poke (Interaction Co) | P2 | Consumers attach arbitrary MCPs to an agent reading their email | @interaction; GitHub | techcrunch 4/08/26 | OEM |
| Exa | P2 | Tool-vendor side: A-badge on their MCP server = distribution asset | GitHub exa-labs | docs.exa.ai | BADGE/PRI |
| Mistral (Le Chat connectors) | P2 | 28 curated MCP connectors 6/05/26; small team — outsourced grading natural | help.mistral.ai | mistral.ai news | OEM |
| Perplexity Connectors | P2 | Users add arbitrary remote MCPs; no vetting surface yet | help center | perplexity help | OEM |
| Browserbase | P2 | Stagehand + MCP server in thousands of stacks | @browserbasehq | docs.stagehand.dev | BADGE |
| Browser Use | P2 | Leading OSS browser-agent lib + MCP | GitHub browser-use | webfuse roundup | BADGE |
| Anchor Browser | P2 | "Secure" hosted browser MCP — grade proves the adjective | docs/GitHub | docs.anchorbrowser.io | BADGE/PRI |
| Lindy | P2 | MCP support "developing" — early conversation | lindy.ai | toolchase review | OEM |
| Wordware | P2 | ~2,000 connections, non-technical builders; $30.5M | Filip Kozera & Robert Chandler | tracxn | OEM |
| Beam AI | P2 | Tool-access/autonomy controls need grade input | beam.ai demo | beam.ai | OEM |
| OpenAI Apps SDK | P2 | Own review; watch + position litmus as independent re-check | submission pipeline | openai.com | — |
| LiteLLM, Obot(→C), Windsurf(→B), Amp, Amazon Q(→Kiro) | KNOWN | week-2/3 templates in `outreach-emails.md` | see asset | 7/04 research | ASSET READY |

## E) Agent-payment rails & agent commerce

| Company | Pri | What / why they'd pay | Contact | Evidence | Offer |
|---|---|---|---|---|---|
| Coinbase CDP + x402 Foundation | P0 | x402 under LF, 40 members; CONFIRMED (CoinDesk 7/15): ~75M txns/~$24M per 30d, ~94k buyers/22k sellers, avg $0.32 — quote WITH attribution + caveat that counts include meme-coin farming (clean Base ≈3.1M txns/30d, Chainalysis); Agent.market directory unvetted; Preflight = native x402 merchant | LF membership; CDP devrel; Agent.market listing | coindesk 7/15 + chainalysis.com | PART→OEM |
| Skyfire | P0 | "Agent Trust Stack" (KYA) verifies identity not behavior; Visa demo 12/25 | Amir Sarhangi, CEO — /in/asarhangi | businesswire; F5 partnership 3/18 | OEM |
| Circle Agent Stack | P0 | 5/11/26 launch: Agent Wallets/Marketplace/Nanopayments/Circle Skills — marketplace = badge surface, Skills = litmus-skill fit, nanopayments = Preflight fit | Nikhil Chandhok, CPTO | circle.com pressroom | PART→OEM |
| Crossmint | P1 | Agent wallets on card+stablecoin rails; SOC2/MiCA; fraud/liability reduced by pre-flight verdicts | Rodri Fernandez Touza, co-founder; /learn team | crossmint.com/learn | OEM |
| Fireblocks | P1 | Agentic Payments Suite 5/26; contributed x402 security extension (spend governance) — polygraph governs whom you pay | x402 WG; fireblocks.com | prnewswire | PART |
| Payman AI | P1 | Policy-controlled agent wallets ($28.8M); "only pay graded-B-or-better tools" = one boolean away | paymanai.com | caplight | OEM |
| Nevermined | P1 | (see A/P2 — MCP monetization content engine; billing for Olas) | nevermined.ai | their blog | PART |
| Privy (Stripe) | P1 | Agentic wallets w/ policy hooks; publishes an OpenClaw wallet skill — **gradeable today = concrete first touch**; door into Stripe ACP | GitHub privy-io | github skill repo | BADGE→PART |
| Turnkey | P1 | TEE policy evaluation = where a pre-flight verdict enforces | turnkey.com | crossmint comparison | PART |
| Stripe ACP | P1 | Open spec on GitHub — zero-cost contribution path to insert trust-check language | github agentic-commerce-protocol | github | PART |
| Visa Intelligent Commerce | P1 | 4 agent protocols, OpenAI partnership 6/26; no tool-grading layer; enterprise cycle | partner program | digitalcommerce360 | OEM (slow) |
| Mastercard Agent Pay | P1 | Agentic Tokens live HK/TH; AP4M needs machine-readable trust | partner program | eco.com explainer | OEM (slow) |
| PayPal | P2 | Agent Ready GA; merchant-side, far from MCP today | paypal.ai | newsroom | — |
| FluxA | P2 | New entrant; already frames "MCP risk control" content | fluxapay.xyz | their learning post | PART |
| Google Pay.sh / AWS AgentCore Payments | P2 | Enterprise doors — reach via x402 Foundation instead | via LF | startuphub.ai | PART |

## F) Insurance, audit, compliance, red-teaming

| Company | Pri | What / why they'd pay | Contact | Evidence | Offer |
|---|---|---|---|---|---|
| AIUC | KNOWN+ P0 | AIUC-1 in CSA STAR registry 6/30/26; ElevenLabs first insured policy 2/26, UiPath certified 3/26; certs point-in-time → polygraph = continuous layer | Rune Kvist, CEO — /in/runekvist | cloudsecurityalliance 6/30 | OEM/PART |
| Armilla AI | P0 | Lloyd's coverholder, $25M+ limits 1/26; already buys behavioral assessment into underwriting — ours is deterministic + disputable-proof | Karthik Ramakrishnan, CEO — /in/karthikramki | armilla.ai | OEM |
| Munich Re aiSure / Mosaic | P0 | $15M coverage for AI vendors 2/27/26; parametric claims "settled on measurable performance data" — onchain reproducible grade = trigger source | Michael von Gablenz / Michael Berger (MR); Dennis Bertram (Mosaic) | mosaicinsurance press | OEM |
| Testudo | P1 | Lloyd's MGA, $9.25M capacity; "no audits, no code access" — polygraph needs no code access either; improves loss ratios without breaking pitch | testudo.co | fintech.global 3/09 | OEM |
| Vouch | P1 | Affirmative AI E&O incl. hallucinations 3/16/26 (**VERIFY — third-party source**); insures the startup cohort shipping MCPs | vouch.us | reinsurancene.ws | OEM |
| Relm (RESCAAI) | P1 | First-party response for orgs embedding third-party AI = exactly the MCP-consumer risk | relminsurance.com | their launch post | OEM |
| Chaucer (Vanguard AI) | P1 | Covers "deviations from expected AI behavior" — literally what litmus fingerprints; reach via Armilla (one door, two carriers) | via Armilla | theinsurer 2/11 | OEM |
| Vanta | P0 | Agent for Risk (6/02/26) auto-assesses vendors incl. AI tools — no behavioral evidence source; Trust Graph 400+ integrations, 1,400+ tests; ISO 42001 automation | partnerships/integrations | businesswire 6/02/26 | OEM |
| Drata | P0 | Agentic TPRM Assessment (RSA 2026); VRM Agent managing thousands of third parties — needs citable independent AI-tool evidence | drata.com partnerships | drata.com/blog | OEM |
| Haize Labs | P1 | Point-in-time adversarial findings; powers RiskRubric.ai (appetite for public scoring) — attestation layer complement | Leonard Tang — LinkedIn | aisecurityandsafety.org | PART |
| Gray Swan | P1 | Human red-team network; reports could cite/embed grades | grayswan.ai | their site | PART |
| Promptfoo → OpenAI | P1 | Acquisition announced 3/09/26 — removes nearest independent MCP scanner; **positioning gift: polygraph = the remaining independent option** | (post-close: OpenAI) | futurumgroup | contrast |
| Patronus AI | P1 | $50M B 6/25/26; simulations test the customer's agent, we grade the tools it calls — adjacent, same buyers | patronus.ai | techcrunch 6/25 | PART |
| Lakera (Check Point) | P2 | CORRECTED: acquired by Check Point ~$300M (agreed 9/16/25); Guard/Red live as Check Point AI CoE; b3 benchmark w/ UK AISI (194k human attacks) | via Check Point AI CoE | checkpoint.com press | PART |
| Workstreet | P2 | AIUC-1 readiness consultancy — could resell grades in engagements | workstreet.com | their explainer | PART |
| Braintrust | P2 | Continuous production agent-eval scoring 3/26; same hook as Patronus | braintrust.dev | their articles | PART |
| **Delve** | **AVOID** | Apr 2026 fake-SOC2-audit allegations, YC exit — reputational contagion; useful only as cautionary contrast in content | n/a | captaincompliance | — |
| A-LIGN, IANS, Snyk, Zenity, Noma, HUMAN, Flint, Descope | KNOWN | 7/04 research tiers 3–4; Snyk = incumbent to differentiate against (static vs behavioral) | see 7/04 file | — | OEM |

## G) Existing 110-lead file → asset mapping (work these WITH the new rows)

Full detail: `drafts/client-sources-research-2026-07-04.md`. Ready-to-send sequencing from `drafts/outreach-2026-07/outreach-emails.md`:

| Batch | Targets | Asset | Status |
|---|---|---|---|
| Warm 3 | Bankr, Base, Virtuals | bankr-chat-message.md, week-1 email, virtuals-pilot-one-pager.md | ASSET READY — send Day 1–2 |
| Registry week 1 | Glama (careful: punkpeye = awesome-mcp PR #8339 holder), + registry community PR | outreach-emails.md wk1, registry-community-pr.md | ASSET READY |
| Gateway batch | Runlayer, MintMCP, Kong, Lunar.dev, TrueFoundry, Helmet (+30 more in file) | gateway-marketplace-batch.md | ASSET READY |
| Registry week 2 | Smithery, PulseMCP, Obot | outreach-emails.md wk2 | ASSET READY (Obot upgraded → hot sheet #11) |
| Week 3 | Cursor, Arcade, Composio, LiteLLM | outreach-emails.md wk3 | Arcade/Composio upgraded → hot sheet #8/#9 — pull forward |
| Incident-driven | ClawHub/OpenClaw, skills.sh, Tessl | gateway-marketplace-batch.md incident pitches | skills.sh/Tessl now Snyk-signed → reframe as contrast, not sale |
| Badge cohort | 41 A-graded maintainers | badge-emails.md | ASSET READY — fire during launch wave |
| OEM/insurer | Snyk, Manifold, AIUC, A-LIGN, IANS | 7/04 file tier 3–4 | AIUC upgraded → hot sheet #20 |

## H) Distribution channels (≤$100 budget)

| Channel | Audience | Cost | Path | Fit |
|---|---|---|---|---|
| AAIF Discord + MCP Dev Summit CFPs | The people who write the MCP spec; MCPCon EU Amsterdam 9/17–18, NA 10/22–23 | Free | sessionize CFPs; aaif.io Discord | **Best $0 channel**; litmus/methodology talk |
| PulseMCP directory + newsletter | MCP-obsessed devs; run by MCP Steering Committee members (Tadas + Mike) | Free | "Submit" on pulsemcp.com/servers | Get grades linked from listings; mind Glama adjacency |
| r/LocalLLaMA, r/ClaudeAI, r/mcp | Core AI-builder subs | Free | 90/10 rule; open-source benchmark posts ("we graded the top 100 MCP servers") not product pitches | High if framed as findings |
| Show HN | HN front page (one-shot) | Free | `show-hn.md` ready + objection FAQ | Centerpiece of Strategy B |
| Latent.Space | 200k+ subs AI engineers | Free guest post | "Write for us" form; warm X intro to @swyx, ~1mo lead | Guest post > sponsorship |
| tl;dr sec | 90k+ security pros | Free if noteworthy | @clintgibler on X (NOTE: LinkedIn now says "Leading Cyber @ OpenAI") | He curates tools weekly — MCP grading is his beat |
| dev.to (+ canonical cross-post) | Millions of devs | Free | Publish grading-sweep writeups, canonical to polygraph.so/blog | Good SEO echo |
| X promoted post | Existing @polygraphso + targeting | ~$50 one-day boost | ads.x.com Quick Promote | Amplify launch thread only |
| Ben's Bites "unclassified" tier | ~100–120k builders | ~$200 (2024 data — stale, VERIFY) | bensbites.com | Only near-budget paid slot; P2 |
| TLDR / The Rundown | 1–7M | $3k+/issue | advertise pages | Over budget — park |
| Simon Willison | Large indie dev/LLM audience | Not pitchable | Ship something notable (open MCP-grading dataset) | Organic only |

## I) Hooks library (dated ammunition for all outreach — verify morning-of before quoting)

- **7/15/26** Visa, Mastercard, Ripple join x402 Foundation (coindesk) · **Anaconda acquires Kilo Code** (anaconda.com/blog)
- **7/13/26** Prefect acquires Dagster; "governs how agents reach tools through FastMCP" (businesswire)
- **7/09/26** OpenAI merges ChatGPT app directory into cross-Codex Plugin directory (help.openai.com)
- **7/2026** Cloudflare Monetization Gateway (7/01, x402 for MCP tools); LF x402 Foundation operational, 40 members; Adversa AI July MCP-security roundup (MCPPrivacyDetector: >10% of 10k servers leak credentials/PII); Akamai warning on new MCP spec pushing security onto developers
- **6/30/26** Microsoft: poisoned MCP tool descriptions, >60% attack success on popular agents (microsoft.com/security/blog) · AIUC-1 added to CSA STAR registry
- **6/2026** Internet-wide MCP scans (exposed servers ~tripled to 1,467, Trend Micro); Kaspersky Securelist on malicious MCP servers in supply-chain attacks; NeuralTrust $20M (6/17); Arcade $60M (6/15); Patronus $50M (6/25); Cursor 3.10 Team MCP marketplaces (6/30); Google managed remote MCP (6/30); Cloudflare portal service tokens (6/26)
- **5/2026** Grok–Bankr Morse-code exploit ~$150–200K (oecd.ai) · OX: 200,000+ MCP servers w/ STDIO command-execution flaw · Trend Micro "Hunt Them All": 19,000 repos swept, 600–1,650 exploitable · ServiceNow Knowledge 2026 agent kill-switches + MCP approval mandate (5/05) · Circle Agent Stack (5/11) · Keycard multi-agent identity launch (5/14) · Trust3 MCP Security (5/20) · Roo Code shutdown → Kilo inherits ~3M installs (5/15, VERIFY) · Amazon Q → Kiro (5/15)
- **4/2026** OX registry poisoning: **9 of 11 public MCP registries accepted a malicious PoC without review** (the universal cold-open) · OX MCP STDIO RCE advisory (14 CVEs) · LLM-router attacks: 26 routers injecting tool calls, one wallet drained $500K (coindesk 4/13) · n8n native MCP preview · Poke consumer MCP (TechCrunch 4/08) · Kite Chain mainnet (4/30)
- **2–3/2026** ClawHavoc: 341 malicious ClawHub skills, 11.9% of registry, AMOS stealer; Antiy count 1,184 (~247k installs) · Snyk ToxicSkills: 36% of 3,984 skills flawed, 76 malicious; Snyk×Tessl + Snyk×Vercel (2/17) · SmartLoader trojanized Oura MCP (Straiker) · Promptfoo→OpenAI (3/09) · JetStream $34M (3/03) · Gumloop $50M (3/12) · Workday closes Pipedream (2/26) · Moltbook: 1.4M agents, Meta acquired 3/10 · 8004scan mainnet ~10k ERC-8004 agents (2/26) · Check Point: Claude Code RCE via poisoned repo configs (2/25)
- **Gov weight:** NSA AISC MCP-specific CSI (5/20/26: MCP auth optional, identity unverifiable) · Five Eyes "Careful Adoption of Agentic AI Services" (4/30/26, 100+ recommendations) — "the NSA says to do this; polygraph is the reproducible way to do it"
- **Standing frames:** OWASP Agentic Skills Top 10 (map litmus categories onto it) · CSA SKILL.md context-poisoning note (5/06) · EU AI Act high-risk obligations 8/02/26 · postmark-mcp = behavioral backdoor with no CVE (why CVE scanners miss this class) · "Clinejection" supply-chain attack on Cline itself · Lakera×UK-AISI b3 benchmark (194k human attack attempts)

## J) Strategic reads (from the research, for the strategy files)

1. **Snyk land-grab clock:** Snyk signed Tessl + skills.sh/Vercel (Feb 2026). Unsigned marketplaces (agentskill.sh, Cline, Kilo, Postman, Continue, Kiro, HF) are the open board. Wedge = behavioral/runtime + reproducible onchain proof, which static scanning can't do.
2. **Approval-workflow-without-evidence gap:** ServiceNow, GitHub, Salesforce, Cloudflare, Google all shipped MCP allowlist/approval surfaces in H1 2026 that enterprises must populate with trust judgments they can't produce. That's the OEM lane.
3. **Fresh money map:** Arcade $60M, NeuralTrust $20M, JetStream $34M, Gumloop $50M, Keycard $38M, WitnessAI $58M, Obot $35M, Kite $35M, Catena $30M — all have data-partnership budget, none runs a behavioral harness.
4. **x402 flipped in our favor July 2026:** LF governance + Visa/MC/Ripple joining 7/15; the payment rail exists, the trust rail doesn't; Preflight is a native x402 merchant. One Foundation door reaches Coinbase, Cloudflare, Circle, Fireblocks, Visa, Mastercard.
5. **Insurance became a market in H1 2026:** Armilla $25M limits, Testudo underwriting, Chaucer Vanguard AI, Mosaic×Munich Re, ElevenLabs' AIUC-1 policy. Munich Re's parametric structure is the strongest technical fit for onchain grades as underwriting/trigger input.
6. **Promptfoo→OpenAI = positioning gift:** the conflicted-labs argument now has a concrete example; polygraph is the remaining independent behavioral scanner.
7. **Incidents are behavioral, not CVE-shaped:** postmark-mcp, poisoned tool descriptions, ClawHavoc — all map to litmus C-01/C-03; lead with that in every pitch.
8. **Competitor-adjacent, handle with care:** MseeP (static scores, outreach-by-issue), Recall ("Safety" skill market), Vijil (agent trust scores), Skyfire KYA, AltLayer "Verifiable Agentic Web", Lunar.dev in-house risk scoring — position as *completing* them (behavioral + onchain proof), or as contrast.

## K) Wave-2 additions — segments the first pass missed

**New segment: agentic TPRM / GRC platforms (the cleanest new P0 pair — rows added to F and hot sheet #21–22).** Vanta (Agent for Risk, 6/02/26) and Drata (Agentic TPRM, RSA 2026) both shipped agents that auto-assess vendors including AI tools, with no behavioral evidence source. Polygraph grades = the citable artifact their assessment agents ingest.

**Hyperscaler agent catalogs (P1):** AWS Marketplace AI Agents & Tools upgraded (3,300+ listings — row in B). Microsoft Foundry: Add-Tools MCP catalog + managed MCP servers (preview 5/26), skills as versioned catalog items, cross-org marketplace explicitly not yet shipped — early conversation via Foundry PMs/devblogs (learn.microsoft.com/azure/foundry) — P1.

**Standards/credibility channels (P1, not revenue):**
- CoSAI (OASIS): published an MCP Security taxonomy 1/27/26; sponsors incl. Google, Microsoft, Meta, NVIDIA, PayPal, Snyk. Map litmus probe categories onto the taxonomy + contribute via Workstream 4 → citations + sponsor intros.
- MLCommons AILuminate Agentic + Global Assurance Program (2/26, KPMG/Google/Microsoft backing): building the "assurance program" category — litmus as an existing reproducible behavioral benchmark for their maturity ladder. Open working-group participation.
- **Thoughtworks Technology Radar already blips MCP-Scan and Snyk Agent Scan as MCP-vetting tools — getting litmus on the Radar is a concrete, reachable, high-leverage action** (thoughtworks.com/radar/tools/mcp-scan).

**Government guidance = marketing ammunition, not buyers:** Five Eyes "Careful Adoption of Agentic AI Services" (4/30/26, 100+ recommendations) and NSA AISC's MCP-specific CSI "Security Design Considerations for AI-Driven Automation" (5/20/26 — notes MCP auth optional, identity unverifiable). Pitch line: "the NSA says to do this; polygraph is the reproducible way to do it." ENISA/BSI have no agentic guidance yet; EU AI Act GPAI CoP is model-provider paperwork — deprioritize EU-regulated as a segment.

**MCP hosting (small, reachable):** Blaxel (YC; MCP Hub 100+ tools, 25ms boots — "every Hub tool graded A" differentiator) P1; Railway + Render one-click MCP templates (badge play) P2; Alpic (MCP cloud + ChatGPT-app submission agency — could resell pre-submission grading; note ChatGPT apps ARE MCP servers with 1–2wk manual review, so "pass-the-review pre-flight" is a service angle) P2.

**LLM observability = distribution surface, not buyers:** Langfuse has first-class MCP tracing and is OSS — a PR annotating traced MCP servers with polygraph grades is a free integration (P1 for distribution); W&B Weave, Arize Phoenix, Braintrust (CI-gate analog) P2.

**Checked and deprioritized with evidence:** RapidAPI (no first-party MCP marketplace), Marsh/Aon brokers (AI for their own workflows, don't buy tool-trust data), big consultancies (real need, enterprise cycle — P2 except the Thoughtworks Radar action), China (ModelScope MCP广场 CONFIRMED at 9,227+ services, largest Chinese MCP community — but China GTM + Base-chain proofs = P2), Bitsight/SecurityScorecard (rate companies not MCP servers; long-shot data partner).

**Competitive intel (track, don't pitch):**
- **Snyk agent-scan** (github.com/snyk/agent-scan): scans MCP servers/skills/agents *by running them* (built on acquired Invariant Labs); Vercel partner; CoSAI premier sponsor; on Thoughtworks Radar. Closest big-vendor analog to litmus. Differentiators to press everywhere: letter grade + reproducible **onchain** proof + live-fingerprint rug-pull recheck vs local scan reports.
- **Tencent AI-Infra-Guard**: open-source full-stack AI red-teaming (MCP/skill/agent scans, 4,000+ risks found) — competitor-adjacent, not a buyer.

## L) VERIFY-BEFORE-SEND ledger — RESOLVED (wave-2 verification, 7/16 late)

| # | Claim | Verdict |
|---|---|---|
| 1 | agentskill.sh "274,000+ skills" | REAL CLAIM, DUBIOUS NUMBER — internally inconsistent, unaudited scrape; don't cite |
| 2 | Cline "millions of developers" | CONFIRMED — 5M+ installs (1/26), 2.7M devs at raise |
| 3 | Kilo inherits Roo's 3M installs | CORRECTED — genuine fork, but Roo recommended Cline; both compete for the base |
| 4 | x402 75M txns / $24M per 30d | CONFIRMED (CoinDesk 7/15) — but disclose meme-farming caveat; clean Base ≈3.1M txns/30d |
| 5 | Vouch AI E&O incl. hallucinations | CONFIRMED — but launched Feb 2024, not new in 2026 |
| 6 | Lakera independent? | CORRECTED — Check Point acquisition agreed 9/16/25 (~$300M); products live |
| 7 | PulseMCP pitch path | CONFIRMED — **hello@pulsemcp.com**; sponsored/partnership content accepted with editorial disclosure; subscriber count unpublished |
| 8 | ModelScope MCP marketplace | CONFIRMED — 9,227+ MCP services (3/26), bigger than claimed |
| 9 | Cloudflare Monetization Gateway bylines | STILL VERIFY on-page before naming (from search snippet only) |
| 10 | Postman: Noah Schwartz owns MCP catalog | MEDIUM confidence — owns API Network broadly; re-verify title before naming |
| 11 | Ben's Bites ~$200 tier | STALE 2024 DATA — verify before spending |
