# Outreach — Base / x402 Bazaar

- **To**: Coinbase CDP / x402 team. Channels, in order: x402 Foundation contact via
  docs.cdp.coinbase.com; Base Discord (dev channels); @jessepollak on X for amplification
  once something is live (not for the first ask).
- **Prerequisite**: strongest sent *after* the Bankr/x402 Cloud engagement (see
  `bankr.md`) produces a working gate-before-payment demo — that demo is the pitch.
  `/base` index is already live: https://polygraph.so/base
- **Status**: draft, not sent.

---

**Subject:** A trust check an agent can run before paying an x402 endpoint

Hi —

We run polygraph.so, an open behavioral harness for MCP servers, and our proof layer is
already on your stack: every published grade is an EAS attestation on Base, pinned to a
sha256 fingerprint of the server's live tool surface.

The problem we think we solve for the Bazaar: discovery currently steers agents by
activity-derived trust signals, and two papers this year ("Five Attacks on x402",
"Free-Riding the Agentic Web") showed the discovery layer can route an agent to an
adversarial resource server before payment even begins. Activity signals say a server is
*used*; they don't say what it *does*.

What exists today, no integration required: the open harness ships a gate function — an
agent about to pay reads the attestation on Base, rechecks the live tool-surface
fingerprint (so a server that changed after grading fails closed), and by default only a
local A grade clears payment-class actions. We've been grading the Base MCP ecosystem
already: https://polygraph.so/base — and we run this live on {BANKR_DEMO_URL}.

To be precise: a grade is a measurement, not a guarantee — point-in-time, version-pinned,
limits disclosed on every report. The fingerprint recheck is what makes it usable at pay
time anyway: staleness fails closed.

The ask: a conversation about the Bazaar surfacing behavioral grades as a trust signal
alongside the onchain-activity ones. Everything on our side is open and reproducible, so
your team can re-run any grade before trusting it.

Rúben
polygraph.so — harness: github.com/polygraphso/litmus · attestations: EAS on Base

---

**Follow-up (+5 business days):** one paragraph; the strongest bump is a new graded
endpoint in the Bazaar's top listings or the Bankr demo shipping.
