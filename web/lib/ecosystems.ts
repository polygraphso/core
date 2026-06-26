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
 *  (same shape /base and /bankr build inline), plus a one-line summary. */
export interface EcosystemStats {
  counts: Array<{ g: LitmusGrade; n: number }>;
  graded: number;
  summary: string;
}

const GRADE_ORDER: LitmusGrade[] = ["A", "B", "C", "D", "F"];

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
      };
    },
  },
];
