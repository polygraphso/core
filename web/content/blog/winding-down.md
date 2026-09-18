---
title: "Winding down"
date: "2026-09-15"
excerpt: "polygraph development and support end on September 30, 2026. Nothing new gets graded, everything already published stays where it is, and the harness that produced it stays public and re-runnable. What stops, what doesn't, and why."
---

**polygraph development and support end on September 30, 2026.** After that date nothing new gets graded and nothing gets re-graded. The site stays up, every published grade stays exactly where it is, and the open harness stays available, so those grades stay re-runnable by anyone who wants to check them.

## What has already stopped

Hosted grading went off on September 15. Every endpoint that could enqueue a run — the free request queue, the priority path, the CLI and MCP request tools — now returns `410 Gone` and points at the open harness instead. Nothing in flight was charged for work that will not happen: settlement was always deferred until a run actually landed, so an unfinished run voids rather than settles.

If you have an active monitoring engagement, it ends on September 30, and you should cancel any recurring payment for it on your side.

## What stops on September 30

- **Monitoring and re-grades.** The ecosystem indexes stop refreshing. What stands on them is their last run.
- **Alerts.** No more regression or fingerprint-drift notifications.
- **The grading infrastructure.** The runner and the VPS it ran on come down.

## What stays

**The site and every published grade.** Every report page, every probe-level result, every evidence bundle, and the correction history stay readable at the same URLs. I am not retracting anything, editing anything, or quietly dropping the grades that turned out to be wrong and got fixed in public.

**The harness.** `@polygraphso/litmus` stays published on npm and the repository stays public, archived and unmaintained but intact. The trust model here rested on reproducibility rather than on our authority, so a grade you doubt is still a grade you can disprove, on your own machine, with one command:

```
npx -y -p @polygraphso/litmus polygraphso-litmus litmus <server>
```

Same methodology, same probes, same evidence bundle. It works without me, which was the reason to build it in the open in the first place.

## Why

Three things, roughly in the order they mattered.

**The grades did not find enough usage.** People read an index when we put one in front of them, but not enough came back, and the continuous monitoring that was supposed to pay for the grades never converted into enough subscriptions. Most networks were happy to read an index and not to fund one.

**The funding that covered the gap went with it.** What paid for development while the paid product looked for its footing was riding on the same expectation, and it is no longer arriving.

**The rest outran what I could put into it.** Infrastructure and operator time are a standing bill, and a rating service run on part-time attention goes stale in ways its readers cannot see: grades age, alerts go unwatched, and the index still looks current. I would rather stop it than let it rot quietly.

## What goes stale

Every published grade was always a point-in-time result for one specific version, and after September 30 nothing re-checks whether a server has changed since. The tool-surface fingerprint on each report is still the tripwire — if a server's surface no longer matches what was graded, the grade no longer applies — but from October onward that check only runs when you run it.

So read the grades for what they are: dated measurements, with the evidence attached and the method open.

If you ran the harness against something you depend on, or read a report before wiring a tool into an agent, thank you. That is what it was for, and it still works.
