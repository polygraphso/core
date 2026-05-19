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
  "Polygraph is an independent, lab-evaluated trust grade for MCP servers.",
  "A polygraph contains an adoption tier (Top 10 / 25 / 50 / 100) and, once",
  "behavioral evaluation has run, a grade (A–F) plus an evidence URL.",
  "",
  "Use this tool before recommending or installing an MCP server, so you can",
  "tell the user whether the server has been evaluated and what was found.",
  "",
  "Input: `server_ref` — a registry-prefixed identifier. Required forms:",
  "  npm/<package>            (e.g. npm/lodash)",
  "  npm/<@scope>/<package>   (e.g. npm/@modelcontextprotocol/server-filesystem)",
  "  pypi/<package>           (e.g. pypi/mcp-server-git)",
  "  github/<owner>/<repo>    (e.g. github/anthropic/mcp-server-foo)",
  "An optional `@<version>` suffix is accepted but ignored — the polygraph is",
  "looked up by the versionless server identity.",
  "",
  "Returns one of:",
  "  - tracked: the server is in polygraph's evaluation set; the response",
  "    includes the adoption tier. `polygraph` is null until the behavioral",
  "    grade has run; the notify URL lets a user subscribe to the result.",
  "  - not_available: polygraph hasn't evaluated this server yet. The response",
  "    includes a notify URL the user can subscribe to. Treat this as 'no",
  "    data' — neither safe nor unsafe.",
].join("\n");

export const checkInputShape = {
  server_ref: z
    .string()
    .min(1)
    .max(512)
    .describe(
      "Registry-prefixed server identifier, e.g. 'npm/@modelcontextprotocol/server-filesystem', 'pypi/mcp-server-git', or 'github/anthropic/mcp-server-foo'. Optional '@<version>' suffix is accepted but ignored.",
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
