---
title: "State of MCP Security #1: what running the top 91 MCP servers actually shows"
date: "2026-07-06"
excerpt: "We ran an open behavioral harness against every one of the 91 most-adopted MCP servers. Here's what came back — including the servers we couldn't grade and the grades we got wrong along the way."
---

We ran an open behavioral harness against every one of the 91 most-adopted MCP servers. Here is what came back — including the servers we couldn't grade, the grades we got wrong along the way, and what an "A" does and doesn't mean.

## The corpus

The universe is the 91 most-adopted MCP servers, ordered by a daily adoption pipeline (npm and PyPI downloads, GitHub signals). Adoption decides only *what we test and in what order* — it is never part of a grade. As of this edition, all 91 have been run against the harness. The outcomes:

- **51 of the 91 (56%) carry a published grade: 50 A, 1 D.** Of the top 50 by adoption, 36 are graded.
- **The other 40 (44%) mostly cannot be graded from a bare package ref** — the harness launches a server exactly the way an agent's config would, and these fail to boot without credentials or extra arguments (a Supabase access token, a Slack bot token, a database connection string), or turn out not to be standalone MCP servers at all. Their rows say so; "ungradeable" is a disclosed state, not a blank, and the set shrinks as we learn to boot more of them.

Separately from the registry corpus: **13 remote (`https://`) MCP endpoints carry published grades — all B.** That is a ceiling, not a score: a remote server's code can change server-side at any moment after grading, so the methodology caps what a point-in-time run can honestly claim. The tool-surface fingerprint published with each grade is the tripwire — if the server's tools change after grading, the recheck fails and the grade no longer applies.

## Reading "50 A · 1 D" honestly

Two things should make a reader suspicious of a clean distribution, and both deserve daylight.

First, survivorship: the 44% that wouldn't boot includes most of the big credential-gated names. The published distribution describes the servers that *can* be exercised from a bare ref — a real and growing set, but not yet the whole ecosystem.

Second, our own error rate. Five methodology revisions in five weeks (litmus-v7 through v12) were false-positive fixes, and several well-known servers were published at D or F under earlier revisions before harness fixes corrected them: Playwright's MCP server and raven-mcp both moved F→A when v7 stopped mis-reading instruction-like documentation; `mcp-server-fetch` and `armor-mcp` moved D→A under v12 fixes to echo-detection and negation handling. We publish these corrections rather than quietly replacing rows, because a rating whose failure modes are hidden is not a measurement. Every revision is in the methodology changelog, and every affected cohort was re-graded.

The one current D is `npm/@wildcard-ai/deepcontext`, for adversarial-input handling (C-04): under malformed input the server leaked internals rather than failing cleanly. Because that row dated from litmus-v7 — and two of the five revisions since were C-04 false-positive fixes — we re-ran it on litmus-v12 before publishing this edition: **the D reproduced**, same version, same finding. That is the discipline working in both directions: fixes clear wrong grades, re-runs confirm right ones.

Skills are a separate, static corpus (a byte-scan, not behavioral proof): of the 107 skills in the BankrBot library, 106 grade A and one grades D for a real finding — a bundled `curl | sh` installer.

## What an A means — and what it doesn't

An A means: exercised through its own tool surface, the server showed no tool-output injection (including second-order), no undeclared network egress from a default-deny sandbox, clean handling of planted sensitive data, and no crash/leak/amplification under adversarial input — on the graded version, on the run date, under the published methodology.

It does not mean "safe." A server can detect a test context and behave (the disclosed residual limit of any dynamic analysis); a maintainer can ship a different version tomorrow (that is what the version pin and fingerprint are for); and the harness only measures the four categories it measures. The honest claim is narrower and, we think, more useful: **the grade is reproducible.** Every report page carries the one-command re-run; a wrong grade is falsifiable by anyone, including the graded server's author.

## What's next

The corpus grows in adoption order, and re-grades follow version changes. If you maintain a graded server, the report page has your badge and your full findings — free, no account. If you run an ecosystem whose users install these things — a registry, a marketplace, an agent platform — continuous monitoring of your surface is the service we sell; the index you are reading is the free, public layer.

The data: [the index](/rankings) · [the methodology](/methodology) · [the open harness](https://github.com/polygraphso/litmus).
