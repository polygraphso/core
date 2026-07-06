import "server-only";

/**
 * Data layer for the (unlisted) Virtuals-Protocol MCP index at /virtuals.
 *
 * Scope: the MCP surface of the Virtuals Protocol ecosystem (an agent launchpad on Base)
 * — Virtuals' own protocol infrastructure (the ACP commerce gateway, the GAME framework),
 * plus the notable agents/projects launched on it and whether each ships a connectable MCP
 * server. Like /base, most ecosystem members ship NO standalone MCP server (agents launch
 * via GAME/ACP, not a bespoke server) — those are mapped honestly as "no MCP", and the
 * gradeable surface is the protocol's own endpoints plus the rare agent that ships one.
 *
 * Grades are read straight from `hosted_runs` (grade-only, any publish state, newest run
 * wins) via the shared loader — the same private, grade-tracking read /base uses.
 */

import { getSupabaseAdmin } from "@/lib/supabase";
import { decodeRef, refToPath } from "@/lib/badgeData";
import { fetchAdoptionForServer } from "@/lib/rankings";
import { latestForTarget, type LitmusGrade, type PolygraphDetail } from "@/lib/hostedGrades";

/** Display cohort. */
export type Group = "protocol" | "tooling" | "agents";

export const GROUP_LABEL: Record<Group, string> = {
  protocol: "Virtuals protocol infrastructure",
  tooling: "ACP tooling & trust layers",
  agents: "Agents launched on Virtuals",
};

export const GROUP_ORDER: Group[] = ["protocol", "tooling", "agents"];

/** Built by Virtuals / the project itself vs a third-party wrapper. */
export type Party = "first" | "third";

/** Why a server with its own MCP isn't graded yet (null once a grade exists). */
export type Pending = "free-key" | "api-key" | "clone-build" | "non-standard" | null;

export interface VirtualsEntry {
  project: string;
  handle: string; // X handle, without the @
  category: string;
  group: Group;
  party: Party;
  /** Does the project ship its OWN standalone MCP server (vs GAME/ACP/SDK/REST only)? */
  ownMcp: boolean;
  /** The MCP ref/endpoint, for display — even when not yet graded. */
  mcpRef: string | null;
  /** The exact ref submitted to the hosted runner (null = not graded). */
  target: string | null;
  /** If it has an MCP but isn't graded yet, why. */
  pending: Pending;
  note?: string;
}

// ownMcp / mcpRef / party from ecosystem sourcing. `target` is set for any ref submitted
// to the hosted runner; npm refs grade sandboxed (can reach A), https endpoints grade
// in-process (cap at B). Third-party = a community wrapper, not the project's own server.
export const VIRTUALS_ENTRIES: VirtualsEntry[] = [
  // ---------------- Virtuals protocol infrastructure ----------------
  { project: "ACP (Agent Commerce Protocol)", handle: "virtuals_io", category: "agent-to-agent commerce gateway", group: "protocol", party: "first", ownMcp: true, mcpRef: "https://mcp.acp.virtuals.io/", target: "https://mcp.acp.virtuals.io/", pending: null, note: "the ecosystem's commerce/coordination MCP gateway" },
  { project: "GAME by Virtuals", handle: "GAME_Virtuals", category: "agent framework", group: "protocol", party: "first", ownMcp: false, mcpRef: null, target: null, pending: null, note: "the agent framework/SDK (@virtuals-protocol/game) — build tool, not an MCP server" },

  // ---------------- ACP tooling & trust layers (third-party over ACP) ----------------
  { project: "ACP Find", handle: "", category: "ACP marketplace search", group: "tooling", party: "third", ownMcp: true, mcpRef: "npm/acp-find-mcp", target: "npm/acp-find-mcp", pending: null, note: "semantic search / stack composition over the ACP marketplace" },
  { project: "Maiat Protocol", handle: "", category: "agent trust oracle", group: "tooling", party: "third", ownMcp: true, mcpRef: "https://app.maiat.io/api/mcp", target: null, pending: "non-standard", note: "hosted MCP scoring agent trust over ACP job history; session-gated init — not gradeable as-published" },
  { project: "web3agent", handle: "", category: "wallet agent w/ ACP toolset", group: "tooling", party: "third", ownMcp: true, mcpRef: "npm/web3agent", target: null, pending: "api-key", note: "wires into ACP router contracts; needs a wallet/RPC config to launch — not gradeable from a bare npm ref" },
  { project: "invinoveritas", handle: "", category: "agent verification oracle", group: "tooling", party: "third", ownMcp: true, mcpRef: "https://api.babyblueviper.com/mcp", target: "https://api.babyblueviper.com/mcp", pending: null, note: "signed pre-action verdicts + recomputable proofs over ACP" },

  // ---------------- Agents launched on Virtuals (no standalone MCP) ----------------
  { project: "AIXBT", handle: "aixbt_agent", category: "crypto-market intelligence", group: "agents", party: "first", ownMcp: false, mcpRef: null, target: null, pending: null, note: "flagship market-intel agent — no public MCP" },
  { project: "Luna", handle: "luna_virtuals", category: "entertainment / VTuber agent", group: "agents", party: "first", ownMcp: false, mcpRef: null, target: null, pending: null, note: "autonomous entertainment agent" },
  { project: "VaderAI", handle: "Vader_AI_", category: "AI-agent DAO / investing", group: "agents", party: "first", ownMcp: false, mcpRef: null, target: null, pending: null, note: "agent-run investment DAO" },
  { project: "Wayfinder", handle: "AIWayfinder", category: "omnichain agent protocol", group: "agents", party: "first", ownMcp: false, mcpRef: null, target: null, pending: null, note: "proprietary Paths/Shells, not MCP" },
  { project: "Sekoia", handle: "sekoia_virtuals", category: "AI investment / VC agent", group: "agents", party: "first", ownMcp: false, mcpRef: null, target: null, pending: null, note: "$SEKOIA" },
  { project: "Acolyt", handle: "AcolytAI", category: "social + on-chain analytics", group: "agents", party: "first", ownMcp: false, mcpRef: null, target: null, pending: null, note: "HTTP API + extension, no MCP" },
  { project: "aixCB", handle: "aixCB_Vc", category: "AI / DeSci VC agent", group: "agents", party: "first", ownMcp: false, mcpRef: null, target: null, pending: null, note: "$AIXCB" },
  { project: "Polytrader", handle: "polytraderAI", category: "prediction-markets trading", group: "agents", party: "first", ownMcp: false, mcpRef: null, target: null, pending: null, note: "via Polymarket API" },
  { project: "Ethy AI", handle: "ethy_agent", category: "DeFi trading automation", group: "agents", party: "first", ownMcp: false, mcpRef: null, target: null, pending: null, note: "highest-volume ACP agent; via ACP not MCP" },
  { project: "Axelrod", handle: "AIxVC_Axelrod", category: "AI hedge-fund agent", group: "agents", party: "first", ownMcp: false, mcpRef: null, target: null, pending: null, note: "names MCP internally; no connectable endpoint" },
  { project: "Mamo", handle: "", category: "DeFi assistant (Base)", group: "agents", party: "first", ownMcp: false, mcpRef: null, target: null, pending: null, note: "DeFi assistant agent" },
  { project: "Ribbita", handle: "", category: "community / meme agent", group: "agents", party: "first", ownMcp: false, mcpRef: null, target: null, pending: null, note: "community agent ($TIBBIR)" },
  { project: "Fabric Protocol", handle: "", category: "agent infrastructure", group: "agents", party: "first", ownMcp: false, mcpRef: null, target: null, pending: null, note: "agent infra ($ROBO)" },
  { project: "Convo Agent", handle: "", category: "conversational agent", group: "agents", party: "first", ownMcp: false, mcpRef: null, target: null, pending: null, note: "Prefrontal Cortex conversational agent" },
  { project: "VPay", handle: "", category: "agent payments", group: "agents", party: "first", ownMcp: false, mcpRef: null, target: null, pending: null, note: "agent payments" },
];

export interface GradedEntry extends VirtualsEntry {
  grade: LitmusGrade | null;
  detail: PolygraphDetail | null;
  completedAt: string | null;
  /** Path-safe ref for the canonical /mcp/<…> report (null when no own MCP). */
  reportPath: string | null;
  /** Daily adoption score (0–100, reach not safety); null for remote-only / untracked. */
  adoptionScore: number | null;
  /** Human-readable reach proxy; null when untracked, "—" when no signal. */
  adoptionSignal: string | null;
}

/** Load every entry with its live grade (null when unconfigured/ungraded). */
export async function loadVirtualsIndex(): Promise<GradedEntry[]> {
  const db = getSupabaseAdmin();
  const out: GradedEntry[] = [];
  for (const e of VIRTUALS_ENTRIES) {
    const g = e.target ? await latestForTarget(db, e.target) : null;
    const key = e.mcpRef ? decodeRef(e.mcpRef) : null;
    const adoption = db && e.mcpRef ? await fetchAdoptionForServer(db, e.mcpRef) : null;
    out.push({
      ...e,
      grade: g?.grade ?? null,
      detail: g?.detail ?? null,
      completedAt: g?.completedAt ?? null,
      reportPath: key ? refToPath(key) : null,
      adoptionScore: adoption ? Math.round(adoption.adoptionScore) : null,
      adoptionSignal: adoption ? adoption.adoptionSignal : null,
    });
  }
  return out;
}
