/**
 * The request funnel's "known-MCP" gate. `verifyRunnable` proves a target is a
 * real, reachable package; this proves it's plausibly an *MCP server* before we
 * park it in the queue — so a real-but-unrelated package (`npm/context`) or a
 * nonsense ref (`npm/benfica`) doesn't become a dead grade request.
 *
 * A registry ref is accepted on either signal:
 *   1. it's a known catalog MCP server (we've already resolved it as gradeable), or
 *   2. its name carries the near-universal mcp/server token (see mcpHeuristic).
 * A remote https:// endpoint is trusted — a human is asserting their own MCP URL,
 * which we can't existence-check and which caps at B anyway. A github skill ref
 * is trusted the same way: an explicit github/owner/repo#path the user typed,
 * not a stray registry package that needs the heuristic.
 *
 * The catalog lookup is injected so the branching stays unit-testable offline;
 * `isCatalogedServer` is the production implementation.
 */

import type { SupabaseClient } from "@supabase/supabase-js";
import { looksLikeMcpPackage } from "@/lib/mcpHeuristic";

export type McpGateResult = { ok: true } | { ok: false; reason: string };

/** Is `ref` already resolved as a gradeable MCP server in our catalog? */
export type CatalogProbe = (ref: string) => Promise<boolean>;

export async function gateKnownMcp(
  parsed: { target: string; kind: "registry_ref" | "remote_url" | "skill" },
  isCataloged: CatalogProbe,
): Promise<McpGateResult> {
  if (parsed.kind === "remote_url" || parsed.kind === "skill") return { ok: true };
  if (looksLikeMcpPackage(parsed.target)) return { ok: true };
  if (await isCataloged(parsed.target)) return { ok: true };
  return {
    ok: false,
    reason:
      `We only queue MCP servers, and "${parsed.target}" doesn't look like one. ` +
      `If it is an MCP server, request it by its MCP package (usually named …-mcp / mcp-…) ` +
      `or its https:// endpoint — or search the catalog above.`,
  };
}

/**
 * Production catalog probe: does a gradeable catalog_servers row already point
 * at this exact grading target? A confirmed hit means we've resolved it as an
 * MCP server. Any error → not a hit (the heuristic already had its chance).
 */
export async function isCatalogedServer(
  supabase: SupabaseClient,
  ref: string,
): Promise<boolean> {
  const { data, error } = await supabase
    .from("catalog_servers")
    .select("id")
    .eq("grading_target", ref)
    .eq("gradeable", true)
    .limit(1)
    .maybeSingle();
  if (error) return false;
  return data != null;
}
