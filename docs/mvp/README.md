# docs/ — Litmus MVP + Onchain Proof

Specification and planning for polygraph's first behavioral **litmus test** and its **onchain proof**, targeted at the **Base × Privy NYC Hackathon** (theme: *x402, agentic commerce, stablecoins*).

**Status: specification.** These are the docs the build is driven from. No implementation has shipped against them yet — the litmus harness and all onchain code are still unbuilt (today's grades are metadata-only *adoption* scoring in `packages/scoring`). Implementation is a separate phase.

**The thesis in one line:** *Polygraph is the trust layer for agentic commerce — an agent shouldn't pay an MCP server (x402, in USDC) that hasn't passed an onchain litmus test.*

## The four documents

| Doc | Owns | Read it for |
|---|---|---|
| [`hackathon-pitch.md`](./hackathon-pitch.md) | the narrative + demo | fastest context: pitch, bounty fit, 3-min demo runbook, tradeoff & roadmap |
| [`litmus-test-v1.md`](./litmus-test-v1.md) | **the methodology** (`litmus-v1`) | what we measure: categories C-01/C-02/C-03, the 5 probes, scanners, A–F grading, reproducibility contract |
| [`onchain-proof-spec.md`](./onchain-proof-spec.md) | **the EAS schema + evidence-bundle shape + trust model** | the proof format: bundle JSON, attestation schema, addresses, IPFS, the trust-model spectrum (forgeability fixes), and the re-run-to-verify protocol |
| [`technical-design.md`](./technical-design.md) | **the package layout + build sequence** | how to build it: harness internals, Docker egress fallback ladder, 7-day plan, reuse map, verification |

**Reading order** — for context, start with the pitch. To build: `litmus-test-v1` → `onchain-proof-spec` → `technical-design`.

**How it works** — [`how-it-works.md`](./how-it-works.md) is a diagram-driven walkthrough of the methodology and harness (rendered Mermaid: end-to-end flow, harness ↔ server, the probe map, grading, trust model, agent-gate).

**Pitch deck** — [`deck.html`](./deck.html) is a self-contained 10-slide presentation of the idea (open it in a browser; press `P` to export a PDF).

## Source-of-truth & consistency rules

- `litmus-test-v1.md` is the authoritative, self-contained methodology spec. (This doc set is standalone — it does not modify or sync with any existing repo doc.)
- The EAS schema and evidence-bundle shape are defined **once** in `onchain-proof-spec.md`; the other docs reference it.
- `methodologyVersion: "litmus-v1"` and the probe IDs (1.1, 1.2, 2.2, 4.1, 4.2) are identical across every doc.
- Facts not yet confirmed (SDK versions, Base mainnet USDC address, Next 16 specifics) are tagged **`[verify]`** — resolve at install time.

## Locked decisions (carried into every doc)

Self-run + self-mint with open methodology (independence knowingly traded for v1; trust anchored by reproducibility **plus a built-in USDC challenge bond** — `onchain-proof-spec.md` §9; forgeability vs evasion treated in `litmus-test-v1.md` §7) · all three v1 probe categories with Docker-gated C-02 graceful degradation, run in a **hardened sandbox** · EAS attestation on Base + evidence on IPFS · agent-gate enforces a **live-fingerprint check** · CLI runs locally → Privy web mint **+ USDC bond stake** · build on Base Sepolia, demo on Base mainnet.

Voice: serious, plain, "scientific preprint" — never web3-hype. See `../../CLAUDE.md`.
