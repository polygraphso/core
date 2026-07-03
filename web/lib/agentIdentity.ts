/**
 * Resolve the calling agent's identity for the public /api/cli endpoints.
 *
 * Two paths, in preference order:
 *   1. Our clients (the litmus MCP tools, the polygraphso CLI) send `agent_id`
 *      ("name/version" — the MCP client's self-reported identity from the
 *      initialize handshake) plus optional `agent_meta` (title, websiteUrl,
 *      description, declared capabilities).
 *   2. Everyone else falls back to a NORMALIZED User-Agent — first product
 *      token, version truncated to major.minor — so curl/scripts/third-party
 *      integrations are visible without exploding cardinality.
 *
 * Everything is length-capped: these strings come from the open internet and
 * land in the DB. Software metadata only — never IPs, never user identity.
 */

import type { SupabaseClient } from "@supabase/supabase-js";

const AGENT_ID_MAX = 200;
const NAME_MAX = 120;
const VERSION_MAX = 40;
const TITLE_MAX = 120;
const URL_MAX = 200;
const DESCRIPTION_MAX = 300;
const CAPABILITY_MAX = 40;
const CAPABILITIES_MAX_ITEMS = 10;
const UA_PRODUCT_MAX = 60;

export interface AgentMeta {
  title?: string;
  websiteUrl?: string;
  description?: string;
  capabilities?: string[];
}

export interface AgentIdentity {
  /** Full identity key, e.g. "claude-code/2.1.199" or "ua:curl/8.6". */
  agentId: string;
  /** Version-less grouping key, e.g. "claude-code" or "ua:curl". */
  name: string;
  version: string | null;
  source: "mcp" | "cli" | "raw";
  meta: AgentMeta | null;
}

function capped(value: unknown, max: number): string | null {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  if (trimmed.length === 0) return null;
  return trimmed.slice(0, max);
}

function sanitizeMeta(raw: unknown): AgentMeta | null {
  if (typeof raw !== "object" || raw === null) return null;
  const m = raw as Record<string, unknown>;
  const out: AgentMeta = {};
  const title = capped(m.title, TITLE_MAX);
  if (title) out.title = title;
  const websiteUrl = capped(m.websiteUrl, URL_MAX);
  if (websiteUrl) out.websiteUrl = websiteUrl;
  const description = capped(m.description, DESCRIPTION_MAX);
  if (description) out.description = description;
  if (Array.isArray(m.capabilities)) {
    const caps = m.capabilities
      .map((c) => capped(c, CAPABILITY_MAX))
      .filter((c): c is string => c !== null)
      .slice(0, CAPABILITIES_MAX_ITEMS);
    if (caps.length > 0) out.capabilities = caps;
  }
  return Object.keys(out).length > 0 ? out : null;
}

/** "8.6.0" → "8.6" — bound UA-version cardinality to major.minor. */
function majorMinor(version: string): string {
  const parts = version.split(".");
  return parts.length > 2 ? parts.slice(0, 2).join(".") : version;
}

export function resolveAgentIdentity(input: {
  agentId?: unknown;
  source?: unknown;
  agentMeta?: unknown;
  userAgent?: string | null;
}): AgentIdentity {
  const suppliedId = capped(input.agentId, AGENT_ID_MAX);

  if (suppliedId) {
    // "name/version" with the LAST slash as the separator (defensive against
    // names that contain slashes). No slash → version unknown.
    const slash = suppliedId.lastIndexOf("/");
    const name =
      slash > 0 ? suppliedId.slice(0, slash).slice(0, NAME_MAX) : suppliedId.slice(0, NAME_MAX);
    const version = slash > 0 ? suppliedId.slice(slash + 1).slice(0, VERSION_MAX) || null : null;
    const source = input.source === "mcp" ? "mcp" : "cli";
    return {
      agentId: suppliedId,
      name,
      version,
      source,
      meta: sanitizeMeta(input.agentMeta),
    };
  }

  // Raw caller: normalize the first User-Agent product token.
  const ua = (input.userAgent ?? "").trim();
  if (ua.length === 0) {
    return { agentId: "ua:unknown", name: "ua:unknown", version: null, source: "raw", meta: null };
  }
  const token = ua.split(/\s+/)[0]!.slice(0, UA_PRODUCT_MAX + 1 + VERSION_MAX);
  const slash = token.indexOf("/");
  const product = (slash > 0 ? token.slice(0, slash) : token).slice(0, UA_PRODUCT_MAX);
  const version = slash > 0 ? majorMinor(token.slice(slash + 1)).slice(0, VERSION_MAX) : null;
  return {
    agentId: version ? `ua:${product}/${version}` : `ua:${product}`,
    name: `ua:${product}`,
    version,
    source: "raw",
    meta: null,
  };
}

/**
 * Best-effort persistence: upsert the agents registry + bump today's activity
 * counters in one RPC. Never throws — a stats failure must not fail the
 * request it's observing (same posture as bump_lookup).
 */
export async function recordAgentCall(
  supabase: SupabaseClient,
  identity: AgentIdentity,
  endpoint: "check" | "list" | "grade_request",
  hit?: boolean,
): Promise<void> {
  const { error } = await supabase.rpc("record_agent_call", {
    p_agent_id: identity.agentId,
    p_name: identity.name,
    p_version: identity.version,
    p_meta: identity.meta,
    p_source: identity.source,
    p_endpoint: endpoint,
    p_hit: hit ?? null,
  });
  if (error) {
    console.error("[agent-stats] record_agent_call failed:", error.message);
  }
}
