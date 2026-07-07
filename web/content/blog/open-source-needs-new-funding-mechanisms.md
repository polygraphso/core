---
title: "Open source needs new funding mechanisms"
date: "2026-06-16"
excerpt: "Independent AI safety testing is hard to fund without bending the work. Polygraph is an experiment in open, community-funded safety infrastructure."
---

Open source is carrying more of the AI stack every week: agents, MCP servers, evals, safety tools, dev tooling, model wrappers, automation layers. A lot of the internet's next trust layer is being maintained by tiny teams, solo builders, and independent labs.

But the funding model still looks broken. Grants are slow. Sponsorships are fragile. VC pushes useful tools towards becoming for-profit ventures before the public-good layer is proven. And when the work is about trust, security, or AI safety, who funds it matters even more.

## Why this matters for AI

AI tools are moving from "vibe coded apps" into real workflows. They read private context, call APIs, install packages, and touch wallets. They connect to production systems, and make decisions faster than humans can inspect every step.

That means trust can't just come from brand, vibes, or screenshots. We need independent ways to test the tools we are starting to rely on.

The problem is that independent testing is expensive and tough to fund.

If the work depends on a big lab, it can become captured by the ecosystem it is supposed to grade. If it depends on grants, it moves at grant speed and may attract subsidy-dependent actors. If it depends on VC too early, the project may have to become a venture-scale company before the public-good layer is proven.

None of those models are evil, they just all bend the work in different directions. For open-source AI safety infrastructure, that is a big problem.

## The bigger experiment: open safety infrastructure

Polygraph is an independent open-source project that tests AI tools under adversarial conditions. We look for things like prompt hijacking, excessive permissions, unsafe actions, and data leaks, then publish simple A-F grades with evidence behind them. No graded party pays us. The polygraphs are public, and there is a CLI for fast checks.

That matters because open-source AI safety infrastructure has a trust problem.

If the people being graded pay for the grade, the result is easy to question. A project that lives only on grants or goodwill may not be sustainable. And closed tests cannot be inspected or challenged by the developers they grade.

Polygraph is our attempt at a different model: open tests, public evidence, simple grades, and a simple path to sustainability.

The team behind Polygraph is Talent Protocol. We have spent years building reputation systems for builders: turning projects, contributions, and verified signals into something people can trust. Polygraph applies that same instinct to the agentic web.

The product is still early, and the grading system has a lot to improve.

But the bigger question is this:

**Can independent open-source AI safety infrastructure become useful, credible, and sustainable in the long run?**

## When agents start interacting with a messy Internet

A simple example: an AI tool might look safe in a normal demo, but behave very differently when connected to private context and given a malicious instruction through a webpage, repo, document, or MCP server.

Maybe it leaks context it should not expose, or follows instructions from an untrusted source. Maybe it takes an action the user never intended, or hands another tool too much authority.

These are not abstract risks… So, the grading needs to be public enough to challenge, reproduce, and improve. That is why Polygraph needs to be open source.

## Bankr community steps in

[Bankr](https://bankr.bot) gives projects like Polygraph a way to test a different path: community-funded open source.

Instead of waiting for grants, chasing sponsors, or turning the whole thing into a venture-backed company too early, a project like Polygraph can receive support from the community around it, right from the start. If people believe independent AI tool testing should exist, they can support it directly.

The community has already created [$POLYGRAPH](https://bankr.bot/discover/0x2878cfc54aabdadd9bb5d70dd24d6b91485afba3). Polygraph is claiming dev fees from that community token to support the open-source project. That creates a funding loop closer to the people who actually want the work to exist, and that matters because open source usually has the opposite problem: a lot of people benefit, very few people pay, and maintainers are expected to keep going anyway.

However, Polygraph should not be trusted because it has a community around it. It should be trusted only if the tests are useful, the evidence is public, the methodology improves, and the grades hold up under scrutiny.

The community funding mechanism is there to help the work survive long enough to become credible.

## The cat and mouse game

The next step is to make Polygraph more useful and harder to fool. The roadmap is simple: grade more AI tools, publish more evidence-backed reports, improve the methodology, make checks easier to run from the CLI, and let builders request polygraphs for the tools they rely on.

If you care about independent AI safety infrastructure, don't just watch us shipping. Use Polygraph. Challenge the grades and submit AI tools that should be graded. And, suggest ways to make the methodology harder to fool.

If you want to support Polygraph's maintenance, join the [Polygraphers community on telegram](http://t.me/polygraphcommunity) and support [$POLYGRAPH](https://bankr.bot/discover/0x2878cfc54aabdadd9bb5d70dd24d6b91485afba3).
