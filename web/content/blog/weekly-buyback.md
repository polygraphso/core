---
title: "Monitoring is paid in the token"
date: "2026-07-10"
excerpt: "Ecosystem monitoring is a monthly subscription, priced in dollars, paid in $POLYGRAPH: a cancelable Sablier stream to a public treasury. Every subscription is a market buy the client makes, and the chain is the receipt."
unlisted: true
---

A while back we wrote about [why open-source safety work is hard to fund without bending it](/blog/open-source-needs-new-funding-mechanisms), and how the community-launched $POLYGRAPH token helps keep the public work free. This post is the other side of the ledger: what the paid product earns, and what that does for the token. We first drafted this as a weekly buyback policy. We ended up building something simpler, so this is the updated version.

## Where the revenue comes from: monitoring

The public index is free to read. The paid layer is monitoring; that is the business. A grade is a snapshot of one version, and tools keep shipping, so the product is keeping that snapshot from going stale.

**Ecosystem monitoring** is for operators running a network of MCP servers, agents, and skills they don't fully control. We keep a continuous, reproducible trust index for the whole network: the harness re-runs on a cadence, and we compare each run against the last. When something moves (a grade drops, a probe starts failing, or the live tool surface no longer matches the graded fingerprint, which is what a rug pull looks like), the alert ships with the evidence attached. The team hears about a regression before its users do.

## How it's paid

An ecosystem's subscription is priced in dollars and paid in $POLYGRAPH.

Concretely: the client streams a month's price worth of the token to the polygraph treasury, using [Sablier](https://sablier.com), a token-streaming protocol live on Base, the chain $POLYGRAPH trades on. The stream is cancelable at any time. Cancel it and the unstreamed remainder returns to the payer's wallet, and monitoring stops. Nobody's tokens are held hostage, and nobody pays for a service they stopped wanting. Monitoring runs exactly as long as the stream does.

The treasury is [polygraph.base.eth](https://basescan.org/address/0xa31f8Bcbde4deB0dcD7f7252e5478505a9930b5d). Every stream into it is public. The activation page includes a swap, so a client can arrive holding ETH, USDC, or anything else on a major chain, convert to $POLYGRAPH, and start the stream in one sitting, with no account.

## What this does for the token

We originally planned a weekly buyback: a fixed share of gross monitoring revenue would buy $POLYGRAPH on the open market every week and move into a locked treasury. Paying in the token absorbs that design into the product itself.

Every subscription is a market buy, made by the client at the moment they convert into $POLYGRAPH to pay. There is no weekly conversion step for us to run or skip, because the revenue arrives already in the token. Demand for $POLYGRAPH becomes a direct function of monitoring adoption: priced in dollars, a subscription buys more tokens when the price is low and fewer when it is high, and it repeats monthly for as long as the client stays.

What the treasury receives, it holds. The flow is one-directional: subscribe, stream, hold. We are not routing tokens back out to anyone, and we are explicitly **not** using [glidepath](https://docs.bankr.bot/token-launching/glidepath) or any other sell mechanism. Glidepath is a sell schedule; it lets a builder exit an allocation gradually. This points the other way: steady, adoption-driven buy pressure, and a treasury that accumulates.

## How you'll verify it

None of this asks for trust. The streams are onchain, the treasury address is public, and Sablier's contracts are readable by anyone. The claims that matter are that clients actually pay and that we don't quietly sell, and you confirm both by reading the chain, not by reading us. A false claim here would be as falsifiable as anything else we publish.

## The line the token never crosses

Paying in $POLYGRAPH buys monitoring: how often we re-run the test and who gets alerted. It never buys a letter. A monitored ecosystem's grades are produced by the same open harness as everyone else's, and they are exactly as reproducible and as disprovable. An engagement changes what we re-grade and how often, never what we publish. If the token and a grade ever pointed in different directions, the grade wins, and the open harness is how you'd catch us if it didn't.

## What this is not

This is not financial advice, and it is not a promise of returns to anyone holding the token. There is no payout and no yield, and none of this should set a price expectation. The mechanism is narrow: monitoring is the business, the business is paid in the token, and what the treasury receives stays put.

You can see $POLYGRAPH [on Bankr](https://bankr.bot/discover/0x2878cfc54aabdadd9bb5d70dd24d6b91485afba3), and if you run a network worth watching, you can [monitor your ecosystem](/ecosystems).
