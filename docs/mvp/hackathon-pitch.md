# Hackathon Pitch & Demo Runbook — Base × Privy NYC

**Event:** Base × Privy NYC Hackathon @ Coinbase NYC · Theme: *x402, agentic commerce, stablecoins* · Sponsors: Base + Privy · USDC prizes · one-day (hack from noon, demos at 5pm).

Companions: [`litmus-test-v1.md`](./litmus-test-v1.md), [`technical-design.md`](./technical-design.md), [`onchain-proof-spec.md`](./onchain-proof-spec.md).

---

## 1. The pitch

**One line:** *Polygraph is the trust layer for agentic commerce — agents shouldn't pay an MCP server that hasn't passed an onchain litmus test.*

**Thirty seconds:** In agentic commerce, AI agents call and pay tools (MCP servers) autonomously — over x402, in USDC. But a tool an agent pays and feeds data to can hijack it, phone home, or steal its data and keys. Today there's no trust signal at the moment of payment. Polygraph runs a behavioral *litmus test* on an MCP server — does it try to hijack the caller, does it phone home, does it leak planted data — and publishes the result as an **onchain attestation on Base**, with the full evidence on IPFS. An agent reads that attestation before it pays. Pass → it pays in USDC over x402. Fail → it keeps its money. The whole thing is self-run and reproducible — anyone can re-run the open harness and check the proof — and the minter stakes a **USDC bond** they lose if they lied.

**Why it belongs at *this* event:** it's not a trust badge bolted onto a crypto demo — the proof exists *to gate a stablecoin payment between an agent and a tool*. That's the theme, end to end.

---

## 2. Theme & bounty fit

| Sponsor / theme | How we use it |
|---|---|
| **x402** | The agent pays the MCP's tool over HTTP 402; the polygraph attestation is the gate that decides whether the 402 gets paid. |
| **Stablecoins / USDC** | Payments settle in USDC on Base, and the **challenge bond** is staked + slashed in USDC — the economic trust anchor, not just the payment rail. |
| **Privy** | The mint flow uses a Privy embedded wallet — the subject signs the EAS attestation **and stakes the USDC bond** with zero seed-phrase friction. Smooth onboarding from a CLI hand-off to a web mint. |
| **Base** | Everything onchain lives on Base — the EAS attestation, the USDC payment, the agent's reads. Built on Sepolia, demoed on mainnet. |
| **Agentic commerce** | The end-to-end actor is an autonomous agent making a pay/refuse decision about a tool, not a human clicking buttons. |

---

## 3. Application blurb (drop-in)

> **Polygraph — the trust layer for agentic commerce.** Agents increasingly call and pay MCP-server tools over x402 in USDC. We run a behavioral litmus test on an MCP server — checking whether it tries to hijack the calling agent, phones home, or leaks planted data — and publish the result as an EAS attestation on Base, with full evidence on IPFS. An agent reads the attestation before paying: it pays verified servers over x402 and refuses the ones that fail. The harness is open and self-run, so the proof is reproducible — anyone can re-run it and check. Demo: an agent pays a clean MCP in USDC and refuses a malicious one that tries to hijack it, gated entirely by an onchain polygraph proof.

(Keep the voice plain and exact — no "revolutionize," no "AI safety" framing. See `core/CLAUDE.md`.)

---

## 4. Three-minute live demo runbook

**Setup before you present:** `web` deployed (or local + tunnel) on the demo network; agent wallet funded; a known-good MCP ref chosen; **fixtures ready** (pre-pinned CID + pre-minted attestation + pre-staked bond) in case the network flakes.

| # | You do | Audience sees | The point |
|---|---|---|---|
| 1 | `npx polygraphso litmus <good-ref>` | `→ C-01 pass · C-02 pass · C-03 pass` → `→ grade: A`, a fingerprint, an IPFS CID, and a mint link | The test is real, runs on *my* laptop, and emits published evidence. |
| 2 | Open the mint link → Privy login → **Attest + stake bond** | Privy embedded wallet; the EAS attestation at `base.easscan.org/attestation/view/<uid>` (decoded grade, fingerprint, CID) **and a USDC bond staked against it** | The proof is onchain on Base, signed via Privy — and the minter has money riding on it being true. |
| 3 | `pnpm --filter demo-agent tsx src/index.ts` | Two lines: **good MCP → reads grade A → pays USDC over x402 → gets the answer** (show the tx on basescan); **evil MCP → reads grade F (C-01) → refuses, 0 USDC spent** | The proof *gates a real stablecoin payment*. An agent trusts the evidence, not a star rating. |

**Closing line:** *"Self-run, open methodology, evidence on IPFS, proof on Base — and the agent trusts the evidence, not us. That's the trust layer agentic commerce is missing."*

**Optional 30-second beat (if time):** challenge a planted bad grade — `polygraphso challenge <uid>` → `/challenge` counter-stake → `resolve` → the stake is **slashed** and the attestation flips to *revoked* on easscan. Shows the economic teeth. (Use a short challenge window on the demo deployment, or present it from a pre-staged tx.)

### Stage fallbacks (so it never hard-blocks)
- **Network flake on mint/read:** use the pre-minted **fixture attestation**; the agent reads its UID. Have a **screen-recording** of the full flow as the ultimate backup.
- **Mainnet jitter:** stay on **Base Sepolia** (test USDC) unless the mainnet dry-run was clean. The story is identical; only the explorer domain changes.
- **x402 wiring rough:** fall back to `x402-next` + `x402-fetch` (see [`technical-design.md`](./technical-design.md) §6).
- **Docker absent on the demo machine:** C-02 shows `skipped` and the grade is **B** — the evil MCP still fails on **C-01**, so the pay/refuse contrast still lands.

---

## 5. Anticipated judge questions

- **"What stops me minting an A for my own malicious server?"** — Three layers. (1) The grade binds to a **fingerprint of your exact tool surface**, and the agent re-checks the *live* fingerprint before paying — so you can't pass clean and then serve something malicious (rug pull). (2) The evidence is on IPFS and the harness is open, so any grade is **falsifiable** — anyone re-runs it and the lie collapses. (3) The MVP stakes a **USDC bond** against every grade, slashed on a disproven re-run — so a fake A *costs you money*. What none of this fully closes is a server that detects the test and behaves (evasion); we say so plainly.
- **"Why onchain at all?"** — Because the consumer is an agent making an autonomous payment decision; it needs a portable, tamper-evident signal it can read at transaction time without trusting our server. The attestation is that signal, and it's revocable when a server rug-pulls.
- **"Why MCP?"** — MCP servers are the tools agents actually call and (increasingly) pay. They're the attack surface for agentic commerce.

---

## 6. Honest tradeoff & roadmap

**The v1 tradeoff, stated plainly:** v1 is self-run and self-minted — the subject grades itself. Polygraph's larger thesis is *independent* evaluation, so v1 leans on **reproducibility** (open harness + fingerprint + published evidence) rather than independence. A v1 grade is a "reproducible self-test," not an "independent verdict." We don't dress it up as more.

Two separable problems decide whether that's good enough (full treatment in [`onchain-proof-spec.md`](./onchain-proof-spec.md) §1 and [`litmus-test-v1.md`](./litmus-test-v1.md) §7):

- **Forgeability** — can the minter fake it? *Fixable* without giving up self-run/self-mint. The MVP ships the cheap, on-theme fix: a **USDC challenge bond** (stake at mint, slashed on a disproven re-run; `PolygraphBond` — [`onchain-proof-spec.md`](./onchain-proof-spec.md) §9, built Day 5). The cryptographic fixes — **zkTLS** (remote servers) and **TEE** (any server) — are the upgrade path.
- **Evasion** — can the server detect the test and behave, then misbehave in production? A *fundamental* limit of any open test (an independent lab has it too). Mitigated by randomized canaries, behavioral probing, expiring grades, continuous re-checks, and the live-fingerprint gate — **acknowledged, not eliminated**.

**Built in the MVP:** the open harness, the onchain proof, the live-fingerprint gate, the agent that acts on it, **and the USDC challenge bond** — skin-in-the-game so a false grade costs the minter.

**Roadmap (toward full independence):**
1. **Decentralize the bond's adjudication** — replace the trusted `arbiter` (centralized in v1) with optimistic escalation to a court (Kleros-style) or a TEE re-run oracle the contract verifies.
2. **Lab counter-attestation** — polygraph (the independent lab) co-signs: a two-tier *self-attested* vs *lab-verified* surface that reconciles this path with the core product.
3. **zkTLS / TEE proof-of-execution** — the runner produces an unforgeable proof the harness ran against the real server, so a self-run result is honest without anyone re-running it.
