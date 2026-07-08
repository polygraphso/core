/**
 * Seed source for the six pre-DB ecosystem indices. Each legacy page keeps its
 * hardcoded array as the fallback the loader uses until the DB is seeded; this
 * module turns those same arrays into the rows the seed script writes into
 * ecosystems / ecosystem_entries, so the DB is populated from the exact data the
 * pages already render.
 *
 * The whole original array element is stored in each entry's `metadata`, so the
 * loaders reconstruct their bespoke row shapes from `metadata` (overlaying the
 * curation columns visible/featured/cohort/position). Seeded rows are written with
 * added_by = null; the seed only ever refreshes those, never member-added entries.
 *
 * Only the seed imports this. The loaders fall back to their own local array, so
 * there is no import cycle back here.
 */

import { BASE_ENTRIES, GROUP_LABEL as BASE_LABEL, GROUP_ORDER as BASE_ORDER } from "@/lib/baseIndex";
import {
  VIRTUALS_ENTRIES,
  GROUP_LABEL as VIRT_LABEL,
  GROUP_ORDER as VIRT_ORDER,
} from "@/lib/virtualsIndex";
import {
  BANKR_SKILLS_META,
  BANKR_AGENTS_META,
  bankrSkillTarget,
  SKILL_COHORT_LABEL,
  SKILL_COHORT_ORDER,
} from "@/lib/bankrIndex";
import { UNISWAP_SKILLS, UNISWAP_COHORT_ORDER, UNISWAP_COHORT_LABEL } from "@/lib/uniswapIndex";
import { CLAWHUB_SKILLS, CLAWHUB_COHORT_ORDER, CLAWHUB_COHORT_LABEL } from "@/lib/clawhubIndex";
import { SKILLS_SH_SKILLS, SKILLS_SH_COHORT_ORDER, SKILLS_SH_COHORT_LABEL } from "@/lib/skillsShIndex";
import type { EcosystemEntryKind, EcosystemPageConfig } from "@/lib/ecosystemTypes";

export interface SeedEntry {
  target: string | null;
  target_kind: EcosystemEntryKind;
  cohort: string | null;
  featured: boolean;
  position: number;
  metadata: Record<string, unknown>;
}

export interface LegacyEcosystemSeed {
  slug: string;
  name: string;
  blurb: string;
  page_config: EcosystemPageConfig;
  entries: SeedEntry[];
}

/** https endpoint → remote_url, anything else (npm/pypi/github ref) → registry_ref. */
function mcpKind(target: string | null): EcosystemEntryKind {
  return target && /^https?:\/\//.test(target) ? "remote_url" : "registry_ref";
}

/** Base / Virtuals share the {project, group, target, …} shape. */
function mcpEntriesToSeed<T extends { project: string; group: string; target: string | null }>(
  rows: T[],
): SeedEntry[] {
  return rows.map((e, i) => ({
    target: e.target,
    target_kind: mcpKind(e.target),
    cohort: e.group,
    featured: false,
    position: i,
    metadata: { ...e, name: e.project },
  }));
}

/** Uniswap / ClawHub / skills.sh share the SkillMeta {name, target, cohort, …} shape. */
function skillMetasToSeed(
  rows: Array<{ name: string; target: string; cohort: string; featured?: boolean; note?: string }>,
): SeedEntry[] {
  return rows.map((m, i) => ({
    target: m.target,
    target_kind: "skill" as const,
    cohort: m.cohort,
    featured: Boolean(m.featured),
    position: i,
    metadata: { ...m },
  }));
}

const pageConfig = (order: readonly string[], label: Record<string, string>): EcosystemPageConfig => ({
  cohortOrder: [...order],
  cohortLabel: label,
});

/** Bankr: skills (github/BankrBot/skills#<slug>) then agents (own MCP servers). */
function bankrEntries(): SeedEntry[] {
  const skills: SeedEntry[] = BANKR_SKILLS_META.map((m, i) => ({
    target: bankrSkillTarget(m.slug),
    target_kind: "skill" as const,
    cohort: m.cohort,
    featured: m.featured,
    position: i,
    metadata: { ...m, section: "skills", name: m.slug },
  }));
  const base = skills.length;
  const agents: SeedEntry[] = BANKR_AGENTS_META.map((m, i) => ({
    target: m.target,
    target_kind: mcpKind(m.target),
    cohort: "agents",
    featured: false,
    position: base + i,
    metadata: { ...m, section: "agents", name: m.project },
  }));
  return [...skills, ...agents];
}

export const LEGACY_ECOSYSTEMS: LegacyEcosystemSeed[] = [
  {
    slug: "base",
    name: "Base network",
    blurb:
      "MCP servers an onchain agent on Base can use: the projects integrating Base MCP, plus the wider DeFi, data, and infrastructure servers around the network.",
    page_config: pageConfig(BASE_ORDER, BASE_LABEL),
    entries: mcpEntriesToSeed(BASE_ENTRIES),
  },
  {
    slug: "bankr",
    name: "Bankr ecosystem",
    blurb:
      "Static safety grades for the Bankr skill library, plus behavioral grades for the agents that ship their own MCP server.",
    page_config: {
      cohortOrder: [...SKILL_COHORT_ORDER, "agents"],
      cohortLabel: { ...SKILL_COHORT_LABEL, agents: "Agents with their own MCP server" },
    },
    entries: bankrEntries(),
  },
  {
    slug: "virtuals",
    name: "Virtuals Protocol",
    blurb:
      "Behavioral grades for the MCP surface of the Virtuals agent launchpad on Base: the protocol's own commerce and framework infrastructure, and the agents launched on it.",
    page_config: pageConfig(VIRT_ORDER, VIRT_LABEL),
    entries: mcpEntriesToSeed(VIRTUALS_ENTRIES),
  },
  {
    slug: "uniswap",
    name: "Uniswap builder skills",
    blurb:
      "Static safety grades for the community “build on Uniswap” skills carried in the Bankr library: v4 hooks, trading, and client-integration helpers.",
    page_config: pageConfig(UNISWAP_COHORT_ORDER, UNISWAP_COHORT_LABEL),
    entries: skillMetasToSeed(UNISWAP_SKILLS),
  },
  {
    slug: "clawhub",
    name: "ClawHub registry",
    blurb:
      "Static safety grades for skills distributed through ClawHub: the malicious skills Snyk flagged next to the popular ones an agent would install.",
    page_config: pageConfig(CLAWHUB_COHORT_ORDER, CLAWHUB_COHORT_LABEL),
    entries: skillMetasToSeed(CLAWHUB_SKILLS),
  },
  {
    slug: "skills-sh",
    name: "skills.sh directory",
    blurb:
      "Static safety grades for the most-installed skills on skills.sh (Vercel’s open Agent Skills directory): a behavioral A to F verdict alongside its dependency alerts.",
    page_config: pageConfig(SKILLS_SH_COHORT_ORDER, SKILLS_SH_COHORT_LABEL),
    entries: skillMetasToSeed(SKILLS_SH_SKILLS),
  },
];
