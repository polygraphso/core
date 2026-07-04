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

import { loadSkillCohort, type GradedSkill, type SkillMeta } from "@/lib/skillEcosystem";

export const SKILLS_SH_COHORT_ORDER = ["vercel", "anthropic", "engineering", "frameworks", "domain"];
export const SKILLS_SH_COHORT_LABEL: Record<string, string> = {
  vercel: "Vercel-authored",
  anthropic: "Anthropic",
  engineering: "Engineering workflow",
  frameworks: "Frameworks & libraries",
  domain: "Domain skills",
};

const SKILLS_SH_SKILLS: SkillMeta[] = [
  // Vercel-authored
  { name: "find-skills", target: "github/vercel-labs/skills#skills/find-skills", cohort: "vercel", featured: true },
  { name: "react-best-practices", target: "github/vercel-labs/agent-skills#skills/react-best-practices", cohort: "vercel" },
  { name: "web-design-guidelines", target: "github/vercel-labs/agent-skills#skills/web-design-guidelines", cohort: "vercel" },
  { name: "agent-browser", target: "github/vercel-labs/agent-browser#skills/agent-browser", cohort: "vercel" },
  // Anthropic
  { name: "frontend-design", target: "github/anthropics/skills#skills/frontend-design", cohort: "anthropic", featured: true },
  { name: "skill-creator", target: "github/anthropics/skills#skills/skill-creator", cohort: "anthropic" },
  // Engineering workflow
  { name: "tdd", target: "github/mattpocock/skills#skills/engineering/tdd", cohort: "engineering" },
  { name: "triage", target: "github/mattpocock/skills#skills/engineering/triage", cohort: "engineering" },
  { name: "grill-me", target: "github/mattpocock/skills#skills/productivity/grill-me", cohort: "engineering" },
  { name: "brainstorming", target: "github/obra/superpowers#skills/brainstorming", cohort: "engineering" },
  // Frameworks & libraries
  { name: "remotion", target: "github/remotion-dev/skills#skills/remotion", cohort: "frameworks" },
  { name: "supabase-postgres-best-practices", target: "github/supabase/agent-skills#skills/supabase-postgres-best-practices", cohort: "frameworks" },
  { name: "shadcn", target: "github/shadcn-ui/ui#skills/shadcn", cohort: "frameworks" },
  // Domain skills
  { name: "caveman", target: "github/JuliusBrussee/caveman#skills/caveman", cohort: "domain" },
  { name: "just-scrape", target: "github/ScrapeGraphAI/just-scrape#skills/just-scrape", cohort: "domain" },
  { name: "seo-audit", target: "github/coreyhaines31/marketingskills#skills/seo-audit", cohort: "domain" },
];

export async function loadSkillsShSkills(): Promise<GradedSkill[]> {
  return loadSkillCohort(SKILLS_SH_SKILLS);
}
