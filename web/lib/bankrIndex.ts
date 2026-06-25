import "server-only";

import { getSupabaseAdmin } from "@/lib/supabase";
import {
  detailFromRow,
  HOSTED_GRADE_COLUMNS,
  type HostedGradeRow,
  type PolygraphDetail,
} from "@/lib/hostedGrades";

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

export interface BankrSkill {
  slug: string;
  grade: SkillGrade;
  cohort: SkillCohort;
  featured: boolean;
  s01: "pass" | "fail";
  s03: "pass" | "fail";
  s04: "pass" | "fail";
  hash: string;
}

/**
 * Static safety grades for the BankrBot/skills library (litmus-skill-v2: a
 * deterministic STATIC scan — S-01 prompt-injection, S-03 exfil instructions,
 * S-04 dangerous bundled commands). A snapshot; reproduce any grade with
 * `npx -p @polygraphso/litmus polygraphso-litmus-skill <skill-dir>`. NOT
 * behavioral proof — a skill's instructions are interpreted by an agent at runtime.
 */
export const BANKR_SKILLS: BankrSkill[] = [
  { slug: "bankr", grade: "A", cohort: "bankr", featured: false, s01: "pass", s03: "pass", s04: "pass", hash: "0x310d960a32" },
  { slug: "bankr-shopify", grade: "A", cohort: "bankr", featured: false, s01: "pass", s03: "pass", s04: "pass", hash: "0x21ccdfa3d3" },
  { slug: "bankr-token-scam-analysis", grade: "A", cohort: "bankr", featured: false, s01: "pass", s03: "pass", s04: "pass", hash: "0x87c96b78e1" },
  { slug: "bankr-twitter-agent", grade: "A", cohort: "bankr", featured: true, s01: "pass", s03: "pass", s04: "pass", hash: "0x78fb68cbab" },
  { slug: "base", grade: "A", cohort: "base", featured: false, s01: "pass", s03: "pass", s04: "pass", hash: "0x4de9525f51" },
  { slug: "base-account", grade: "A", cohort: "base", featured: true, s01: "pass", s03: "pass", s04: "pass", hash: "0x9af0f78727" },
  { slug: "base-deploy", grade: "A", cohort: "base", featured: false, s01: "pass", s03: "pass", s04: "pass", hash: "0x93295cca35" },
  { slug: "base-minikit", grade: "A", cohort: "base", featured: false, s01: "pass", s03: "pass", s04: "pass", hash: "0x7f5cb68bf4" },
  { slug: "base-network", grade: "A", cohort: "base", featured: false, s01: "pass", s03: "pass", s04: "pass", hash: "0x878b4cb3cb" },
  { slug: "base-node", grade: "A", cohort: "base", featured: false, s01: "pass", s03: "pass", s04: "pass", hash: "0xdc7cc53f84" },
  { slug: "uniswap-cca", grade: "A", cohort: "uniswap", featured: false, s01: "pass", s03: "pass", s04: "pass", hash: "0x3fd02809af" },
  { slug: "uniswap-driver", grade: "A", cohort: "uniswap", featured: false, s01: "pass", s03: "pass", s04: "pass", hash: "0x73dc738318" },
  { slug: "uniswap-hooks", grade: "A", cohort: "uniswap", featured: false, s01: "pass", s03: "pass", s04: "pass", hash: "0x4c71878e5c" },
  { slug: "uniswap-trading", grade: "A", cohort: "uniswap", featured: true, s01: "pass", s03: "pass", s04: "pass", hash: "0x099c8adced" },
  { slug: "uniswap-viem", grade: "A", cohort: "uniswap", featured: false, s01: "pass", s03: "pass", s04: "pass", hash: "0x63d53cdb7b" },
  { slug: "ethskills-addresses", grade: "A", cohort: "eth-tools", featured: false, s01: "pass", s03: "pass", s04: "pass", hash: "0xea93524b15" },
  { slug: "ethskills-audit", grade: "A", cohort: "eth-tools", featured: false, s01: "pass", s03: "pass", s04: "pass", hash: "0x743ab7b903" },
  { slug: "ethskills-building-blocks", grade: "A", cohort: "eth-tools", featured: false, s01: "pass", s03: "pass", s04: "pass", hash: "0x6daa0807ef" },
  { slug: "ethskills-frontend-playbook", grade: "A", cohort: "eth-tools", featured: false, s01: "pass", s03: "pass", s04: "pass", hash: "0x13d7515b94" },
  { slug: "ethskills-frontend-ux", grade: "A", cohort: "eth-tools", featured: false, s01: "pass", s03: "pass", s04: "pass", hash: "0x200389d87a" },
  { slug: "ethskills-gas", grade: "A", cohort: "eth-tools", featured: false, s01: "pass", s03: "pass", s04: "pass", hash: "0x1be4de75f4" },
  { slug: "ethskills-indexing", grade: "A", cohort: "eth-tools", featured: false, s01: "pass", s03: "pass", s04: "pass", hash: "0x91680d3011" },
  { slug: "ethskills-l2s", grade: "A", cohort: "eth-tools", featured: false, s01: "pass", s03: "pass", s04: "pass", hash: "0xca8b9f7da9" },
  { slug: "ethskills-orchestration", grade: "A", cohort: "eth-tools", featured: false, s01: "pass", s03: "pass", s04: "pass", hash: "0xaf2b05b703" },
  { slug: "ethskills-qa", grade: "A", cohort: "eth-tools", featured: false, s01: "pass", s03: "pass", s04: "pass", hash: "0xfa7973b9ff" },
  { slug: "ethskills-security", grade: "A", cohort: "eth-tools", featured: true, s01: "pass", s03: "pass", s04: "pass", hash: "0x447bb78671" },
  { slug: "ethskills-standards", grade: "A", cohort: "eth-tools", featured: false, s01: "pass", s03: "pass", s04: "pass", hash: "0x1fb6aa243b" },
  { slug: "ethskills-testing", grade: "A", cohort: "eth-tools", featured: false, s01: "pass", s03: "pass", s04: "pass", hash: "0x0352444e74" },
  { slug: "ethskills-tools", grade: "A", cohort: "eth-tools", featured: false, s01: "pass", s03: "pass", s04: "pass", hash: "0x1e0510e758" },
  { slug: "ethskills-wallets", grade: "A", cohort: "eth-tools", featured: false, s01: "pass", s03: "pass", s04: "pass", hash: "0xfeb7a2caab" },
  { slug: "ethskills-why", grade: "A", cohort: "eth-tools", featured: false, s01: "pass", s03: "pass", s04: "pass", hash: "0x8278b76aef" },
  { slug: "aeon-autoresearch", grade: "A", cohort: "aeon", featured: false, s01: "pass", s03: "pass", s04: "pass", hash: "0x53b0a0a02e" },
  { slug: "aeon-deal-flow", grade: "A", cohort: "aeon", featured: false, s01: "pass", s03: "pass", s04: "pass", hash: "0xfa5ef69f72" },
  { slug: "aeon-deep-research", grade: "A", cohort: "aeon", featured: false, s01: "pass", s03: "pass", s04: "pass", hash: "0xce249e707a" },
  { slug: "aeon-defi-monitor", grade: "A", cohort: "aeon", featured: false, s01: "pass", s03: "pass", s04: "pass", hash: "0x9fef169223" },
  { slug: "aeon-defi-overview", grade: "A", cohort: "aeon", featured: false, s01: "pass", s03: "pass", s04: "pass", hash: "0x75937aeeea" },
  { slug: "aeon-distribute-tokens", grade: "A", cohort: "aeon", featured: false, s01: "pass", s03: "pass", s04: "pass", hash: "0xd1f4c04433" },
  { slug: "aeon-hacker-news-digest", grade: "A", cohort: "aeon", featured: false, s01: "pass", s03: "pass", s04: "pass", hash: "0xdedbbb9d30" },
  { slug: "aeon-huggingface-trending", grade: "A", cohort: "aeon", featured: false, s01: "pass", s03: "pass", s04: "pass", hash: "0x2177ea5124" },
  { slug: "aeon-last30", grade: "A", cohort: "aeon", featured: false, s01: "pass", s03: "pass", s04: "pass", hash: "0x8718c477b0" },
  { slug: "aeon-monitor-kalshi", grade: "A", cohort: "aeon", featured: false, s01: "pass", s03: "pass", s04: "pass", hash: "0x0b08c04feb" },
  { slug: "aeon-monitor-polymarket", grade: "A", cohort: "aeon", featured: false, s01: "pass", s03: "pass", s04: "pass", hash: "0xaa1db97d2b" },
  { slug: "aeon-monitor-runners", grade: "A", cohort: "aeon", featured: false, s01: "pass", s03: "pass", s04: "pass", hash: "0x9743220af9" },
  { slug: "aeon-narrative-tracker", grade: "A", cohort: "aeon", featured: false, s01: "pass", s03: "pass", s04: "pass", hash: "0x3d0812715a" },
  { slug: "aeon-on-chain-monitor", grade: "A", cohort: "aeon", featured: false, s01: "pass", s03: "pass", s04: "pass", hash: "0xd49e7a043c" },
  { slug: "aeon-paper-pick", grade: "A", cohort: "aeon", featured: false, s01: "pass", s03: "pass", s04: "pass", hash: "0x520a43f975" },
  { slug: "aeon-reg-monitor", grade: "A", cohort: "aeon", featured: false, s01: "pass", s03: "pass", s04: "pass", hash: "0xf2e6dfe8bf" },
  { slug: "aeon-rss-digest", grade: "A", cohort: "aeon", featured: false, s01: "pass", s03: "pass", s04: "pass", hash: "0x3529842f3c" },
  { slug: "aeon-skill-evals", grade: "A", cohort: "aeon", featured: false, s01: "pass", s03: "pass", s04: "pass", hash: "0xae8a1bd315" },
  { slug: "aeon-skill-repair", grade: "A", cohort: "aeon", featured: false, s01: "pass", s03: "pass", s04: "pass", hash: "0x09b7398298" },
  { slug: "aeon-token-movers", grade: "A", cohort: "aeon", featured: false, s01: "pass", s03: "pass", s04: "pass", hash: "0x28703997ab" },
  { slug: "aeon-token-pick", grade: "A", cohort: "aeon", featured: false, s01: "pass", s03: "pass", s04: "pass", hash: "0xb45fc8e64c" },
  { slug: "aeon-unlock-monitor", grade: "A", cohort: "aeon", featured: false, s01: "pass", s03: "pass", s04: "pass", hash: "0xdc9506200e" },
  { slug: "aeon-vuln-scanner", grade: "A", cohort: "aeon", featured: false, s01: "pass", s03: "pass", s04: "pass", hash: "0xb9e131bf37" },
  { slug: "aeon-skill-security-scan", grade: "A", cohort: "aeon", featured: false, s01: "pass", s03: "pass", s04: "pass", hash: "0x815a9814e4" },
  { slug: "0xwork", grade: "A", cohort: "other", featured: false, s01: "pass", s03: "pass", s04: "pass", hash: "0xd58b4dc038" },
  { slug: "agent-wormhole", grade: "A", cohort: "other", featured: false, s01: "pass", s03: "pass", s04: "pass", hash: "0x074194908e" },
  { slug: "agenticbets", grade: "A", cohort: "other", featured: false, s01: "pass", s03: "pass", s04: "pass", hash: "0x4781e2b51b" },
  { slug: "alchemy", grade: "A", cohort: "other", featured: true, s01: "pass", s03: "pass", s04: "pass", hash: "0xb4a0b312b6" },
  { slug: "berry-juicer", grade: "A", cohort: "other", featured: false, s01: "pass", s03: "pass", s04: "pass", hash: "0xb098de3c62" },
  { slug: "blueagent", grade: "A", cohort: "other", featured: false, s01: "pass", s03: "pass", s04: "pass", hash: "0x4b89b7ff8b" },
  { slug: "botchan", grade: "A", cohort: "other", featured: false, s01: "pass", s03: "pass", s04: "pass", hash: "0xcb21f1ece0" },
  { slug: "capacitr", grade: "A", cohort: "other", featured: false, s01: "pass", s03: "pass", s04: "pass", hash: "0x0de6238b9b" },
  { slug: "cattown", grade: "A", cohort: "other", featured: false, s01: "pass", s03: "pass", s04: "pass", hash: "0x0951aef17f" },
  { slug: "checkr", grade: "A", cohort: "other", featured: false, s01: "pass", s03: "pass", s04: "pass", hash: "0x876a0ed699" },
  { slug: "clanker", grade: "A", cohort: "other", featured: false, s01: "pass", s03: "pass", s04: "pass", hash: "0xacf65e13cb" },
  { slug: "codegrid", grade: "A", cohort: "other", featured: false, s01: "pass", s03: "pass", s04: "pass", hash: "0xbbd22598a4" },
  { slug: "darksol-random-oracle", grade: "A", cohort: "other", featured: false, s01: "pass", s03: "pass", s04: "pass", hash: "0xfe3d900f4a" },
  { slug: "endaoment", grade: "A", cohort: "other", featured: false, s01: "pass", s03: "pass", s04: "pass", hash: "0x866b0c2089" },
  { slug: "ens-primary-name", grade: "A", cohort: "other", featured: false, s01: "pass", s03: "pass", s04: "pass", hash: "0x8e323f09d1" },
  { slug: "erc-8004", grade: "A", cohort: "other", featured: false, s01: "pass", s03: "pass", s04: "pass", hash: "0xf1092d124f" },
  { slug: "gem-miner", grade: "A", cohort: "other", featured: false, s01: "pass", s03: "pass", s04: "pass", hash: "0x840c5703a2" },
  { slug: "helixa", grade: "A", cohort: "other", featured: false, s01: "pass", s03: "pass", s04: "pass", hash: "0x2e8bed9dfd" },
  { slug: "hermesone", grade: "A", cohort: "other", featured: false, s01: "pass", s03: "pass", s04: "pass", hash: "0xb7341e612d" },
  { slug: "hydrex", grade: "A", cohort: "other", featured: false, s01: "pass", s03: "pass", s04: "pass", hash: "0xa54763a28f" },
  { slug: "litcoin", grade: "A", cohort: "other", featured: false, s01: "pass", s03: "pass", s04: "pass", hash: "0x92492c014b" },
  { slug: "megapot", grade: "A", cohort: "other", featured: false, s01: "pass", s03: "pass", s04: "pass", hash: "0x10ebc5092e" },
  { slug: "moltycash", grade: "A", cohort: "other", featured: false, s01: "pass", s03: "pass", s04: "pass", hash: "0x80a72db93a" },
  { slug: "neynar", grade: "A", cohort: "other", featured: false, s01: "pass", s03: "pass", s04: "pass", hash: "0xb26b44caec" },
  { slug: "nookplot", grade: "A", cohort: "other", featured: false, s01: "pass", s03: "pass", s04: "pass", hash: "0x239d8c564a" },
  { slug: "onchainkit", grade: "A", cohort: "other", featured: false, s01: "pass", s03: "pass", s04: "pass", hash: "0x18d717af30" },
  { slug: "opensea", grade: "A", cohort: "other", featured: false, s01: "pass", s03: "pass", s04: "pass", hash: "0xa8b7adb3dc" },
  { slug: "orlix", grade: "A", cohort: "other", featured: false, s01: "pass", s03: "pass", s04: "pass", hash: "0xc9ed3dd24c" },
  { slug: "pmfi-parbitrage", grade: "A", cohort: "other", featured: false, s01: "pass", s03: "pass", s04: "pass", hash: "0xd31b6c8ad7" },
  { slug: "productclank", grade: "A", cohort: "other", featured: false, s01: "pass", s03: "pass", s04: "pass", hash: "0x7907524300" },
  { slug: "qrcoin", grade: "A", cohort: "other", featured: false, s01: "pass", s03: "pass", s04: "pass", hash: "0x66dba7fdf7" },
  { slug: "quicknode", grade: "A", cohort: "other", featured: false, s01: "pass", s03: "pass", s04: "pass", hash: "0x676d31fa5f" },
  { slug: "signa", grade: "A", cohort: "other", featured: false, s01: "pass", s03: "pass", s04: "pass", hash: "0x8c108e882a" },
  { slug: "signals", grade: "A", cohort: "other", featured: false, s01: "pass", s03: "pass", s04: "pass", hash: "0xbcd835d1c2" },
  { slug: "siwa", grade: "A", cohort: "other", featured: false, s01: "pass", s03: "pass", s04: "pass", hash: "0x9771be6084" },
  { slug: "stakr", grade: "A", cohort: "other", featured: false, s01: "pass", s03: "pass", s04: "pass", hash: "0xd1b1edd483" },
  { slug: "symbiosis", grade: "A", cohort: "other", featured: false, s01: "pass", s03: "pass", s04: "pass", hash: "0x5086071246" },
  { slug: "trails", grade: "A", cohort: "other", featured: false, s01: "pass", s03: "pass", s04: "pass", hash: "0x12f97e71cc" },
  { slug: "trustlayer-sybil-scanner", grade: "A", cohort: "other", featured: false, s01: "pass", s03: "pass", s04: "pass", hash: "0x557d9c5922" },
  { slug: "veil", grade: "A", cohort: "other", featured: false, s01: "pass", s03: "pass", s04: "pass", hash: "0xf047e837ee" },
  { slug: "versa", grade: "A", cohort: "other", featured: false, s01: "pass", s03: "pass", s04: "pass", hash: "0xd5b28f8a6f" },
  { slug: "wake-token-spotter-analysis", grade: "A", cohort: "other", featured: false, s01: "pass", s03: "pass", s04: "pass", hash: "0xd58aa38b1f" },
  { slug: "yoink", grade: "A", cohort: "other", featured: false, s01: "pass", s03: "pass", s04: "pass", hash: "0x995392f3ee" },
  { slug: "zapper", grade: "A", cohort: "other", featured: false, s01: "pass", s03: "pass", s04: "pass", hash: "0x0921734184" },
  { slug: "zerion", grade: "A", cohort: "other", featured: true, s01: "pass", s03: "pass", s04: "pass", hash: "0x11b71ce559" },
  { slug: "zyfai", grade: "A", cohort: "other", featured: false, s01: "pass", s03: "pass", s04: "pass", hash: "0x49a12c1455" },
  { slug: "1claw", grade: "A", cohort: "other", featured: false, s01: "pass", s03: "pass", s04: "pass", hash: "0xcedc1a7885" },
  { slug: "azzle", grade: "A", cohort: "other", featured: false, s01: "pass", s03: "pass", s04: "pass", hash: "0xbd99583e1c" },
  { slug: "hunch", grade: "A", cohort: "other", featured: false, s01: "pass", s03: "pass", s04: "pass", hash: "0x13dc081a7c" },
  { slug: "nexus-trading-labs", grade: "A", cohort: "other", featured: false, s01: "pass", s03: "pass", s04: "pass", hash: "0x8d80757707" },
  { slug: "starchild-dao", grade: "A", cohort: "other", featured: false, s01: "pass", s03: "pass", s04: "pass", hash: "0x2ba15576f0" },
  { slug: "gitlawb", grade: "D", cohort: "other", featured: false, s01: "pass", s03: "pass", s04: "fail", hash: "0xab381a8dbd" },];

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
}

/**
 * Agents from bankr.bot/agents that ship their OWN MCP server. The ecosystem
 * standardizes on skills + x402 + ERC-8004, so connectable MCP servers are rare —
 * a deep sweep of all 68 curated agents surfaced these. nookplot and Blue Agent
 * publish a server litmus can launch from a bare npm ref (graded LIVE below); gitlawb,
 * Azzle, and VIGIL ship real servers that aren't gradeable as-published (target=null).
 */
export const BANKR_AGENTS_META: BankrAgentMeta[] = [
  { project: "nookplot", handle: "nookplot", mcpRef: "npm/@nookplot/mcp", target: "npm/@nookplot/mcp", note: "decentralized agent-coordination network" },
  { project: "Blue Agent", handle: "blockyagent", mcpRef: "npm/@blueagent/skill", target: "npm/@blueagent/skill", note: "50-tool stdio MCP server (security OS for agents)" },
  { project: "gitlawb", handle: "Gitlawb", mcpRef: "stdio · gl mcp serve", target: null, note: "ships a standard stdio MCP server (24 git/identity tools), but the gl CLI installs only via the project's curl|sh installer — the same one its skill grades D — so not gradeable as-published" },
  { project: "Azzle", handle: "dabusthebuilder", mcpRef: "npm/@azzle/agents", target: null, note: "ships a stdio MCP server (~10 azzle_* tools at agents/mcp/server.mjs), but the package's default entry isn't the server — not gradeable from a bare npm ref" },
  { project: "VIGIL", handle: "vigilcodes", mcpRef: "https://mcp.vigil.codes", target: null, note: "ships an MCP server, but a non-standard transport (no MCP initialize handshake) — not gradeable as-is" },
];

/** Latest grade for one `target`, ANY publish state, newest completion first.
 *  Mirrors /base's latestForTarget: an unlisted page reads grade-only rows directly,
 *  so we never hardcode a letter and never need to publish a third-party grade. */
async function latestForTarget(
  db: ReturnType<typeof getSupabaseAdmin>,
  target: string,
): Promise<PolygraphDetail | null> {
  if (!db) return null;
  // Tolerate a trailing-slash normalization difference in the stored target.
  const variants = Array.from(
    new Set([target, target.replace(/\/+$/, ""), target.endsWith("/") ? target : `${target}/`]),
  );
  const { data, error } = await db
    .from("hosted_runs")
    .select(HOSTED_GRADE_COLUMNS)
    .in("target", variants)
    .eq("status", "complete")
    .order("completed_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (error || !data) return null;
  return detailFromRow(data as HostedGradeRow)?.detail ?? null;
}

/** The agent rows joined to their LIVE grades from hosted_runs (any publish state),
 *  so the page stays in lockstep with the grader instead of hardcoding a letter. */
export async function loadBankrAgents(): Promise<BankrAgent[]> {
  const db = getSupabaseAdmin();
  const out: BankrAgent[] = [];
  for (const m of BANKR_AGENTS_META) {
    const d = m.target ? await latestForTarget(db, m.target) : null;
    out.push({ ...m, grade: d?.grade ?? null, c01: d?.c01 ?? null, c02: d?.c02 ?? null, c03: d?.c03 ?? null });
  }
  return out;
}
