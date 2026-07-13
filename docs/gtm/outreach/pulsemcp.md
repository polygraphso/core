# Outreach — PulseMCP

- **To**: Tadas Antanavicius — tadas@tadasant.com. (Also runs official-registry
  maintenance and sits on the MCP steering group; write to the directory owner, let the
  other hats come up naturally.)
- **Prerequisite**: top-15 PulseMCP-listed servers graded; most overlap the existing index,
  so this may need few new runs. Fill `{INDEX_URL}` (can be `/mcp-index` filtered links if
  no dedicated page is warranted).
- **Status**: draft, not sent.

---

**Subject:** A behavioral A–F column for the curated registry

Hi Tadas,

We run polygraph.so — an open behavioral litmus for MCP servers. Not a manifest scan: the
harness launches the server, fingerprints its tool surface, and probes live behavior —
tool-output injection, undeclared egress from a default-deny sandbox, planted-canary
handling, adversarial input. A–F, reproducible with one command from every report page.
119 published grades across the most-adopted servers so far: {INDEX_URL}

The fit I see: PulseMCP hand-reviews listings daily, and the managed sub-registry sells
curation to enterprises. A behavioral grade is the layer hand review can't produce —
what the server *does* when probed, not what its metadata says — and it's exactly the
signal an enterprise buyer of a curated registry expects to exist. We'd supply the column
from our public API, free; the grades are ours and nobody can pay for one, so your
independence story stays clean too.

Being precise: a grade is a measurement, not a guarantee — pinned to a version and a
tool-surface fingerprint, limits disclosed on every report (evasion of a test context is
the residual limit of any dynamic analysis, and we say so).

Also, wearing your registry-maintainer hat: the official registry docs delegate security
ratings to downstream aggregators. That's us volunteering. If there's a better way to make
grades available to the registry ecosystem than our API, I'd genuinely like your read.

Rúben
polygraph.so — the harness is open: github.com/polygraphso/litmus

---

**Follow-up (+5 business days):** one paragraph, new information only.
