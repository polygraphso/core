import "server-only";

/**
 * Data layer for the (unlisted) Base MCP ecosystem index at /base.
 *
 * Base MCP is a single hosted gateway (mcp.base.org); its "plugins" are markdown
 * specs that orchestrate a protocol via an HTTP tx-builder, a CLI, or that
 * protocol's OWN ("sibling") MCP server. Only that last case is independently
 * gradeable — so this index grades the *projects' own* MCP servers, not the Base
 * gateway plugin (which isn't a separately-connectable surface).
 *
 * Grades are read straight from `hosted_runs` by the service-role client and are
 * shown REGARDLESS of `published_at` — i.e. this page surfaces grade-only rows
 * the public badge/CLI path (which is published-only) does not. That is what
 * keeps it private: a row appears here the moment it is graded, and nowhere
 * public until someone explicitly publishes it.
 */

import { getSupabaseAdmin } from "@/lib/supabase";
import {
  HOSTED_GRADE_COLUMNS,
  detailFromRow,
  type HostedGradeRow,
  type LitmusGrade,
  type PolygraphDetail,
} from "@/lib/hostedGrades";

export type Cohort = "new-13" | "original-7";

/** Why a project with its own MCP isn't graded yet (null once a grade exists). */
export type Pending = "free-key" | "api-key" | "clone-build" | null;

export interface BaseEntry {
  project: string;
  handle: string; // X handle, without the @
  category: string;
  cohort: Cohort;
  /** Does the project ship its OWN standalone MCP server (vs HTTP/CLI/SDK only)? */
  ownMcp: boolean;
  /** The MCP ref/endpoint, for display — even when not yet graded. */
  mcpRef: string | null;
  /** The exact ref that was graded on the hosted runner (null = not graded yet). */
  target: string | null;
  /** If it has an MCP but isn't graded yet, why. */
  pending: Pending;
  note?: string;
}

// The 13 projects Base named (jun 23 thread) + the two original-7 plugins that
// also ship their own hosted MCP (Morpho, Virtuals). ownMcp / mcpRef / target
// come from the jun-24 sourcing pass; target is set only for refs graded on the
// hosted runner.
export const BASE_ENTRIES: BaseEntry[] = [
  // --- graded (own MCP, ref submitted to the hosted runner) ---
  { project: "Printr", handle: "printr", category: "token launchpad", cohort: "new-13", ownMcp: true, mcpRef: "npm/@printr/mcp", target: "npm/@printr/mcp", pending: null },
  { project: "Clawnch", handle: "Clawnch_Bot", category: "launches", cohort: "new-13", ownMcp: true, mcpRef: "npm/clawnch-mcp-server", target: "npm/clawnch-mcp-server", pending: null },
  { project: "Flaunch", handle: "flaunchgg", category: "token launches", cohort: "new-13", ownMcp: true, mcpRef: "https://mcp.flaunch.gg/", target: "https://mcp.flaunch.gg/", pending: null },
  { project: "Brickken", handle: "Brickken", category: "RWA tokenization", cohort: "new-13", ownMcp: true, mcpRef: "https://mcp.brickken.com/mcp", target: "https://mcp.brickken.com/mcp", pending: null },
  { project: "Morpho", handle: "MorphoLabs", category: "lending", cohort: "original-7", ownMcp: true, mcpRef: "https://mcp.morpho.org/", target: "https://mcp.morpho.org/", pending: null },
  { project: "Virtuals", handle: "virtuals_io", category: "agent platform", cohort: "original-7", ownMcp: true, mcpRef: "https://mcp.acp.virtuals.io/", target: "https://mcp.acp.virtuals.io/", pending: null },

  // --- own MCP, grade pending (needs a key, or a clone+build) ---
  { project: "OpenSea", handle: "opensea", category: "NFT marketplace", cohort: "new-13", ownMcp: true, mcpRef: "https://mcp.opensea.io/mcp", target: null, pending: "free-key", note: "hosted MCP, free instant agent key" },
  { project: "Venice", handle: "AskVenice", category: "private AI inference", cohort: "new-13", ownMcp: true, mcpRef: "npm/@veniceai/mcp-server", target: null, pending: "api-key", note: "needs a Venice API key" },
  { project: "Bitrefill", handle: "bitrefill", category: "gift cards", cohort: "new-13", ownMcp: true, mcpRef: "npm/bitrefill-mcp-server", target: null, pending: "api-key", note: "needs a Bitrefill API key" },
  { project: "KyberSwap", handle: "KyberNetwork", category: "DEX aggregation", cohort: "new-13", ownMcp: true, mcpRef: "github/KyberNetwork/kyberswap-mcp", target: null, pending: "clone-build", note: "first-party MCP, github-only (clone + build)" },

  // --- no standalone MCP (HTTP API / CLI / SDK only — not independently gradeable) ---
  { project: "GMGN", handle: "gmgnai", category: "token discovery", cohort: "new-13", ownMcp: false, mcpRef: null, target: null, pending: null, note: "Skills + CLI + REST API" },
  { project: "Hydrex", handle: "HydrexFi", category: "DeFi", cohort: "new-13", ownMcp: false, mcpRef: null, target: null, pending: null, note: "Base-MCP skill + SDK" },
  { project: "o1.exchange", handle: "o1_exchange", category: "exchange", cohort: "new-13", ownMcp: false, mcpRef: null, target: null, pending: null, note: "REST trading API" },
  { project: "Balancer", handle: "Balancer", category: "AMM / liquidity", cohort: "new-13", ownMcp: false, mcpRef: null, target: null, pending: null, note: "SDK only (CLI-only plugin)" },
  { project: "YO", handle: "yield", category: "yield vaults", cohort: "new-13", ownMcp: false, mcpRef: null, target: null, pending: null, note: "SDK + REST API" },
];

export interface GradedEntry extends BaseEntry {
  grade: LitmusGrade | null;
  detail: PolygraphDetail | null;
  completedAt: string | null;
}

/** Latest grade for one `target`, any publish state, ordered by completion. */
async function latestForTarget(
  db: ReturnType<typeof getSupabaseAdmin>,
  target: string,
): Promise<{ grade: LitmusGrade; detail: PolygraphDetail; completedAt: string | null } | null> {
  if (!db) return null;
  // Tolerate a trailing-slash normalization difference in the stored serverRef.
  const variants = Array.from(
    new Set([target, target.replace(/\/+$/, ""), target.endsWith("/") ? target : `${target}/`]),
  );
  const { data, error } = await db
    .from("hosted_runs")
    .select(`${HOSTED_GRADE_COLUMNS}, completed_at`)
    .in("target", variants)
    .eq("status", "complete")
    .order("completed_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (error || !data) return null;
  const res = detailFromRow(data as HostedGradeRow);
  if (!res) return null;
  return { ...res, completedAt: (data as { completed_at?: string | null }).completed_at ?? null };
}

/** Load every Base entry with its live grade (null when unconfigured/ungraded). */
export async function loadBaseIndex(): Promise<GradedEntry[]> {
  const db = getSupabaseAdmin();
  const out: GradedEntry[] = [];
  for (const e of BASE_ENTRIES) {
    const g = e.target ? await latestForTarget(db, e.target) : null;
    out.push({ ...e, grade: g?.grade ?? null, detail: g?.detail ?? null, completedAt: g?.completedAt ?? null });
  }
  return out;
}
