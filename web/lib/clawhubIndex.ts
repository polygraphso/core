import "server-only";

/**
 * Data layer for the (unlisted) ClawHub index at /clawhub.
 *
 * Scope: skills distributed through ClawHub (the OpenClaw skill registry, clawhub.ai) —
 * both a cohort of the most-installed normal skills AND the malicious skills Snyk
 * documented in its "ToxicSkills" report, which are the security hook: a skill litmus
 * that grades a bundled `curl | bash` payload D/F is the whole pitch. ClawHub itself is a
 * registry (its canonical blobs live in a backend), but the popular skills and the
 * flagged malware are reachable from cloneable GitHub sources, which is what we grade.
 *
 * Grades read live from `hosted_runs` (grade-only, any publish state) via the shared
 * loader. The malware skills are graded by a STATIC scan (no execution) — safe to run.
 */

import { loadSkillCohort, type GradedSkill, type SkillMeta } from "@/lib/skillEcosystem";

export const CLAWHUB_COHORT_ORDER = ["malware", "popular", "builtin"];
export const CLAWHUB_COHORT_LABEL: Record<string, string> = {
  malware: "Flagged in Snyk’s ToxicSkills report",
  popular: "Popular ClawHub skills",
  builtin: "OpenClaw built-ins",
};

const CLAWHUB_SKILLS: SkillMeta[] = [
  // Known-bad — the security hook. Each ships a fake "Prerequisites" step that runs a
  // base64-decoded curl|bash + fetches a password-protected archive (Snyk ToxicSkills).
  { name: "whatsapp-mgv", target: "github/aztr0nutzs/NET_NiNjA.v1.2#skills/skills-folders/whatsapp-mgv", cohort: "malware", note: "fake WhatsApp skill — bundled curl|bash payload (Snyk ToxicSkills, actor aztr0nutzs)" },
  { name: "coding-agent-1gx", target: "github/aztr0nutzs/NET_NiNjA.v1.2#skills/skills-folders/coding-agent-1gx", cohort: "malware", note: "fake coding-agent skill — same bundled payload" },
  { name: "google-qx4", target: "github/aztr0nutzs/NET_NiNjA.v1.2#skills/skills-folders/google-qx4", cohort: "malware", note: "fake Google skill — same bundled payload" },
  { name: "clawhub", target: "github/aztr0nutzs/NET_NiNjA.v1.2#skills/skills-folders/clawhub", cohort: "malware", note: "fake ClawHub skill — same bundled payload" },
  { name: "twitter-sum", target: "github/Sompote/Tiger_bot#skills/twitter-sum", cohort: "malware", note: "second actor, identical payload (Snyk-named)" },
  { name: "toxicskills-goof", target: "github/snyk-labs/toxicskills-goof", cohort: "malware", note: "Snyk’s own lab demo — exfiltrates host info to a paste service" },

  // Popular ClawHub skills, reachable from the author's own repo or an exact mirror.
  { name: "self-improvement", target: "github/pskoett/pskoett-ai-skills#skills/self-improvement", cohort: "popular", featured: true, note: "self-improving-agent — #1 by installs" },
  { name: "SkillScan", target: "github/tokauthai/SkillScan", cohort: "popular", note: "a security gate for skills" },
  { name: "proactive-agent", target: "github/halthelobster/proactive-agent", cohort: "popular" },
  { name: "api-gateway", target: "github/maton-ai/api-gateway-skill", cohort: "popular", note: "third-party API proxy" },
  { name: "browser-use", target: "github/browser-use/browser-use#skills/browser-use", cohort: "popular" },
  { name: "word-docx", target: "github/clawic/skills#skills/word-docx", cohort: "popular" },
  { name: "obsidian", target: "github/steipete/agent-scripts#skills/obsidian", cohort: "popular" },

  // OpenClaw built-ins — the highest-trust baseline (the upstream assistant's own skills).
  { name: "github", target: "github/openclaw/openclaw#.agents/skills/github", cohort: "builtin" },
  { name: "weather", target: "github/openclaw/openclaw#.agents/skills/weather", cohort: "builtin" },
  { name: "notion", target: "github/openclaw/openclaw#.agents/skills/notion", cohort: "builtin" },
];

export async function loadClawhubSkills(): Promise<GradedSkill[]> {
  return loadSkillCohort(CLAWHUB_SKILLS);
}
