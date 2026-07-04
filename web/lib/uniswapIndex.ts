import "server-only";

/**
 * Data layer for the (unlisted) Uniswap-skills index at /uniswap.
 *
 * Scope: the community "build on Uniswap" skills carried in the Bankr skill library
 * (`github/BankrBot/skills#uniswap-*`) — NOT skills published by Uniswap Labs. They are
 * agent-authoring helpers (v4 hooks, trading, viem/driver integration) that ship inside
 * that marketplace, already graded by the static skill litmus; this page re-cuts that
 * cohort under a Uniswap-builder banner. Honest framing matters: an A is a clean static
 * scan of the skill text + bundle, not an endorsement by the protocol.
 *
 * Grades are read live from `hosted_runs` (regardless of `published_at`, newest run
 * wins) via the shared loader — the same grade-only read /bankr uses.
 */

import { loadSkillCohort, type GradedSkill, type SkillMeta } from "@/lib/skillEcosystem";

const BANKR_SKILLS_REPO = "github/BankrBot/skills";

/** Curated Uniswap-builder skills, split into a light trading / v4 / integration cut. */
const UNISWAP_SKILLS: SkillMeta[] = [
  { name: "uniswap-trading", target: `${BANKR_SKILLS_REPO}#uniswap-trading`, cohort: "trading", featured: true },
  { name: "uniswap-cca", target: `${BANKR_SKILLS_REPO}#uniswap-cca`, cohort: "trading" },
  { name: "uniswap-hooks", target: `${BANKR_SKILLS_REPO}#uniswap-hooks`, cohort: "v4" },
  { name: "uniswap-viem", target: `${BANKR_SKILLS_REPO}#uniswap-viem`, cohort: "integration" },
  { name: "uniswap-driver", target: `${BANKR_SKILLS_REPO}#uniswap-driver`, cohort: "integration" },
];

export const UNISWAP_COHORT_ORDER = ["trading", "v4", "integration"];
export const UNISWAP_COHORT_LABEL: Record<string, string> = {
  trading: "Trading & routing",
  v4: "v4 hooks",
  integration: "Client integration",
};

export async function loadUniswapSkills(): Promise<GradedSkill[]> {
  return loadSkillCohort(UNISWAP_SKILLS);
}
