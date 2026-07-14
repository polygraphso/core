# Outreach — ClawHub / OpenClaw

- **To**: ClawHub maintainers — GitHub (clawhub org/repo) or OpenClaw Discord. *(Specific
  maintainer contact unverified — identify the actual registry maintainer before sending;
  community-run, so tone matters double.)*
- **Prerequisite**: none — https://polygraph.so/clawhub is already live, including
  Snyk-flagged malicious skills correctly graded D next to the popular surface.
- **Status**: draft, not sent.

---

**Subject:** We graded ClawHub's popular skills — the flagged ones fail, the rest is public

Hi —

We run polygraph.so, an open static+behavioral litmus for agent skills and MCP servers.
We've been grading skills distributed through ClawHub and publishing the results:
https://polygraph.so/clawhub — the skills Snyk flagged in ToxicSkills grade D under our
skill litmus, sitting next to the popular skills an agent would actually install, most of
which pass.

We're writing because the last few months made the hard problem obvious: skills that look
benign at review time and misbehave at runtime survived VirusTotal and ClawScan, and a
meaningful share of skills fetch remote content when they run — so a point-in-time review
can be true when it's written and false a day later. Two things in our design speak to
exactly that: the grade is pinned to a fingerprint of the skill's actual content (change
the skill, the grade stops applying), and the whole harness is open, so any grade we
publish — including a D — can be re-run and disproven by anyone, including the skill's
author. We'd rather be checkable than trusted.

To be precise: a grade is a measurement, not a guarantee, and static analysis of a skill
has disclosed limits. It's a floor, not a ceiling.

The ask is small: if the index is useful to ClawHub users, link it — from the registry,
a pinned issue, wherever fits. If you'd rather consume grades directly (API, per-skill
badge), that exists too, free. And if we've graded something wrong, tell us — published
corrections are part of the method.

Rúben
polygraph.so — harness: github.com/polygraphso/litmus

---

**Note for us**: this is a credibility/distribution play, not revenue. The companion blog
post ("grading ClawHub's popular surface") is the launch content that warms up
Smithery/PulseMCP/Base — coordinate send with post publication.
