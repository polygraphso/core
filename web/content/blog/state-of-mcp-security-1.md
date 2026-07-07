---
title: "State of MCP Security #1: what running the top 100 MCP servers actually shows"
date: "2026-07-06"
excerpt: "As of July 2026, we ran an open behavioral harness across the most-adopted MCP servers. Here's what came back — the results, the mistakes we caught in our own harness, and an honest accounting of what we can't yet reach."
---

**As of early July 2026.** We ran an open behavioral harness across the most-adopted MCP servers we track. The short version: 119 carry a published grade, and all but two are an A. Here is the longer version — the results, the mistakes we caught in our own harness and fixed, what an "A" does and doesn't mean, and an honest accounting of the servers we can't yet reach.

## The corpus

We track the most-adopted MCP servers — 235 today — and grade every one we can actually launch. How we assemble that ranking is a later section. As of this edition the index carries **119 published grades**:

- **106 servers graded for behavior: 104 A, 2 D.** Of the top 50 by adoption, 25 carry a grade; of the top 100, 50 do.
- **13 remote (`https://`) MCP endpoints, all B.** That is a ceiling, not a score: a remote server's code can change server-side at any moment after grading, so the methodology caps what a point-in-time run can honestly claim. The published tool-surface fingerprint is the tripwire — if the server's tools change after grading, the recheck fails and the grade no longer applies.

## What the grades show

Across the 106 servers graded for behavior, the two findings we most look for did not appear once: **zero tool-output injection, zero leaks of planted canary data.** The worst verified finding sets the letter, and only two servers earned a D — `@wildcard-ai/deepcontext` and `@jpisnice/shadcn-ui-mcp-server`, both for genuinely crashing on malformed input, not for anything they leaked or did to the caller.

The most instructive thing that happened while assembling this edition was catching a false positive in our *own* harness. Re-running the whole set on the current methodology, two well-known servers came back D on a check they should have passed: `@mcpdotdirect/evm-mcp-server` and `@adeu/mcp-server`. Both were doing the right thing — safely rejecting a jailbreak we fed their tools, then quoting the rejected input back in an error message — and the harness mis-read that echo as the server *amplifying* the attack. So we stopped, fixed the adversarial-input check so a rejection-frame echo no longer trips it, shipped it as **litmus-v14**, and both moved D→A. It is the fifth such fix in the series: Playwright's MCP server and raven-mcp moved F→A under v7 when it stopped mis-reading instruction-like documentation; `mcp-server-fetch` and `armor-mcp` moved D→A under v12. We publish these corrections rather than quietly replacing rows — a rating whose failure modes are hidden is not a measurement.

The same discipline runs the other way. We held two grades *back* rather than publish a likely false positive: the official `@modelcontextprotocol/server-everything` reference server trips the data-leak check because its demo `get-env` tool returns the environment by design, and `it-tools-mcp` tripped the injection check only because its word-frequency counter faithfully counted the hostile words we fed it. Neither is a real finding, so neither is published — the same care that clears wrong D's applies to wrong F's.

Skills are a separate, static corpus (a byte-scan, not behavioral proof): of the 107 skills in the BankrBot library, 106 grade A and one grades D for a real finding — a bundled `curl | sh` installer.

## What an A means

An A means: exercised through its own tool surface, the server showed no tool-output injection (including second-order), no undeclared network egress from a default-deny sandbox, clean handling of planted sensitive data, and no crash/leak/amplification under adversarial input — on the graded version, on the run date, under the published methodology. Every report page carries the one-command re-run, so the result is **reproducible**: a wrong grade is falsifiable by anyone, including the graded server's author.

## Where the list comes from

MCP has no central download counter, so there is no off-the-shelf "top 100" to pull down and grade. We assemble the ranking ourselves: a daily pipeline scores every server we track on the signals that actually exist — npm and PyPI download counts, GitHub activity, OpenSSF scorecards, and presence in the Glama and Smithery registries — and orders them by adoption. Adoption decides only *what we test and in what order*; it is never part of a grade.

That tracked set is a curated seed we grow deliberately, not a scrape of every package with "mcp" in its name (there are tens of thousands of those, most of them empty shells, forks, or abandoned experiments). It stands at 235 today and climbs every week. Read the ranking as a working sample of what people actually install, not a census of the ecosystem.

## The honest limitations

Two limits shape how much an almost-all-A distribution is worth, and we would rather state them than let a clean chart oversell.

**The most-adopted servers are the hardest to grade.** The harness launches a server exactly the way an agent's config would — from a bare package reference — and the biggest names refuse to boot without credentials. Supabase, GitHub, Slack, Notion, Stripe, the database and cloud connectors each need an API key, an OAuth token, or a connection string just to start. We won't fabricate those, so these servers show as **ungraded** — a disclosed state, explicitly *not* graded-and-safe. That is why only 50 of the top 100 carry a grade: the ceiling on coverage is authentication, not effort. The published set therefore skews toward servers that run without secrets — focused, self-contained tools that are simply easier to earn an A on than a sprawling cloud connector would be, so a clean distribution over *this* sample is not a clean bill of health for the ecosystem. Grading credential-gated servers, with test credentials supplied by their maintainers, is on the roadmap and the single biggest lever on coverage.

**And a grade does not mean "safe."** A server can detect a test context and behave (the disclosed residual limit of any dynamic analysis); a maintainer can ship a different version tomorrow (that is what the version pin and fingerprint are for); and the harness only measures the four categories it measures. The honest claim is narrower, and we think more useful: the grade is reproducible, and its limits are disclosed rather than hidden.

## What's next

The corpus grows in adoption order, and re-grades follow version changes. If you maintain a graded server, the report page has your badge and your full findings — free, no account.

**Run an ecosystem whose users install these things** — a registry, a marketplace, an agent platform, a wallet? The public index you're reading is the free, point-in-time layer. Continuous monitoring of *your* surface — every listed server and skill re-graded on a schedule, tool-surface drift caught the day it happens, a private dashboard, an alert channel — is what we operate for networks. [See how ecosystem monitoring works →](/ecosystems)

The data: [the index](/mcp-index) · [the methodology](/methodology) · [the open harness](https://github.com/polygraphso/litmus).
