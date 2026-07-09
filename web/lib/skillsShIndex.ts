import "server-only";

/**
 * Data layer for the (unlisted) skills.sh index at /skills-sh.
 *
 * Scope: the most-installed skills on skills.sh — Vercel's open Agent Skills directory
 * (every listing maps to a public `github/<owner>/<repo>` source via `npx skills add`).
 * skills.sh already surfaces dependency/static alerts (Socket, Snyk, Gen), but no
 * behavioral A–F grade — this index adds the litmus-skill-v2 static-safety grade over a
 * curated top cohort. Grades read live from `hosted_runs` via the shared loader.
 *
 * Refs use the REAL on-disk folder path, which often differs from the skills.sh display
 * name (e.g. the shown "vercel-react-best-practices" lives at react-best-practices, and
 * "remotion-best-practices" at skills/remotion) — resolved during sourcing.
 */

import { loadSkillCohort, legacySkillMetas, type GradedSkill, type SkillMeta } from "@/lib/skillEcosystem";

export const SKILLS_SH_COHORT_ORDER = [
  "vercel",
  "anthropic",
  "engineering",
  "frameworks",
  "documents",
  "creative",
  "marketing",
  "domain",
];
export const SKILLS_SH_COHORT_LABEL: Record<string, string> = {
  vercel: "Vercel-authored",
  anthropic: "Anthropic",
  engineering: "Engineering workflow",
  frameworks: "Frameworks & libraries",
  documents: "Documents & office",
  creative: "Creative & design",
  marketing: "Marketing",
  domain: "Domain skills",
};

export const SKILLS_SH_SKILLS: SkillMeta[] = [
  // Vercel-authored
  { name: "find-skills", target: "github/vercel-labs/skills#skills/find-skills", cohort: "vercel", featured: true },
  { name: "react-best-practices", target: "github/vercel-labs/agent-skills#skills/react-best-practices", cohort: "vercel" },
  { name: "web-design-guidelines", target: "github/vercel-labs/agent-skills#skills/web-design-guidelines", cohort: "vercel" },
  { name: "agent-browser", target: "github/vercel-labs/agent-browser#skills/agent-browser", cohort: "vercel" },
  { name: "composition-patterns", target: "github/vercel-labs/agent-skills#skills/composition-patterns", cohort: "vercel" },
  { name: "react-native-skills", target: "github/vercel-labs/agent-skills#skills/react-native-skills", cohort: "vercel" },
  // Anthropic
  { name: "frontend-design", target: "github/anthropics/skills#skills/frontend-design", cohort: "anthropic", featured: true },
  { name: "skill-creator", target: "github/anthropics/skills#skills/skill-creator", cohort: "anthropic" },
  { name: "mcp-builder", target: "github/anthropics/skills#skills/mcp-builder", cohort: "anthropic", featured: true },
  { name: "webapp-testing", target: "github/anthropics/skills#skills/webapp-testing", cohort: "anthropic" },
  // Engineering workflow
  { name: "tdd", target: "github/mattpocock/skills#skills/engineering/tdd", cohort: "engineering" },
  { name: "triage", target: "github/mattpocock/skills#skills/engineering/triage", cohort: "engineering" },
  { name: "grill-me", target: "github/mattpocock/skills#skills/productivity/grill-me", cohort: "engineering" },
  { name: "brainstorming", target: "github/obra/superpowers#skills/brainstorming", cohort: "engineering" },
  { name: "systematic-debugging", target: "github/obra/superpowers#skills/systematic-debugging", cohort: "engineering" },
  { name: "using-git-worktrees", target: "github/obra/superpowers#skills/using-git-worktrees", cohort: "engineering" },
  { name: "verification-before-completion", target: "github/obra/superpowers#skills/verification-before-completion", cohort: "engineering" },
  { name: "diagnosing-bugs", target: "github/mattpocock/skills#skills/engineering/diagnosing-bugs", cohort: "engineering" },
  { name: "domain-modeling", target: "github/mattpocock/skills#skills/engineering/domain-modeling", cohort: "engineering" },
  // Frameworks & libraries
  { name: "remotion", target: "github/remotion-dev/skills#skills/remotion", cohort: "frameworks" },
  { name: "supabase-postgres-best-practices", target: "github/supabase/agent-skills#skills/supabase-postgres-best-practices", cohort: "frameworks" },
  { name: "shadcn", target: "github/shadcn-ui/ui#skills/shadcn", cohort: "frameworks" },
  // Documents & office
  { name: "pdf", target: "github/anthropics/skills#skills/pdf", cohort: "documents" },
  { name: "xlsx", target: "github/anthropics/skills#skills/xlsx", cohort: "documents" },
  { name: "docx", target: "github/anthropics/skills#skills/docx", cohort: "documents" },
  { name: "pptx", target: "github/anthropics/skills#skills/pptx", cohort: "documents" },
  // Creative & design
  { name: "canvas-design", target: "github/anthropics/skills#skills/canvas-design", cohort: "creative" },
  { name: "algorithmic-art", target: "github/anthropics/skills#skills/algorithmic-art", cohort: "creative" },
  // Marketing
  { name: "cold-email", target: "github/coreyhaines31/marketingskills#skills/cold-email", cohort: "marketing" },
  { name: "copywriting", target: "github/coreyhaines31/marketingskills#skills/copywriting", cohort: "marketing" },
  { name: "pricing", target: "github/coreyhaines31/marketingskills#skills/pricing", cohort: "marketing" },
  // Domain skills
  { name: "caveman", target: "github/JuliusBrussee/caveman#skills/caveman", cohort: "domain" },
  { name: "just-scrape", target: "github/ScrapeGraphAI/just-scrape#skills/just-scrape", cohort: "domain" },
  { name: "seo-audit", target: "github/coreyhaines31/marketingskills#skills/seo-audit", cohort: "domain" },
];

export async function loadSkillsShSkills(): Promise<GradedSkill[]> {
  return loadSkillCohort(await legacySkillMetas("skills-sh", SKILLS_SH_SKILLS));
}
