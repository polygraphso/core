import "server-only";

/**
 * Data layer for the (unlisted) Base-network MCP index at /base.
 *
 * Scope: MCP servers an onchain AI agent operating on the Base network (Coinbase's
 * L2) can connect to — the projects that integrate Base MCP (whose own "sibling"
 * MCP servers are independently gradeable, vs the Base gateway plugin which isn't),
 * plus the broader set of Base-supporting DeFi / data / infrastructure MCPs.
 *
 * Grades are read straight from `hosted_runs` by the service-role client and shown
 * REGARDLESS of `published_at` — i.e. this page surfaces grade-only rows the public
 * badge/CLI path (published-only) does not. That keeps it private: a row appears
 * here the moment it is graded, and nowhere public until someone publishes it.
 */

import { getSupabaseAdmin } from "@/lib/supabase";
import { decodeRef, refToPath } from "@/lib/badgeData";
import { fetchAdoptionForServer } from "@/lib/rankings";
import { loadEntriesForEcosystem } from "@/lib/ecosystemData";
import {
  latestForTarget,
  type LitmusGrade,
  type PolygraphDetail,
} from "@/lib/hostedGrades";
import type { EcosystemEntryRow } from "@/lib/ecosystemTypes";

/** Display cohort. */
export type Group = "base-plugins" | "defi" | "data-infra" | "coinbase";

export const GROUP_LABEL: Record<Group, string> = {
  "base-plugins": "Base MCP plugins",
  defi: "DeFi & trading",
  "data-infra": "Data & infrastructure",
  coinbase: "Coinbase / Base",
};

export const GROUP_ORDER: Group[] = ["base-plugins", "defi", "data-infra", "coinbase"];

/** Built by the protocol itself vs a third-party / community wrapper. */
export type Party = "first" | "third";

/** Why a server with its own MCP isn't graded yet (null once a grade exists). */
export type Pending = "free-key" | "api-key" | "clone-build" | null;

export interface BaseEntry {
  project: string;
  handle: string; // X handle, without the @
  category: string;
  group: Group;
  party: Party;
  /** Does the project ship its OWN standalone MCP server (vs HTTP/CLI/SDK only)? */
  ownMcp: boolean;
  /** The MCP ref/endpoint, for display — even when not yet graded. */
  mcpRef: string | null;
  /** The exact ref submitted to the hosted runner (null = not graded). */
  target: string | null;
  /** If it has an MCP but isn't graded yet, why. */
  pending: Pending;
  note?: string;
}

// ownMcp / mcpRef / party from the jun-24 sourcing sweeps. `target` is set for any
// ref submitted to the hosted runner; npm refs grade sandboxed (can reach A), https
// endpoints grade in-process (cap at B). Third-party = a community wrapper, not the
// protocol's own server.
export const BASE_ENTRIES: BaseEntry[] = [
  // ---------------- Base MCP plugins (the projects integrating Base MCP) ----------------
  { project: "Printr", handle: "printr", category: "token launchpad", group: "base-plugins", party: "first", ownMcp: true, mcpRef: "npm/@printr/mcp", target: "npm/@printr/mcp", pending: null },
  { project: "Clawnch", handle: "Clawnch_Bot", category: "launches", group: "base-plugins", party: "first", ownMcp: true, mcpRef: "npm/clawnch-mcp-server", target: "npm/clawnch-mcp-server", pending: null },
  { project: "Flaunch", handle: "flaunchgg", category: "token launches", group: "base-plugins", party: "first", ownMcp: true, mcpRef: "https://mcp.flaunch.gg/", target: "https://mcp.flaunch.gg/", pending: null },
  { project: "Brickken", handle: "Brickken", category: "RWA tokenization", group: "base-plugins", party: "first", ownMcp: true, mcpRef: "https://mcp.brickken.com/mcp", target: "https://mcp.brickken.com/mcp", pending: null },
  { project: "Morpho", handle: "MorphoLabs", category: "lending", group: "base-plugins", party: "first", ownMcp: true, mcpRef: "https://mcp.morpho.org/", target: "https://mcp.morpho.org/", pending: null },
  { project: "Virtuals", handle: "virtuals_io", category: "agent platform", group: "base-plugins", party: "first", ownMcp: true, mcpRef: "https://mcp.acp.virtuals.io/", target: "https://mcp.acp.virtuals.io/", pending: null },
  { project: "OpenSea", handle: "opensea", category: "NFT marketplace", group: "base-plugins", party: "first", ownMcp: true, mcpRef: "https://mcp.opensea.io/mcp", target: "https://mcp.opensea.io/mcp", pending: null, note: "hosted MCP; connects without a key (tools work with a free key)" },
  { project: "Venice", handle: "AskVenice", category: "private AI inference", group: "base-plugins", party: "first", ownMcp: true, mcpRef: "npm/@veniceai/mcp-server", target: "npm/@veniceai/mcp-server", pending: null, note: "starts without a key; tools need a Venice API key" },
  { project: "Bitrefill", handle: "bitrefill", category: "gift cards", group: "base-plugins", party: "first", ownMcp: true, mcpRef: "npm/bitrefill-mcp-server", target: "npm/bitrefill-mcp-server", pending: null, note: "starts without a key; tools need a Bitrefill API key" },
  { project: "KyberSwap", handle: "KyberNetwork", category: "DEX aggregation", group: "base-plugins", party: "first", ownMcp: true, mcpRef: "github/KyberNetwork/kyberswap-mcp", target: "github/KyberNetwork/kyberswap-mcp", pending: null, note: "first-party MCP, graded from source (github ref)" },
  { project: "GMGN", handle: "gmgnai", category: "token discovery", group: "base-plugins", party: "first", ownMcp: false, mcpRef: null, target: null, pending: null, note: "Skills + CLI + REST API" },
  { project: "Hydrex", handle: "HydrexFi", category: "DeFi", group: "base-plugins", party: "first", ownMcp: false, mcpRef: null, target: null, pending: null, note: "Base-MCP skill + SDK" },
  { project: "o1.exchange", handle: "o1_exchange", category: "exchange", group: "base-plugins", party: "first", ownMcp: false, mcpRef: null, target: null, pending: null, note: "REST trading API" },
  { project: "Balancer", handle: "Balancer", category: "AMM / liquidity", group: "base-plugins", party: "first", ownMcp: false, mcpRef: null, target: null, pending: null, note: "SDK only (CLI-only plugin)" },
  { project: "YO", handle: "yield", category: "yield vaults", group: "base-plugins", party: "first", ownMcp: false, mcpRef: null, target: null, pending: null, note: "SDK + REST API" },

  // ---------------- DeFi & trading (Base-supporting) ----------------
  { project: "LI.FI", handle: "lifiprotocol", category: "bridge + DEX aggregator", group: "defi", party: "first", ownMcp: true, mcpRef: "https://mcp.li.quest/mcp", target: "https://mcp.li.quest/mcp", pending: null },
  { project: "deBridge", handle: "deBridgeFinance", category: "cross-chain bridge", group: "defi", party: "first", ownMcp: true, mcpRef: "https://agents.debridge.com/mcp", target: "https://agents.debridge.com/mcp", pending: null },
  { project: "OpenOcean", handle: "OpenOceanGlobal", category: "DEX aggregator", group: "defi", party: "first", ownMcp: true, mcpRef: "npm/openocean-mcp", target: "npm/openocean-mcp", pending: null },
  { project: "Arcadia", handle: "arcadiafi", category: "LP + leverage", group: "defi", party: "first", ownMcp: true, mcpRef: "npm/@arcadia-finance/mcp-server", target: "npm/@arcadia-finance/mcp-server", pending: null },
  { project: "CoW Swap", handle: "CoWSwap", category: "intent-based DEX", group: "defi", party: "third", ownMcp: true, mcpRef: "npm/cow-mcp", target: "npm/cow-mcp", pending: null },
  { project: "DeFi Rates", handle: "", category: "lending-rate aggregator", group: "defi", party: "third", ownMcp: true, mcpRef: "npm/@asahi001/defi-rates-mcp", target: "npm/@asahi001/defi-rates-mcp", pending: null },
  { project: "Philidor", handle: "PhilidorLabs", category: "vault risk analytics", group: "defi", party: "third", ownMcp: true, mcpRef: "https://mcp.philidor.io/api/mcp", target: "https://mcp.philidor.io/api/mcp", pending: null },

  // ---------------- Data & infrastructure (Base-supporting) ----------------
  { project: "CoinGecko", handle: "coingecko", category: "market + onchain data", group: "data-infra", party: "first", ownMcp: true, mcpRef: "https://mcp.api.coingecko.com/mcp", target: "https://mcp.api.coingecko.com/mcp", pending: null },
  { project: "DefiLlama", handle: "DefiLlama", category: "TVL / yields", group: "data-infra", party: "third", ownMcp: true, mcpRef: "npm/defillama-mcp", target: "npm/defillama-mcp", pending: null },
  { project: "Blockscout", handle: "blockscoutcom", category: "block explorer", group: "data-infra", party: "first", ownMcp: true, mcpRef: "https://mcp.blockscout.com/mcp", target: "https://mcp.blockscout.com/mcp", pending: null },
  { project: "Pyth", handle: "PythNetwork", category: "price oracle", group: "data-infra", party: "first", ownMcp: true, mcpRef: "https://mcp.pyth.network/mcp", target: "https://mcp.pyth.network/mcp", pending: null },
  { project: "evm-mcp-server", handle: "", category: "generic EVM (reads)", group: "data-infra", party: "third", ownMcp: true, mcpRef: "npm/@mcpdotdirect/evm-mcp-server", target: "npm/@mcpdotdirect/evm-mcp-server", pending: null },
  // github-only servers (no npm/pypi), graded from source now that github grading is live.
  { project: "Honeypot Detector", handle: "", category: "honeypot token scanner", group: "data-infra", party: "third", ownMcp: true, mcpRef: "github/kukapay/honeypot-detector-mcp", target: "github/kukapay/honeypot-detector-mcp", pending: null, note: "github-only; honeypot.is (Base + EVM)" },
  { project: "Liquidity Pools", handle: "", category: "DEX pool data", group: "data-infra", party: "third", ownMcp: true, mcpRef: "github/kukapay/liquidity-pools-mcp", target: "github/kukapay/liquidity-pools-mcp", pending: null, note: "github-only; DexScreener" },
  { project: "Chainlist", handle: "", category: "EVM chain metadata", group: "data-infra", party: "third", ownMcp: true, mcpRef: "github/kukapay/chainlist-mcp", target: "github/kukapay/chainlist-mcp", pending: null, note: "github-only; chainlist.org" },
  { project: "Bridge Metrics", handle: "", category: "cross-chain bridge metrics", group: "data-infra", party: "third", ownMcp: true, mcpRef: "github/kukapay/bridge-metrics-mcp", target: "github/kukapay/bridge-metrics-mcp", pending: null, note: "github-only; DefiLlama" },
  { project: "DAO Proposals", handle: "", category: "DAO governance feed", group: "data-infra", party: "third", ownMcp: true, mcpRef: "github/kukapay/dao-proposals-mcp", target: "github/kukapay/dao-proposals-mcp", pending: null, note: "github-only; Snapshot" },

  // ---------------- Coinbase / Base first-party ----------------
  { project: "CDP Docs", handle: "CoinbaseDev", category: "developer-docs search", group: "coinbase", party: "first", ownMcp: true, mcpRef: "https://docs.cdp.coinbase.com/mcp", target: "https://docs.cdp.coinbase.com/mcp", pending: null },
];

export interface GradedEntry extends BaseEntry {
  grade: LitmusGrade | null;
  detail: PolygraphDetail | null;
  completedAt: string | null;
  /** Path-safe ref for the canonical /mcp/<…> report (null when no own MCP). */
  reportPath: string | null;
  /** Daily adoption score (0–100, reach not safety); null for remote-only / untracked. */
  adoptionScore: number | null;
  /** Human-readable reach proxy (e.g. "23.2M npm/mo"); null when untracked, "—" when no signal. */
  adoptionSignal: string | null;
}

/** Reconstruct BaseEntry rows from seeded ecosystem_entries: the whole original
 *  object lives in `metadata`, with visible/cohort overlaid from the curation
 *  columns. Hidden rows are dropped; ordering follows position. */
function rowsToBaseEntries(rows: EcosystemEntryRow[]): BaseEntry[] {
  return rows
    .filter((r) => r.visible)
    .map((r) => {
      const m = r.metadata as Partial<BaseEntry> & { group?: Group };
      return {
        project: m.project ?? "",
        handle: m.handle ?? "",
        category: m.category ?? "",
        group: (r.cohort ?? m.group ?? "base-plugins") as Group,
        party: (m.party ?? "first") as Party,
        ownMcp: Boolean(m.ownMcp),
        mcpRef: m.mcpRef ?? null,
        target: r.target,
        pending: (m.pending ?? null) as Pending,
        note: m.note,
      };
    });
}

/** Load every entry with its live grade (null when unconfigured/ungraded).
 *  Seeded ecosystem → DB is the source (dashboard curation shows here); until then
 *  the hardcoded BASE_ENTRIES keep the page working. The per-entry grade + adoption
 *  lookups are independent, so they run concurrently (map preserves order). */
export async function loadBaseIndex(): Promise<GradedEntry[]> {
  const db = getSupabaseAdmin();
  const rows = await loadEntriesForEcosystem("base");
  const source = rows ? rowsToBaseEntries(rows) : BASE_ENTRIES;
  return Promise.all(
    source.map(async (e) => {
      // Adoption is registry-only — fetchAdoptionForServer parses the ref and
      // returns null for a remote URL or an untracked package.
      const [g, adoption] = await Promise.all([
        e.target ? latestForTarget(db, e.target) : null,
        db && e.mcpRef ? fetchAdoptionForServer(db, e.mcpRef) : null,
      ]);
      const key = e.mcpRef ? decodeRef(e.mcpRef) : null;
      return {
        ...e,
        grade: g?.grade ?? null,
        detail: g?.detail ?? null,
        completedAt: g?.completedAt ?? null,
        reportPath: key ? refToPath(key) : null,
        adoptionScore: adoption ? Math.round(adoption.adoptionScore) : null,
        adoptionSignal: adoption ? adoption.adoptionSignal : null,
      };
    }),
  );
}
