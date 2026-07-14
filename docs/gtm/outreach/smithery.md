# Outreach — Smithery

- **To**: Henry Mao (founder). Channels, in order: X DM @Calclavia; GitHub `smithery-ai`
  (issue/discussion only as fallback — keep pitches out of public issues); hello@ address
  if discoverable.
- **Prerequisite**: top-25 Smithery servers graded and the index page live
  (see `target-servers.md`). Fill `{INDEX_URL}` before sending.
- **Status**: draft, not sent.

---

**Subject:** We graded 25 of Smithery's most-used servers — results attached

Hi Henry,

We run polygraph.so — an open behavioral harness for MCP servers. It connects to a server
the way an agent would, fingerprints the tool surface, then probes what the server actually
does: tool-output injection, undeclared egress from a default-deny sandbox, planted-canary
leaks, and adversarial input. Grades are A–F, and every report carries the one-command
re-run, so a wrong grade is falsifiable — including by the server's author.

We graded 25 of your most-used servers and published the results here: {INDEX_URL}

Why you specifically: you already treat third-party scanning as table stakes — the
Invariant integration made that clear — but manifest-level scanning has a known gap.
An independent scan this March still found issues in 22 of 100 listed servers, and the
things that hurt most (a server that behaves at review time and misbehaves at runtime)
don't show up in a manifest at all. Behavioral grading is the complementary layer, and
since you host the servers, your whole catalog is gradeable.

To be precise about what this is: a grade is a measurement, not a guarantee. It's pinned
to a version and a tool-surface fingerprint; if the surface changes, the grade stops
applying. The limits are disclosed on every report.

The simple version of working together: an A–F column on your listings, read from our
public API, free. The fuller version is continuous monitoring of the hosted catalog —
re-grades on release, drift alerts. Happy to start with whichever is useful.

Rúben
polygraph.so — the harness is open: github.com/polygraphso/litmus

---

**Follow-up (+5 business days, only with new information):** one paragraph, lead with
whatever changed — a new grade on a server they host, a regression caught, the ClawHub
post. No content-free bumps.
