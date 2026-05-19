/**
 * `list_servers` — enumerate every MCP server polygraph tracks.
 *
 * Tool description is LLM-facing. Voice rules from brand-foundation.md.
 */

import type { CallToolResult } from "@modelcontextprotocol/sdk/types.js";

import { PolygraphApiError, getList } from "../api.js";

export const LIST_TOOL_NAME = "list_servers";

export const LIST_TOOL_TITLE = "List MCP servers tracked by polygraph";

export const LIST_TOOL_DESCRIPTION = [
  "List every MCP server currently tracked by polygraph.so, sorted by",
  "adoption tier (Top 10 → Top 25 → Top 50 → Top 100 → unranked).",
  "",
  "Use this tool to discover which servers polygraph has evaluated, to find",
  "trustworthy options before recommending one, or to check whether a given",
  "server is in the evaluation set without doing a per-server lookup.",
  "",
  "Each entry includes:",
  "  - server_ref: the canonical registry-prefixed identifier",
  "  - adoption_tier: 'top10' | 'top25' | 'top50' | 'top100' | null",
  "  - polygraph: null (no grade yet) | 'pending' | 'A' | 'B' | 'C' | 'D' | 'F'",
  "",
  "Returns `{ servers: [...], total: number }`. No input parameters.",
].join("\n");

export const listInputShape = {};

export async function handleList(): Promise<CallToolResult> {
  try {
    const body = await getList();
    return {
      content: [{ type: "text", text: JSON.stringify(body, null, 2) }],
      structuredContent: body as unknown as { [key: string]: unknown },
    };
  } catch (err) {
    return errorResult(err);
  }
}

function errorResult(err: unknown): CallToolResult {
  if (err instanceof PolygraphApiError) {
    return {
      content: [{ type: "text", text: err.message }],
      isError: true,
    };
  }
  const msg = err instanceof Error ? err.message : String(err);
  return {
    content: [{ type: "text", text: `polygraph.so lookup failed: ${msg}` }],
    isError: true,
  };
}

