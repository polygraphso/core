---
title: "State of MCP Security #1: what running the top 100 MCP servers actually shows"
date: "2026-07-06"
excerpt: "As of July 2026, we ran an open behavioral harness against every one of the 100 most-adopted MCP servers. Here's what came back — including the servers we couldn't grade and the grades we got wrong along the way."
---

**As of early July 2026.** We ran an open behavioral harness against every one of the 100 most-adopted MCP servers. Here is what came back — including the servers we couldn't grade, the grades we got wrong along the way, and what an "A" does and doesn't mean.

## The corpus

The universe is the 110 most-adopted MCP servers we track; how we assemble that list is the next section. This edition reports on the top 100 of them, all run against the harness. The outcomes:

- **58 of the top 100 carry a published grade: 57 A, 1 D.** Of the top 50 by adoption, 36 are graded.
- **The other ~42 mostly cannot be graded from a bare package ref** — the harness launches a server exactly the way an agent's config would, and these fail to boot without credentials or extra arguments (a Supabase access token, a Slack bot token, a database connection string), or turn out not to be standalone MCP servers at all. Their rows say so; "ungradeable" is a disclosed state, not a blank, and the set shrinks as we learn to boot more of them.

Separately from the registry corpus: **13 remote (`https://`) MCP endpoints carry published grades — all B.** That is a ceiling, not a score: a remote server's code can change server-side at any moment after grading, so the methodology caps what a point-in-time run can honestly claim. The tool-surface fingerprint published with each grade is the tripwire — if the server's tools change after grading, the recheck fails and the grade no longer applies.

## Where the list comes from

MCP has no central download counter, so there is no off-the-shelf "top 100" to pull down and grade. We assemble the ranking ourselves: a daily pipeline scores every server we track on the signals that actually exist — npm and PyPI download counts, GitHub activity, OpenSSF scorecards, and presence in the Glama and Smithery registries — and orders them by adoption. Adoption decides only *what we test and in what order*; it is never part of a grade.

That tracked set is a curated seed we grow deliberately, not a scrape of every package with "mcp" in its name (there are tens of thousands of those, most of them empty shells, forks, or abandoned experiments). It stands at 110 today and climbs every week. So read "top 100 most-adopted" as a working sample of what people actually install, not a census of the ecosystem.

One thing then holds the *graded* count below the *tracked* count: roughly 42 of the top 100 will not boot from a bare ref (below), mostly the big credential-gated names. That is the honest coverage line — a floor we report openly, not a ceiling we hide behind. This is edition #1; the number climbs from here.

## Reading "57 A · 1 D" honestly

Two things should make a reader suspicious of a clean distribution, and both deserve daylight.

First, survivorship: the ~42% that wouldn't boot includes most of the big credential-gated names. The published distribution describes the servers that *can* be exercised from a bare ref — a real and growing set, but not the whole ecosystem.

Second, and more telling, our own error rate — because the most interesting thing that happened while assembling this edition was catching one of our own false positives. Re-running the whole set on the current methodology, two well-known servers came back D on a check they should have passed: `@mcpdotdirect/evm-mcp-server` and `@adeu/mcp-server`. Both were doing the *right* thing — safely rejecting a jailbreak we fed their tools, then quoting the rejected input back in an error message — and the harness mis-read that echo as the server *amplifying* the attack. So we stopped, fixed the adversarial-input check so a rejection-frame echo no longer trips it, shipped it as **litmus-v14**, and both servers moved D→A. It's the fifth such fix in the series: Playwright's MCP server and raven-mcp moved F→A under v7 when it stopped mis-reading instruction-like documentation; `mcp-server-fetch` and `armor-mcp` moved D→A under v12. We publish these corrections rather than quietly replacing rows — a rating whose failure modes are hidden is not a measurement.

The fix cut the false positive without touching the real findings. The one published D, `@wildcard-ai/deepcontext`, survived the re-run: it genuinely crashes on malformed input (a different adversarial-input failure, not an echo), and it has graded D consistently from v7 through v14. We also held a grade back rather than publish it: the official `@modelcontextprotocol/server-everything` reference server trips the data-leak check because its demo `get-env` tool returns the environment by design — a debatable case on a server built to showcase features, not one we're comfortable publishing as an F.

Skills are a separate, static corpus (a byte-scan, not behavioral proof): of the 107 skills in the BankrBot library, 106 grade A and one grades D for a real finding — a bundled `curl | sh` installer.

## What an A means — and what it doesn't

An A means: exercised through its own tool surface, the server showed no tool-output injection (including second-order), no undeclared network egress from a default-deny sandbox, clean handling of planted sensitive data, and no crash/leak/amplification under adversarial input — on the graded version, on the run date, under the published methodology.

It does not mean "safe." A server can detect a test context and behave (the disclosed residual limit of any dynamic analysis); a maintainer can ship a different version tomorrow (that is what the version pin and fingerprint are for); and the harness only measures the four categories it measures. The honest claim is narrower and, we think, more useful: **the grade is reproducible.** Every report page carries the one-command re-run; a wrong grade is falsifiable by anyone, including the graded server's author.

## What's next

The corpus grows in adoption order, and re-grades follow version changes. If you maintain a graded server, the report page has your badge and your full findings — free, no account. If you run an ecosystem whose users install these things — a registry, a marketplace, an agent platform — continuous monitoring of your surface is the service we sell; the index you are reading is the free, public layer.

The data: [the index](/rankings) · [the methodology](/methodology) · [the open harness](https://github.com/polygraphso/litmus).
