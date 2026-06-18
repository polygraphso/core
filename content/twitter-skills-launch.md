polygraph — skill grading launch thread (X/Twitter)
generated 2026-06-18 · methodology litmus-skill-v1
grades are real + reproducible: all 78 installed skills graded A (verified 2026-06-18)

Images live in core/content/images/:
  IMAGE 1 → skills-batch-scan-16x9.png   (1600×900, primary)   [3:2 fallback: skills-batch-scan-all-clean.png]
  IMAGE 2 → skill-a-impeccable.png  (single-skill card)

========================================================================
THREAD (8 tweets)
========================================================================

[1/8]  → ATTACH IMAGE 1 (the "all 78 skills" batch card)
Your agent runs skills you've never vetted. You asked us to grade them — now you can.

An open, deterministic scan: injection, exfil, dangerous bundled commands → A–F. Don't trust the grade — re-run it and get the same letter.

[2/8]
A skill is text your agent follows plus files it can run. Marketplaces ship them; agents install and execute them; almost nobody scans them first.

So polygraph (@polygraphso) now grades skills, not just MCP servers. Methodology: litmus-skill-v1. Open source, reproducible.

[3/8]
A static scan of the SKILL.md + bundled files. Three checks:

- S-01: does the body try to hijack the agent (prompt injection)?
- S-03: does it instruct the agent to leak secrets?
- S-04: does it ship a dangerous command (curl|bash, reverse shell)?

Grades A/B/D/F.

[4/8]
That run up top is real: I asked Claude Code to grade all 78 skills I have installed — frontend-design, superpowers, supabase, the vercel skills, the lot.

Every one came back A. Same harness, same inputs, same result if you run it. That's the point of an open scan.

[5/8]  → ATTACH IMAGE 2 (the impeccable single-skill card)
Up close: impeccable → A. One command, anyone can re-run it.

No injection in the body, no exfil instructions, no dangerous bundled command. That's what an A reports — and only that.

[6/8]
Read an A honestly: a clean static scan, not behavioral proof. It doesn't execute the bundle, and a command built or fetched at runtime isn't visible to it.

Not "100% safe," not an audit — a measurement. Not an accusation, not an endorsement.

[7/8]
The letter (S-01/S-03/S-04) is deterministic — re-run, same result.

Optionally, a model you supply judges the one thing a scanner can't: honesty — does the skill do what its description claims? Advisory, separate from the letter, never minted.

[8/8]
Run it three ways: the CLI, an MCP tool (run_skill_litmus), or just ask Claude Code.

It's open and deterministic, so don't take our grade — reproduce it.

  npx -p @polygraphso/litmus polygraphso-litmus-skill <dir>

More: polygraph.so · follow @polygraphso.

========================================================================
ALTERNATE HOOKS (swap in for tweet 1)
========================================================================

A) (the "falsifiable" angle — former tweet 1, no demand framing)
   Most "safety" checks on AI tools you can't verify — you read a badge, you trust it. We grade Agent Skills differently: an open, deterministic scan. Re-run it, same letter. A false grade is falsifiable, not just disputable.

B) (demand, blunt)
   You asked us to grade your Agent Skills. Done. An open, deterministic scan — injection, exfil, dangerous bundled commands, A–F. Don't trust the grade; re-run it and get the same letter.

C) (demo-led, with image 1 on the hook)
   I asked Claude Code to scan all 78 skills I have installed — by request, since you all kept asking. Every one came back A. Open, deterministic: re-run it and get the same letter.

D) (risk-led)
   Your coding agent installs skills from marketplaces and does what they say. A poisoned one can hijack it, leak secrets, or ship a dangerous command. polygraph now grades skills — open, reproducible, A–F.

========================================================================
IMAGE DESCRIPTIONS / ALT TEXT
========================================================================

IMAGE 1 — skills-batch-scan-16x9.png  (attach to tweet 1 — the launch lead)
Purpose: the hook's proof shot in the timeline; tweet 4 then narrates it ("that run up top is real").
Alt text (paste into X's image-description field):
  A dark terminal card titled "claude code." A prompt reads: "> run a polygraph
  safety scan on every skill I have installed." A reply line: "Graded all 78 with
  the open litmus harness — a static safety scan (litmus-skill-v1): injection,
  exfil instructions, dangerous bundled commands." Two columns list ten installed
  developer skills — frontend-design, superpowers · systematic-debugging,
  superpowers · test-driven-development, mcp-server-dev · build-mcp-server,
  supabase · postgres-best-practices, vercel · react-best-practices, vercel ·
  nextjs, superpowers · using-git-worktrees, skill-creator, impeccable — each with
  a green "A" grade. Below: "+ 68 more installed skills — all A." A summary line:
  "78 skills · 78 A · 0 flagged · an A is a clean static scan, not behavioral proof."

IMAGE 2 — skill-a-impeccable.png  (attach to tweet 5)
Purpose: one skill up close with the exact reproducible command, backing the "→ A" in tweet 5.
Alt text:
  A dark terminal card titled "litmus — skill." Command line: "$ npx -p @polygraphso/litmus
  polygraphso-litmus-skill ~/.claude/skills/impeccable." Output: "litmus-skill-v1 · impeccable,"
  then a "checks" block — S-01 prompt injection / context poisoning: pass; S-03
  data-exfiltration instructions: pass; S-04 dangerous bundled commands: pass. A content hash,
  then "grade: A" in green, with a note that an A reflects static scanning, not behavioral proof.

========================================================================
POSTING NOTES
========================================================================
- Tweet 1 leads with image 1 (the batch card) for stopping power in the timeline; the
  demand hook still stands alone as text. (Alt: keep tweet 1 text-only and move image 1
  to tweet 4 if you'd rather the hook be read before any visual.)
- Image 1 is 16:9 (no timeline crop). If you prefer the taller 3:2 card, swap in
  skills-batch-scan-all-clean.png.
- Every grade shown is a real, reproducible run (litmus-skill-v1, 2026-06-18). Anyone
  can re-run: npx -p @polygraphso/litmus polygraphso-litmus-skill <dir>
- Handle: @polygraphso (x.com/polygraphso). Tagged in tweet 2 (product intro) + tweet 8
  (CTA). NOTE: this assumes you post from a personal/founder account. If you post FROM
  @polygraphso, drop the self-tag in tweet 2 — keep the link + CTA in tweet 8.
- Honesty guardrails kept on purpose: "A = clean static scan, not behavioral proof,"
  no "100% safe," measurement not endorsement. Don't loosen these in edits.
- Tweet 7 (the optional honesty signal) is the ADVISORY, model-judged layer (axes:
  honesty + coherence). It needs a model you supply (LITMUS_LLM_API_KEY + LITMUS_LLM_MODEL,
  or via the agent's MCP sampling); it is NON-deterministic (majority-over-k, not
  bit-identical), never part of the A/B/D/F letter, and never minted. Keep it clearly
  separate from the deterministic letter — don't imply it makes the grade "more complete."
  (S-05 / tool-permission overreach is NOT judged yet — roadmap; don't claim it.)
