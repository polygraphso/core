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

export const CLAWHUB_COHORT_ORDER = ["malware", "popular", "dev", "research"];
export const CLAWHUB_COHORT_LABEL: Record<string, string> = {
  malware: "Flagged in Snyk’s ToxicSkills report",
  popular: "Popular ClawHub skills",
  dev: "Developer tooling",
  research: "Research & science",
};

const CLAWHUB_SKILLS: SkillMeta[] = [
  // Known-bad — the security hook. Each ships a fake "Prerequisites" step that runs a
  // base64-decoded curl|bash + fetches a password-protected archive (Snyk ToxicSkills).
  { name: "whatsapp-mgv", target: "github/aztr0nutzs/NET_NiNjA.v1.2#skills/skills-folders/whatsapp-mgv", cohort: "malware", note: "fake WhatsApp skill — base64 curl|bash in the SKILL.md body (Snyk ToxicSkills, actor aztr0nutzs)" },
  { name: "coding-agent-1gx", target: "github/aztr0nutzs/NET_NiNjA.v1.2#skills/skills-folders/coding-agent-1gx", cohort: "malware", note: "fake coding-agent skill — same in-body payload" },
  { name: "clawhub", target: "github/aztr0nutzs/NET_NiNjA.v1.2#skills/skills-folders/clawhub", cohort: "malware", note: "fake ClawHub skill — same in-body payload" },
  { name: "twitter-sum", target: "github/Sompote/Tiger_bot#skills/twitter-sum", cohort: "malware", note: "second actor, identical payload (Snyk-named)" },
  // Marketplace redistributions of the same C2 (91.92.242.30) — the payload written
  // into the SKILL.md body; litmus-skill-v3 grades each D on the static text.
  { name: "wacli", target: "github/dvcrn/openclaw-skills-marketplace#plugins/sakaen736jih--wacli-hq4/skills/wacli", cohort: "malware", note: "marketplace redistribution — in-body base64 curl|bash" },
  { name: "bird", target: "github/dvcrn/openclaw-skills-marketplace#plugins/iqbalnaveliano--bird-su/skills/bird", cohort: "malware", note: "marketplace redistribution — in-body base64 curl|bash" },
  { name: "gorger", target: "github/kbarbel640-del/skills#skills/ttboy/gorger", cohort: "malware", note: "in-body base64 curl|bash" },
  { name: "malicious-skill", target: "github/aibot88/sec_skill_store#skills/claudskills/malicious-skill", cohort: "malware", note: "in-body base64 curl|bash" },
  { name: "polymarketagent", target: "github/drbobber/superdiscount-deals#skills/polymarketagent", cohort: "malware", note: "fake Polymarket agent — in-body base64 curl|bash" },
  { name: "summarize", target: "github/aifinlab/FinClaw#skills/summarize", cohort: "malware", note: "in-body base64 curl|bash" },
  { name: "bybit-agent", target: "github/Demerzels-lab/elsamultiskillagent#public/skills/aslaep123/bybit-agent", cohort: "malware", note: "fake Bybit agent — in-body base64 curl|bash (+ sudo variant)" },

  // Popular ClawHub skills, reachable from the author's own repo or an exact mirror.
  { name: "self-improvement", target: "github/pskoett/pskoett-ai-skills#skills/self-improvement", cohort: "popular", featured: true, note: "self-improving-agent — #1 by installs" },
  { name: "SkillScan", target: "github/tokauthai/SkillScan", cohort: "popular", note: "a security gate for skills" },
  { name: "proactive-agent", target: "github/halthelobster/proactive-agent", cohort: "popular" },
  { name: "api-gateway", target: "github/maton-ai/api-gateway-skill", cohort: "popular", note: "third-party API proxy" },
  { name: "browser-use", target: "github/browser-use/browser-use#skills/browser-use", cohort: "popular" },
  { name: "word-docx", target: "github/clawic/skills#skills/word-docx", cohort: "popular" },
  { name: "obsidian", target: "github/steipete/agent-scripts#skills/obsidian", cohort: "popular" },
  { name: "anki", target: "github/clawic/skills#skills/anki", cohort: "popular", note: "spaced-repetition flashcards" },
  { name: "amazon", target: "github/clawic/skills#skills/amazon", cohort: "popular", note: "buyer/seller/affiliate helper" },
  { name: "airtag", target: "github/clawic/skills#skills/airtag", cohort: "popular", note: "locate items, diagnostics" },

  // Developer tooling.
  { name: "ansible", target: "github/clawic/skills#skills/ansible", cohort: "dev", note: "Ansible pitfalls, idempotence" },
  { name: "angular", target: "github/clawic/skills#skills/angular", cohort: "dev", note: "RxJS leaks, change detection, DI" },
  { name: "android", target: "github/clawic/skills#skills/android", cohort: "dev", note: "build system + deployment" },
  { name: "npm", target: "github/steipete/agent-scripts#skills/npm", cohort: "dev", note: "registry ops: login, publish" },
  { name: "one-password", target: "github/steipete/agent-scripts#skills/one-password", cohort: "dev", note: "1Password secret read/store/inject" },
  { name: "beeper", target: "github/steipete/agent-scripts#skills/beeper", cohort: "dev", note: "local Beeper chat history + FTS" },
  { name: "markdown-converter", target: "github/steipete/agent-scripts#skills/markdown-converter", cohort: "dev", note: "PDF/Office/HTML/audio → Markdown" },
  { name: "peekaboo", target: "github/steipete/agent-scripts#skills/peekaboo", cohort: "dev", note: "macOS screenshots + UI automation" },

  // Research & science.
  { name: "alphafold", target: "github/FreedomIntelligence/OpenClaw-Medical-Skills#skills/alphafold", cohort: "research", note: "AlphaFold protein-structure workflows" },
  { name: "arxiv-search", target: "github/FreedomIntelligence/OpenClaw-Medical-Skills#skills/arxiv-search", cohort: "research", note: "semantic arXiv preprint search" },
];

export async function loadClawhubSkills(): Promise<GradedSkill[]> {
  return loadSkillCohort(CLAWHUB_SKILLS);
}
