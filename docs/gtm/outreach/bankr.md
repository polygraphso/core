# Outreach — Bankr / x402 Cloud

- **To**: Bankr team — X @bankrbot *(handle unverified — confirm before sending)*, or
  their Discord/Telegram dev channel. This is a warm-ish start: the `/bankr` index is
  already live with their skills and agents graded.
- **Prerequisite**: none to open the conversation. To make the full ask, grade whatever
  x402 Cloud endpoints are publicly enumerable first (`target-servers.md`).
- **Status**: draft, not sent.

---

**Subject:** Your skill library is already graded — proposal for x402 Cloud

Hi —

We run polygraph.so. You may have seen it already: we grade the Bankr skill library and
the agents that ship their own MCP server, published at https://polygraph.so/bankr —
static safety grades for the skills, behavioral grades for the MCP surfaces, each with
the full findings and a one-command re-run.

The proposal is about x402 Cloud. Builders monetize endpoints there, agents pay them in
USDC, and today an agent has no way to know what an endpoint does before the first paid
call. We'd like to close that: every endpoint listed on x402 Cloud gets a behavioral
grade before agents pay it, published as an EAS attestation on Base. The open harness
ships the matching gate — an agent checks the attestation and rechecks the live
tool-surface fingerprint before a payment-class call; by default only an A clears.

For you this is a marketable property of the platform — "endpoints here are graded before
agents pay them" — and it costs your builders nothing: grades are free and nobody can pay
for one, so the signal stays independent. To be precise about the claim: a grade is a
measurement, not a guarantee; it's version-pinned and the limits are disclosed on every
report. The fingerprint recheck fails closed if an endpoint changes after grading.

If useful, the first step is small: we grade the currently-listed endpoints and you link
the index. Interested?

Rúben
polygraph.so — harness: github.com/polygraphso/litmus

---

**Note for us**: this engagement doubles as the live gate-before-payment demo the
Base/x402 pitch needs. Prioritize shipping it even at zero revenue.
