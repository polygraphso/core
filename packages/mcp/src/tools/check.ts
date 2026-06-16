/**
 * `check_server` — look up the polygraph for an MCP server.
 *
 * Tool description is LLM-facing — the agent reads it to decide when to
 * invoke. Voice rules from brand-foundation.md apply: plain English, no
 * empty intensifiers, no "AI safety" framing, no overclaim. Treat it like
 * an API doc the model will act on.
 */

import type { CallToolResult } from "@modelcontextprotocol/sdk/types.js";
import { z } from "zod";

import { PolygraphApiError, postCheck } from "../api.js";

export const CHECK_TOOL_NAME = "check_server";

export const CHECK_TOOL_TITLE = "Check the polygraph for an MCP server";

export const CHECK_TOOL_DESCRIPTION = [
  "Look up the current polygraph for an MCP server on polygraph.so.",
  "",
  "Polygraph is a behavioral trust grade for MCP servers: the server is run",
  "through an adversarial litmus test and given a letter grade (A–F) backed",
  "by evidence anyone can re-run.",
  "",
  "Use this tool before recommending or installing an MCP server, so you can",
  "tell the user whether it's been graded and what was found.",
  "",
  "Input: `server_ref` — a registry-prefixed identifier. Required forms:",
  "  npm/<package>            (e.g. npm/lodash)",
  "  npm/<@scope>/<package>   (e.g. npm/@modelcontextprotocol/server-filesystem)",
  "  pypi/<package>           (e.g. pypi/mcp-server-git)",
  "  github/<owner>/<repo>    (e.g. github/anthropic/mcp-server-foo)",
  "An optional `@<version>` suffix looks up the grade for that EXACT version; a",
  "bare ref returns the latest graded version. A grade for one version never",
  "applies to another.",
  "",
  "Returns one of:",
  "  - graded: `polygraph` is the published grade ('A'|'B'|'D'|'F', no C), and",
  "    `polygraph_detail` carries the per-check results (C-01/C-02/C-03), the",
  "    tool-surface fingerprint, the methodology version, and `resolved_version`",
  "    (the version the grade was run against).",
  "  - not_available: this server (or the requested version) hasn't been graded",
  "    yet. The response includes a notify URL the user can subscribe to. Treat",
  "    this as 'no data' — neither safe nor unsafe.",
].join("\n");

export const checkInputShape = {
  server_ref: z
    .string()
    .min(1)
    .max(512)
    .describe(
      "Registry-prefixed server identifier, e.g. 'npm/@modelcontextprotocol/server-filesystem', 'pypi/mcp-server-git', or 'github/anthropic/mcp-server-foo'. An optional '@<version>' suffix looks up that exact version; a bare ref returns the latest graded version.",
    ),
};

const checkInputSchema = z.object(checkInputShape);

export type CheckInput = z.infer<typeof checkInputSchema>;

export async function handleCheck(input: CheckInput): Promise<CallToolResult> {
  try {
    const body = await postCheck(input.server_ref);
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
