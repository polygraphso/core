---
title: "Nobody can pay for a grade"
date: "2026-07-16"
excerpt: "The paid layer changes what we watch and how often. It never changes the letter. How the business is built so a grade can't be bought, and what backs that beyond a promise."
unlisted: true
---

Every rating system eventually answers the same question: who pays the rater, and what does the money buy? Credit ratings went issuer-pays and the 2008 post-mortems are still being written. Review platforms sell visibility and get gamed by volume. Certification labs drift toward the vendors that fund their renewals. When we started publishing behavioral grades for MCP servers, we had to decide where money could touch the system and where it could not. This post writes that boundary down.

## What is for sale

Monitoring. A grade is a snapshot of one version, and tools keep shipping, so the paid product is keeping the snapshot from going stale: [ecosystem monitors](/ecosystems) that re-grade a network's servers and skills on a cadence, and per-server trackers that re-run the litmus when a new version publishes. We wrote about the revenue side, and the weekly buyback it funds, in [a separate post](/blog/weekly-buyback).

A subscription changes three things: what we watch, how often we re-run, and where the alerts go. That is the whole product.

## What is never for sale

The letter. No graded party gets review or approval rights over their result. There is no fee to be graded and no fee to make a bad grade go away; the [request queue](/request) is free and demand moves it, not payment. A monitoring client can pay us to test their network more often, and every grade that produces comes out of the same open harness and publishes the same way as everyone else's. Paying buys more measurements, never better ones.

The same rule covers the fix path. A non-A grade links to [concrete remediation steps](/fix), free, and the way to clear a grade is to change the code and re-run the test. There is no expedited review to purchase because there is no review: there is a harness, and it says what it observed.

## Why this holds without trusting us

A policy is a promise, and promises are cheap. The reason the boundary holds is mechanical: the harness is open source and deterministic. Anyone can re-run it against the same server and compare letters. A purchased grade would have to survive every independent re-run of a public test, which makes it a uniquely bad product to sell; the first person to check would have the receipts.

The published side is equally hard to quietly revise. A grade ships as an onchain attestation with its evidence bundle pinned to IPFS, dated and versioned, and it is bound to a sha256 fingerprint of the exact tool surface tested. We cannot edit a grade after the fact any more than a graded server can swap its tools without the fingerprint going stale.

## Where the money actually goes

The free public index is funded the way we described in [the funding post](/blog/open-source-needs-new-funding-mechanisms): the community-launched $POLYGRAPH token, whose dev fees fund the work. We disclose the Bankr relationship behind that launch. Monitoring revenue is the earned side, and a fixed share of it buys the token back weekly and locks it onchain. None of those flows touch grading: the people who pay us are paying for cadence and coverage, and the instrument does not know who they are.

## The trade-offs we disclose instead

Independence here is disclosure-based, not refusal-based. We do not refuse money; we publish exactly what it can and cannot buy, alongside the limits of the method itself: v1 grades are self-run and self-published, a remote endpoint caps at B because its egress cannot be sandboxed from outside, and an open methodology leaves a disclosed evasion risk. What backs the grade is not our neutrality as people. It is that a false letter, bought or mistaken, is disprovable by anyone with the harness and twenty minutes.

If you run a network of tools you did not write, [that is what monitoring is for](/ecosystems). If you just want to check one server before an agent trusts it, [the index is free](/mcp-index).
