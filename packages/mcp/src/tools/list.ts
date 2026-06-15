/**
 * `list_servers` — enumerate every MCP server polygraph tracks.
 *
 * Tool description is LLM-facing. Voice rules from brand-foundation.md.
 */

import type { CallToolResult } from "@modelcontextprotocol/sdk/types.js";

import { PolygraphApiError, getList } from "../api.js";

export const LIST_TOOL_NAME = "list_servers";

export const LIST_TOOL_TITLE = "List MCP servers graded by polygraph";

export const LIST_TOOL_DESCRIPTION = [
  "List every MCP server polygraph.so has published a grade for, sorted by",
  "grade (A first).",
  "",
  "Use this tool to discover which servers have been graded, or to find",
  "well-graded options before recommending one.",
  "",
  "Each entry includes:",
  "  - server_ref: the canonical registry-prefixed identifier",
  "  - polygraph: the published grade 'A' | 'B' | 'D' | 'F' (no C)",
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

