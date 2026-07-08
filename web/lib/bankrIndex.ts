import "server-only";

import { getSupabaseAdmin } from "@/lib/supabase";
import { latestForTarget } from "@/lib/hostedGrades";

/** Static skill-safety grade (litmus-skill-v2): A = clean static scan; D/F flagged. */
export type SkillGrade = "A" | "B" | "D" | "F";
export type SkillCohort = "bankr" | "base" | "uniswap" | "eth-tools" | "aeon" | "other";

export const SKILL_COHORT_LABEL: Record<SkillCohort, string> = {
  bankr: "Bankr",
  base: "Base",
  uniswap: "Uniswap",
  "eth-tools": "Eth tooling",
  aeon: "Aeon research",
  other: "Integrations & community",
};
export const SKILL_COHORT_ORDER: SkillCohort[] = ["bankr", "base", "uniswap", "eth-tools", "aeon", "other"];

/** Editorial metadata for a Bankr skill. The grade is NOT stored here — it is read
 *  live from `hosted_runs` per request (see {@link loadBankrSkills}), the same as the
 *  agents and /base, so the page tracks the grader. cohort/featured are curation. */
export interface BankrSkillMeta {
  slug: string;
  cohort: SkillCohort;
  featured: boolean;
}

/** A skill's metadata joined to its LIVE litmus-skill-v2 grade (null until graded). */
export interface BankrSkill extends BankrSkillMeta {
  /** Canonical hosted_runs target / `/skill` report ref (`github/BankrBot/skills#<slug>`). */
  target: string;
  grade: SkillGrade | null;
  s01: "pass" | "fail" | null;
  s03: "pass" | "fail" | null;
  s04: "pass" | "fail" | null;
  hash: string | null;
  /** When this skill was last graded (hosted_runs.completed_at, ISO); null until graded. */
  completedAt: string | null;
}

/**
 * The BankrBot/skills library, graded by litmus-skill-v2 (a deterministic STATIC scan
 * — S-01 prompt-injection, S-03 exfil instructions, S-04 dangerous bundled commands).
 * Only the curation lives here; the letter + per-category results are read LIVE from
 * hosted_runs (loadBankrSkills), graded on the runner from `github/BankrBot/skills#<slug>`.
 * NOT behavioral proof — a skill's instructions are interpreted by an agent at runtime.
 */
export const BANKR_SKILLS_META: BankrSkillMeta[] = [
  { slug: "bankr", cohort: "bankr", featured: false },
  { slug: "bankr-shopify", cohort: "bankr", featured: false },
  { slug: "bankr-token-scam-analysis", cohort: "bankr", featured: false },
  { slug: "bankr-twitter-agent", cohort: "bankr", featured: true },
  { slug: "base", cohort: "base", featured: false },
  { slug: "base-account", cohort: "base", featured: true },
  { slug: "base-deploy", cohort: "base", featured: false },
  { slug: "base-minikit", cohort: "base", featured: false },
  { slug: "base-network", cohort: "base", featured: false },
  { slug: "base-node", cohort: "base", featured: false },
  { slug: "uniswap-cca", cohort: "uniswap", featured: false },
  { slug: "uniswap-driver", cohort: "uniswap", featured: false },
  { slug: "uniswap-hooks", cohort: "uniswap", featured: false },
  { slug: "uniswap-trading", cohort: "uniswap", featured: true },
  { slug: "uniswap-viem", cohort: "uniswap", featured: false },
  { slug: "ethskills-addresses", cohort: "eth-tools", featured: false },
  { slug: "ethskills-audit", cohort: "eth-tools", featured: false },
  { slug: "ethskills-building-blocks", cohort: "eth-tools", featured: false },
  { slug: "ethskills-frontend-playbook", cohort: "eth-tools", featured: false },
  { slug: "ethskills-frontend-ux", cohort: "eth-tools", featured: false },
  { slug: "ethskills-gas", cohort: "eth-tools", featured: false },
  { slug: "ethskills-indexing", cohort: "eth-tools", featured: false },
  { slug: "ethskills-l2s", cohort: "eth-tools", featured: false },
  { slug: "ethskills-orchestration", cohort: "eth-tools", featured: false },
  { slug: "ethskills-qa", cohort: "eth-tools", featured: false },
  { slug: "ethskills-security", cohort: "eth-tools", featured: true },
  { slug: "ethskills-standards", cohort: "eth-tools", featured: false },
  { slug: "ethskills-testing", cohort: "eth-tools", featured: false },
  { slug: "ethskills-tools", cohort: "eth-tools", featured: false },
  { slug: "ethskills-wallets", cohort: "eth-tools", featured: false },
  { slug: "ethskills-why", cohort: "eth-tools", featured: false },
  { slug: "aeon-autoresearch", cohort: "aeon", featured: false },
  { slug: "aeon-deal-flow", cohort: "aeon", featured: false },
  { slug: "aeon-deep-research", cohort: "aeon", featured: false },
  { slug: "aeon-defi-monitor", cohort: "aeon", featured: false },
  { slug: "aeon-defi-overview", cohort: "aeon", featured: false },
  { slug: "aeon-distribute-tokens", cohort: "aeon", featured: false },
  { slug: "aeon-hacker-news-digest", cohort: "aeon", featured: false },
  { slug: "aeon-huggingface-trending", cohort: "aeon", featured: false },
  { slug: "aeon-last30", cohort: "aeon", featured: false },
  { slug: "aeon-monitor-kalshi", cohort: "aeon", featured: false },
  { slug: "aeon-monitor-polymarket", cohort: "aeon", featured: false },
  { slug: "aeon-monitor-runners", cohort: "aeon", featured: false },
  { slug: "aeon-narrative-tracker", cohort: "aeon", featured: false },
  { slug: "aeon-on-chain-monitor", cohort: "aeon", featured: false },
  { slug: "aeon-paper-pick", cohort: "aeon", featured: false },
  { slug: "aeon-reg-monitor", cohort: "aeon", featured: false },
  { slug: "aeon-rss-digest", cohort: "aeon", featured: false },
  { slug: "aeon-skill-evals", cohort: "aeon", featured: false },
  { slug: "aeon-skill-repair", cohort: "aeon", featured: false },
  { slug: "aeon-token-movers", cohort: "aeon", featured: false },
  { slug: "aeon-token-pick", cohort: "aeon", featured: false },
  { slug: "aeon-unlock-monitor", cohort: "aeon", featured: false },
  { slug: "aeon-vuln-scanner", cohort: "aeon", featured: false },
  { slug: "aeon-skill-security-scan", cohort: "aeon", featured: false },
  { slug: "0xwork", cohort: "other", featured: false },
  { slug: "agent-wormhole", cohort: "other", featured: false },
  { slug: "agenticbets", cohort: "other", featured: false },
  { slug: "alchemy", cohort: "other", featured: true },
  { slug: "berry-juicer", cohort: "other", featured: false },
  { slug: "blueagent", cohort: "other", featured: false },
  { slug: "botchan", cohort: "other", featured: false },
  { slug: "capacitr", cohort: "other", featured: false },
  { slug: "cattown", cohort: "other", featured: false },
  { slug: "checkr", cohort: "other", featured: false },
  { slug: "clanker", cohort: "other", featured: false },
  { slug: "codegrid", cohort: "other", featured: false },
  { slug: "darksol-random-oracle", cohort: "other", featured: false },
  { slug: "endaoment", cohort: "other", featured: false },
  { slug: "ens-primary-name", cohort: "other", featured: false },
  { slug: "erc-8004", cohort: "other", featured: false },
  { slug: "gem-miner", cohort: "other", featured: false },
  { slug: "helixa", cohort: "other", featured: false },
  { slug: "hermesone", cohort: "other", featured: false },
  { slug: "hydrex", cohort: "other", featured: false },
  { slug: "litcoin", cohort: "other", featured: false },
  { slug: "megapot", cohort: "other", featured: false },
  { slug: "moltycash", cohort: "other", featured: false },
  { slug: "neynar", cohort: "other", featured: false },
  { slug: "nookplot", cohort: "other", featured: false },
  { slug: "onchainkit", cohort: "other", featured: false },
  { slug: "opensea", cohort: "other", featured: false },
  { slug: "orlix", cohort: "other", featured: false },
  { slug: "pmfi-parbitrage", cohort: "other", featured: false },
  { slug: "productclank", cohort: "other", featured: false },
  { slug: "qrcoin", cohort: "other", featured: false },
  { slug: "quicknode", cohort: "other", featured: false },
  { slug: "signa", cohort: "other", featured: false },
  { slug: "signals", cohort: "other", featured: false },
  { slug: "siwa", cohort: "other", featured: false },
  { slug: "stakr", cohort: "other", featured: false },
  { slug: "symbiosis", cohort: "other", featured: false },
  { slug: "trails", cohort: "other", featured: false },
  { slug: "trustlayer-sybil-scanner", cohort: "other", featured: false },
  { slug: "veil", cohort: "other", featured: false },
  { slug: "versa", cohort: "other", featured: false },
  { slug: "wake-token-spotter-analysis", cohort: "other", featured: false },
  { slug: "yoink", cohort: "other", featured: false },
  { slug: "zapper", cohort: "other", featured: false },
  { slug: "zerion", cohort: "other", featured: true },
  { slug: "zyfai", cohort: "other", featured: false },
  { slug: "1claw", cohort: "other", featured: false },
  { slug: "azzle", cohort: "other", featured: false },
  { slug: "hunch", cohort: "other", featured: false },
  { slug: "nexus-trading-labs", cohort: "other", featured: false },
  { slug: "starchild-dao", cohort: "other", featured: false },
  { slug: "gitlawb", cohort: "other", featured: false },
];

/** The GitHub repo holding the Bankr skill library; the runner stores each skill's
 *  grade under `${BANKR_SKILLS_REPO}#<slug>`, which is also its `/skill` report ref. */
const BANKR_SKILLS_REPO = "github/BankrBot/skills";

/** Canonical hosted_runs target (and `/skill` ref) for a Bankr skill. */
export function bankrSkillTarget(slug: string): string {
  return `${BANKR_SKILLS_REPO}#${slug}`;
}

type SkillLive = { grade: SkillGrade; s01: "pass" | "fail"; s03: "pass" | "fail"; s04: "pass" | "fail"; hash: string; completedAt: string | null };

/** One query → latest litmus-skill-v2 grade per BankrBot/skills target, keyed by the
 *  canonical `github/BankrBot/skills#<slug>` ref the runner stores. Newest row wins;
 *  S-01/S-03/S-04 come from the evidence bundle (skill rows leave c01–c03 null). */
async function fetchSkillGradeMap(db: ReturnType<typeof getSupabaseAdmin>): Promise<Map<string, SkillLive>> {
  const map = new Map<string, SkillLive>();
  if (!db) return map;
  const { data, error } = await db
    .from("hosted_runs")
    .select("target, grade, content_hash, evidence, completed_at")
    .eq("target_kind", "skill")
    .like("target", `${BANKR_SKILLS_REPO}#%`)
    .eq("status", "complete")
    .order("completed_at", { ascending: false });
  if (error || !data) return map;
  const SKILL_GRADES = new Set(["A", "B", "D", "F"]);
  for (const row of data as Array<{
    target: string;
    grade: string | null;
    content_hash: string | null;
    evidence: { categories?: Array<{ code?: string; status?: string }> } | null;
    completed_at: string | null;
  }>) {
    if (map.has(row.target)) continue; // ordered desc → first (newest) wins
    if (!row.grade || !SKILL_GRADES.has(row.grade)) continue;
    const cats = row.evidence?.categories ?? [];
    const st = (code: string): "pass" | "fail" => (cats.find((c) => c.code === code)?.status === "fail" ? "fail" : "pass");
    map.set(row.target, {
      grade: row.grade as SkillGrade,
      s01: st("S-01"),
      s03: st("S-03"),
      s04: st("S-04"),
      hash: row.content_hash ? row.content_hash.slice(0, 12) : "",
      completedAt: row.completed_at ?? null,
    });
  }
  return map;
}

/** Skill rows joined to their LIVE litmus-skill-v2 grades from hosted_runs, so the page
 *  tracks the grader instead of embedding a snapshot. Ungraded → grade null. */
export async function loadBankrSkills(): Promise<BankrSkill[]> {
  const map = await fetchSkillGradeMap(getSupabaseAdmin());
  return BANKR_SKILLS_META.map((m) => {
    const target = bankrSkillTarget(m.slug);
    const g = map.get(target);
    return { ...m, target, grade: g?.grade ?? null, s01: g?.s01 ?? null, s03: g?.s03 ?? null, s04: g?.s04 ?? null, hash: g?.hash ?? null, completedAt: g?.completedAt ?? null };
  });
}

export type AgentGrade = "A" | "B" | "C" | "D" | "F";

/** Static metadata for an agent's MCP server. The letter grade is NOT stored here —
 *  it is read live from `hosted_runs` per request (see {@link loadBankrAgents}), the
 *  same way /base works, so the page can never drift from the grader. `target` is the
 *  hosted_runs target to look up; null = not gradeable as-published (no row exists). */
export interface BankrAgentMeta {
  project: string;
  handle: string;
  mcpRef: string;
  /** hosted_runs `target` for the live grade lookup; null when ungradeable as-published. */
  target: string | null;
  note: string;
}

/** A metadata row joined to its LIVE grade (null when ungradeable / not yet graded). */
export interface BankrAgent extends BankrAgentMeta {
  grade: AgentGrade | null;
  c01: string | null;
  c02: string | null;
  c03: string | null;
  /** When this agent's server was last graded (hosted_runs.completed_at, ISO); null until graded. */
  completedAt: string | null;
}

/**
 * Agents from bankr.bot/agents that ship their OWN MCP server. The ecosystem
 * standardizes on skills + x402 + ERC-8004, so connectable MCP servers stay rare:
 * a 2026-07-08 sweep of the ~90-agent roster surfaced these seven. nookplot and
 * Blue Agent publish a server litmus can launch from a bare npm ref (graded LIVE
 * below); gitlawb, Azzle, Noelclaw, 1Claw, and VIGIL ship real servers that are not
 * gradeable as-published (target=null, with the reason in each note).
 */
export const BANKR_AGENTS_META: BankrAgentMeta[] = [
  { project: "nookplot", handle: "nookplot", mcpRef: "npm/@nookplot/mcp", target: "npm/@nookplot/mcp", note: "decentralized agent-coordination network" },
  { project: "Blue Agent", handle: "blockyagent", mcpRef: "npm/@blueagent/skill", target: "npm/@blueagent/skill", note: "50-tool stdio MCP server (security OS for agents)" },
  { project: "gitlawb", handle: "Gitlawb", mcpRef: "stdio · gl mcp serve", target: null, note: "ships a standard stdio MCP server (24 git/identity tools), but the gl CLI is a precompiled static binary (published as per-platform @gitlawb/gl-linux-* packages) and the server sits behind a gl mcp serve subcommand; litmus launches declared bins bare and its sandbox builds only Node or Python sources, so it cannot reach the server" },
  { project: "Azzle", handle: "dabusthebuilder", mcpRef: "npm/@azzle/agents", target: null, note: "ships a stdio MCP server (~10 azzle_* tools) inside @azzle/agents at mcp/server.mjs, but that file is a subpath, not the package's declared bin or main, so neither a bare npm ref nor litmus's github build (which derives its start command from the root package manifest) can launch it" },
  { project: "Noelclaw", handle: "noelclaw", mcpRef: "npm/@noelclaw/mcp", target: null, note: "publishes a real 108-tool stdio MCP server, but it does not complete a litmus probe within the harness's 15-minute run budget (it stands up persistent memory, autonomous agents, and scheduled workflows on connect), so every run times out instead of producing a grade" },
  { project: "1Claw", handle: "1clawAI", mcpRef: "npm/@1claw/mcp", target: null, note: "publishes a real stdio MCP server for its secrets vault, but the bin requires ONECLAW_* auth credentials at startup and exits before the MCP handshake without them, so it is not gradeable from a bare npm ref (there is no way to pass a vault key into a bare-ref grade)" },
  { project: "VIGIL", handle: "vigilcodes", mcpRef: "https://mcp.vigil.codes", target: null, note: "ships a real MCP server, but it is an HTTP/x402 remote service (open source as a Python app at github.com/vigilcodes/vigil-mcp), so there is no stdio initialize handshake for litmus to grade; the live https://mcp.vigil.codes endpoint does not answer one either" },
];

/** The agent rows joined to their LIVE grades from hosted_runs (any publish state),
 *  so the page stays in lockstep with the grader instead of hardcoding a letter.
 *  Uses the shared grade-only lookup (lib/hostedGrades) — same rows /base reads. */
export async function loadBankrAgents(): Promise<BankrAgent[]> {
  const db = getSupabaseAdmin();
  return Promise.all(
    BANKR_AGENTS_META.map(async (m) => {
      const g = m.target ? await latestForTarget(db, m.target) : null;
      const d = g?.detail ?? null;
      return { ...m, grade: d?.grade ?? null, c01: d?.c01 ?? null, c02: d?.c02 ?? null, c03: d?.c03 ?? null, completedAt: g?.completedAt ?? null };
    }),
  );
}
