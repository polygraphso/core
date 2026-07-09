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

import { loadSkillCohort, legacySkillMetas, type GradedSkill, type SkillMeta } from "@/lib/skillEcosystem";

const BANKR_SKILLS_REPO = "github/BankrBot/skills";
const UNISWAP_AI = "github/Uniswap/uniswap-ai"; // Uniswap Labs' official agent-skills monorepo

/** Uniswap builder skills: the official Uniswap/uniswap-ai set, community skills, and
 *  the community "build on Uniswap" skills carried in the Bankr library. */
export const UNISWAP_SKILLS: SkillMeta[] = [
  // Official — Uniswap Labs' uniswap-ai plugins.
  { name: "v4-hook-generator", target: `${UNISWAP_AI}#packages/plugins/uniswap-hooks/skills/v4-hook-generator`, cohort: "official", featured: true },
  { name: "v4-security-foundations", target: `${UNISWAP_AI}#packages/plugins/uniswap-hooks/skills/v4-security-foundations`, cohort: "official" },
  { name: "swap-planner", target: `${UNISWAP_AI}#packages/plugins/uniswap-driver/skills/swap-planner`, cohort: "official" },
  { name: "liquidity-planner", target: `${UNISWAP_AI}#packages/plugins/uniswap-driver/skills/liquidity-planner`, cohort: "official" },
  { name: "configurator", target: `${UNISWAP_AI}#packages/plugins/uniswap-cca/skills/configurator`, cohort: "official" },
  { name: "deployer", target: `${UNISWAP_AI}#packages/plugins/uniswap-cca/skills/deployer`, cohort: "official" },
  { name: "copy-trade", target: `${UNISWAP_AI}#packages/plugins/uniswap-trading-tools/skills/copy-trade`, cohort: "official" },
  { name: "dca-bot", target: `${UNISWAP_AI}#packages/plugins/uniswap-trading-tools/skills/dca-bot`, cohort: "official" },
  { name: "swap-integration", target: `${UNISWAP_AI}#packages/plugins/uniswap-trading/skills/swap-integration`, cohort: "official" },
  { name: "viem-integration", target: `${UNISWAP_AI}#packages/plugins/uniswap-viem/skills/viem-integration`, cohort: "official" },
  // Community — standalone repos.
  { name: "uniswapV4-hooks", target: "github/igoryuzo/uniswapV4-hooks-skill", cohort: "community", note: "secure V4 hook dev" },
  { name: "uniswap-api", target: "github/worldofhacks/uniswap-api-skill", cohort: "community", note: "Uniswap Trading API (REST)" },
  { name: "uniswap-v4-expert", target: "github/ccashwell/evm-cortex#skills/uniswap-v4-expert", cohort: "community" },
  { name: "ape-uniswap", target: "github/ApeWorX/skills#protocols/uniswap", cohort: "community", note: "Uniswap via ApeWorX (Python)" },
  { name: "uniswap-v4-hooks", target: "github/cyotee/uniswap-V4-skill#skills/uniswap-v4-hooks", cohort: "community" },
  // Bankr library — community "build on Uniswap" skills.
  { name: "uniswap-trading", target: `${BANKR_SKILLS_REPO}#uniswap-trading`, cohort: "bankr", featured: true },
  { name: "uniswap-cca", target: `${BANKR_SKILLS_REPO}#uniswap-cca`, cohort: "bankr" },
  { name: "uniswap-hooks", target: `${BANKR_SKILLS_REPO}#uniswap-hooks`, cohort: "bankr" },
  { name: "uniswap-viem", target: `${BANKR_SKILLS_REPO}#uniswap-viem`, cohort: "bankr" },
  { name: "uniswap-driver", target: `${BANKR_SKILLS_REPO}#uniswap-driver`, cohort: "bankr" },
];

export const UNISWAP_COHORT_ORDER = ["official", "community", "bankr"];
export const UNISWAP_COHORT_LABEL: Record<string, string> = {
  official: "Official (Uniswap/uniswap-ai)",
  community: "Community skills",
  bankr: "Bankr library",
};

export async function loadUniswapSkills(): Promise<GradedSkill[]> {
  return loadSkillCohort(await legacySkillMetas("uniswap", UNISWAP_SKILLS));
}
