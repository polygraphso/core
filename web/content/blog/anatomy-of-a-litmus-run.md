---
title: "Anatomy of a litmus run"
date: "2026-07-17"
excerpt: "What happens in the minute between pointing the harness at an MCP server and getting a letter: the fingerprint, nine probes across four behaviors, and the evidence that leaves the run."
unlisted: true
---

A grade should be boring to produce. You point the open harness at an MCP server (an npm or pypi ref, a GitHub repo, or a remote URL), wait somewhere between twenty seconds and a minute, and get a letter with an evidence bundle behind it. This post walks through what happens inside that minute, in the order it happens. The full specification lives on the [methodology page](/methodology); this is the guided tour.

## Connect like an agent

The harness speaks plain MCP. It launches a package target inside a sandbox (or dials a remote URL), performs the handshake any client would, and calls `tools/list`. Everything downstream works on what the server actually exposes at runtime, not on what its README or manifest claims.

## The fingerprint comes first

Before any probe runs, the harness computes the tool-surface fingerprint: for each tool it keeps `{name, description, inputSchema}`, sorts tools and keys, normalizes whitespace but keeps raw Unicode (a hidden-character trick still changes the hash), then serializes and takes a sha256. That hash travels with the grade forever.

This is the rug-pull defense. A grade describes one exact tool surface. If the server later ships different descriptions, the live fingerprint stops matching the attested one, and an agent that re-checks it (ours does) treats the grade as stale and refuses. A server cannot keep its A and swap its tools; changing the surface un-grades it automatically.

## C-01: does tool output try to hijack the caller?

Three probes. A static scan reads every name, description, and schema for injection planted in the tool surface itself. A battery of bait calls then exercises the tools and inspects what comes back for instructions aimed at the calling agent. Finally a second-order pass feeds one tool's output into another tool's input, the shape of real agent pipelines, and watches whether something activates on the way through. A verified injection is disqualifying: grade F.

## C-02: does it reach where it never said it would?

Two probes. The first checks honesty in metadata: a tool that declares itself read-only while its verb, parameters, and description say otherwise is claiming a permission profile it does not have. The second is the egress test: the server runs inside a default-deny network where every outbound connection resolves and connects but lands in a sinkhole that logs the host, port, and first bytes without completing the exchange. At the gateway, every outbound TCP packet is redirected to the sink regardless of DNS, so hard-coded IP literals and DoH or DoT to a fixed resolver are captured too.

One refinement keeps this fair: a server whose whole purpose is wrapping a disclosed API (a tool named `openai_chat` reaching `api.openai.com`) gets that upstream recorded as disclosed rather than counted as overreach. Undisclosed egress grades D.

## C-03: does planted data leak?

Before the probes run, the harness salts the environment with things worth stealing: a canary string keyed to that run, synthetic PII, a bearer token. None of it is real; all of it is traceable. Two scans then watch the two doors: does planted data surface in tool output where it does not belong, and does it surface inside captured egress? The canary is different every run, so there is no fixed string to learn and hide. A planted secret leaving through either door grades F.

## C-04: does hostile input break it?

Malformed and oversized inputs first: a server that crashes or dumps internals under garbage input fails. Then a jailbreak battery checks whether the server amplifies adversarial instructions passed through it. This category is graded off-chain and caps the letter at D; it moves the grade without occupying one of the attested category slots.

## The letter

The worst verified finding sets the grade, and the scale has a deliberate gap: A, B, D, F, with no C. An A means all four categories passed. A B means everything testable passed but the target was remote, so the egress probe was recorded as skipped, and a skip is not a pass. D is overreach or fragility; F is injection or a leak. There is no middle behavior to give a C to.

The harness also fails closed. If a server's tool surface keeps paginating past the bound the harness can attest, it refuses to grade rather than publish a clean letter over a partial surface.

## What leaves the run

A deterministic evidence bundle: every probe, every finding, the fingerprint, and the harness version. Published grades pin that bundle to IPFS and write an attestation on Base carrying the grade, the fingerprint, and the `methodologyVersion` (litmus-v14 as of this writing; older grades stay valid under their own version string). Anyone can fetch the evidence and re-run the same test.

## What a run does not prove

A grade is a dated, versioned observation of one version of one server. It does not claim the server is safe in general, and it cannot rule out a server that detects the test context and behaves only under observation; that evasion limit is disclosed in the spec, and the randomized canaries, per-run bait, re-runs on new versions, and the live fingerprint check are mitigations, not a cure.

To see it yourself, run one command against a server you depend on:

```
npx -y -p @polygraphso/litmus polygraphso-litmus litmus npm/@playwright/mcp
```

The harness is open at [github.com/polygraphso/litmus](https://github.com/polygraphso/litmus), and the self-serve tooling (CLI, GitHub Action, badges) lives on the [builders page](/builders).
