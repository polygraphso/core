---
title: "A weekly buyback, funded by monitoring"
date: "2026-07-14"
excerpt: "Monitoring is the revenue engine: ecosystem monitors and per-server trackers. We're committing a fixed share of that revenue to buy $POLYGRAPH back every week and lock it in the treasury."
unlisted: true
---

A while back we wrote about [why open-source safety work is hard to fund without bending it](/blog/open-source-needs-new-funding-mechanisms), and how the community-launched $POLYGRAPH token helps keep the public work free. This post is about the other side of the ledger: the revenue the products earn, and a commitment to send a share of it back into the token every week.

## Where the revenue comes from: monitoring

The public index is free to read. The paid layer is monitoring; that is the business. A grade is a snapshot of one version, and tools keep shipping, so the product is keeping that snapshot from going stale. It comes in two shapes.

**Ecosystem monitors** are for operators running a network of MCP servers, agents, and skills they don't fully control. We keep a continuous, reproducible trust index for the whole network: the harness re-runs on a cadence, and we compare each run against the last. When something moves (a grade drops, a probe starts failing, or the live tool surface no longer matches the graded fingerprint, which is what a rug pull looks like), the alert ships with the evidence attached. The team hears about a regression before its users do. We set it up per network.

**Individual trackers** are for anyone relying on a single server. Pick a server; when it publishes a new version, polygraph re-runs the behavioral litmus and emails the result. You get one email per new version and nothing in between, with a threshold so quiet servers stay quiet.

Both are early. But this is the revenue engine: continuous monitoring is the thing worth paying for, and it is what funds the work over the long run.

## The commitment

As that revenue comes in, a fixed share of it buys $POLYGRAPH on the open market every week and moves into a treasury we lock onchain.

This is a forward policy, not a report. We are stating it before the first buyback runs so the commitment itself is on record and checkable from day one. The exact share is **[X]% of gross revenue**, run **every [DAY]**, beginning **[START DATE]**. We will publish the treasury address, and after the first buyback the amount and the transaction are public. From that point on, the policy is something you audit rather than take our word for.

A share of gross means we buy whether the month was profitable or not, and because we are early, the buybacks start small and grow with the monitoring revenue. That is the point of fixing the rule now: the size scales with the business, and the rule doesn't move.

## Why buy-and-lock, not burn or dump

We buy the token back and hold it, and we lock what we hold.

Locking is the part that matters. A treasury that merely *holds* tokens can quietly sell them; a treasury whose tokens are locked onchain cannot. We use [Sablier](https://sablier.com), a token-lockup protocol live on Base (the chain $POLYGRAPH trades on), to put the acquired tokens on a fixed release schedule that anyone can read. So "we hold it" stops being a promise and becomes a fact you can check.

The flow is one-directional: revenue → buy → lock. We are not routing tokens back out to anyone, and we are explicitly **not** using [glidepath](https://docs.bankr.bot/token-launching/glidepath) or any other sell mechanism. Glidepath is a sell schedule; it lets a builder exit an allocation gradually. This policy points the other way: steady buy-side demand for the token, funded by what the monitoring products earn, locked so the project can't cash it out.

## How you'll verify it

None of this asks for trust. The buyback swaps are onchain, the lock is onchain, and the treasury address is published. The two claims that matter are that we actually buy and that we don't quietly sell, and you confirm both by reading the chain, not by reading us. The transactions are public, so a false buyback claim would be as falsifiable as anything else we publish.

## What this is not

This is not financial advice, and it is not a promise of returns to anyone holding the token. There is no payout and no yield, and none of this should set a price expectation. The commitment is narrow: every week, a share of what the monitoring earns goes back into the token that funds the work, and it stays locked there.

You can see $POLYGRAPH [on Bankr](https://bankr.bot/discover/0x2878cfc54aabdadd9bb5d70dd24d6b91485afba3), and if you run a network worth watching, you can [monitor your ecosystem](/ecosystems).
