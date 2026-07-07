import "server-only";

/**
 * Registry for the (unlisted) ecosystems hub at /ecosystems. Each entry's
 * `loadStats` reuses the destination page's OWN live loader, so an ecosystem
 * card can never drift from the page it links to — the same grade-only
 * hosted_runs rows the /base and /bankr pages already read.
 *
 * Adding a third ecosystem is one entry here plus its own page; the hub picks
 * it up automatically.
 */

import { loadBaseIndex } from "@/lib/baseIndex";
import { loadBankrSkills, loadBankrAgents } from "@/lib/bankrIndex";
import { loadUniswapSkills } from "@/lib/uniswapIndex";
import { loadVirtualsIndex } from "@/lib/virtualsIndex";
import { loadSkillsShSkills } from "@/lib/skillsShIndex";
import { loadClawhubSkills } from "@/lib/clawhubIndex";
import type { LitmusGrade } from "@/lib/hostedGrades";

/** A trust index for one ecosystem. */
export interface Ecosystem {
  slug: string;
  /** Destination page (e.g. "/base"). */
  href: string;
  name: string;
  blurb: string;
  /** Live stats for the card, read from this ecosystem's own loader. */
  loadStats: () => Promise<EcosystemStats>;
}

/** Card stats: the ordered, non-zero grade counts for the distribution strip
 *  (same shape /base and /bankr build inline), plus a one-line summary and the
 *  date this ecosystem was last re-graded. */
export interface EcosystemStats {
  counts: Array<{ g: LitmusGrade; n: number }>;
  graded: number;
  summary: string;
  /** Newest hosted_runs.completed_at across the ecosystem's graded members, as a
   *  YYYY-MM-DD date; null when nothing is graded yet. This is the honest "last
   *  refreshed" stamp — the day the snapshot was taken, not a promise of a cadence. */
  lastRefreshed: string | null;
}

const GRADE_ORDER: LitmusGrade[] = ["A", "B", "C", "D", "F"];

/** Newest of a set of (possibly null) ISO timestamps, as a YYYY-MM-DD date.
 *  ISO strings sort lexicographically, so max() is the latest run. null when the
 *  ecosystem has no graded members yet. */
function latestRefreshed(times: Array<string | null | undefined>): string | null {
  const dates = times.filter((t): t is string => Boolean(t));
  if (dates.length === 0) return null;
  return dates.reduce((a, b) => (a > b ? a : b)).slice(0, 10);
}

/** Tally a flat list of (possibly null) grades into the A→F, zero-dropped
 *  `{ g, n }[]` the distribution bar expects — the same reduction the existing
 *  pages do over their own rows. */
function distribution(grades: Array<LitmusGrade | string | null>): EcosystemStats["counts"] {
  return GRADE_ORDER.map((g) => ({ g, n: grades.filter((x) => x === g).length })).filter((c) => c.n > 0);
}

export const ECOSYSTEMS: Ecosystem[] = [
  {
    slug: "base",
    href: "/base",
    name: "Base network",
    blurb:
      "MCP servers an onchain agent on Base can use — the projects integrating Base MCP, plus the wider DeFi, data, and infrastructure servers around the network.",
    async loadStats() {
      const entries = await loadBaseIndex();
      const graded = entries.filter((e) => e.grade);
      return {
        counts: distribution(graded.map((e) => e.grade)),
        graded: graded.length,
        summary: `${graded.length} graded · ${entries.length} tracked`,
        lastRefreshed: latestRefreshed(graded.map((e) => e.completedAt)),
      };
    },
  },
  {
    slug: "bankr",
    href: "/bankr",
    name: "Bankr ecosystem",
    blurb:
      "Static safety grades for the Bankr skill library, plus behavioral grades for the agents that ship their own MCP server.",
    async loadStats() {
      const [skills, agents] = await Promise.all([loadBankrSkills(), loadBankrAgents()]);
      const grades = [...skills.map((s) => s.grade), ...agents.map((a) => a.grade)];
      return {
        counts: distribution(grades),
        graded: grades.filter(Boolean).length,
        summary: `${skills.length} skills · ${agents.length} agents`,
        lastRefreshed: latestRefreshed([
          ...skills.map((s) => s.completedAt),
          ...agents.map((a) => a.completedAt),
        ]),
      };
    },
  },
  {
    slug: "virtuals",
    href: "/virtuals",
    name: "Virtuals Protocol",
    blurb:
      "Behavioral grades for the MCP surface of the Virtuals agent launchpad on Base — the protocol's own commerce and framework infrastructure, and the agents launched on it.",
    async loadStats() {
      const entries = await loadVirtualsIndex();
      const graded = entries.filter((e) => e.grade);
      return {
        counts: distribution(graded.map((e) => e.grade)),
        graded: graded.length,
        summary: `${graded.length} graded · ${entries.length} tracked`,
        lastRefreshed: latestRefreshed(graded.map((e) => e.completedAt)),
      };
    },
  },
  {
    slug: "uniswap",
    href: "/uniswap",
    name: "Uniswap builder skills",
    blurb:
      "Static safety grades for the community “build on Uniswap” skills carried in the Bankr library — v4 hooks, trading, and client-integration helpers.",
    async loadStats() {
      const skills = await loadUniswapSkills();
      const grades = skills.map((s) => s.grade);
      return {
        counts: distribution(grades),
        graded: grades.filter(Boolean).length,
        summary: `${skills.length} skills`,
        lastRefreshed: latestRefreshed(skills.map((s) => s.completedAt)),
      };
    },
  },
  {
    slug: "clawhub",
    href: "/clawhub",
    name: "ClawHub registry",
    blurb:
      "Static safety grades for skills distributed through ClawHub — the malicious skills Snyk flagged (graded D under litmus-skill-v3) next to the popular ones an agent would install.",
    async loadStats() {
      const skills = await loadClawhubSkills();
      const grades = skills.map((s) => s.grade);
      return {
        counts: distribution(grades),
        graded: grades.filter(Boolean).length,
        summary: `${skills.length} skills`,
        lastRefreshed: latestRefreshed(skills.map((s) => s.completedAt)),
      };
    },
  },
  {
    slug: "skills-sh",
    href: "/skills-sh",
    name: "skills.sh directory",
    blurb:
      "Static safety grades for the most-installed skills on skills.sh — Vercel’s open Agent Skills directory — a behavioral A–F verdict alongside its dependency alerts.",
    async loadStats() {
      const skills = await loadSkillsShSkills();
      const grades = skills.map((s) => s.grade);
      return {
        counts: distribution(grades),
        graded: grades.filter(Boolean).length,
        summary: `${skills.length} skills`,
        lastRefreshed: latestRefreshed(skills.map((s) => s.completedAt)),
      };
    },
  },
];
