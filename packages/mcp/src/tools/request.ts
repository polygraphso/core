/**
 * `request_grade` — add an ungraded MCP server to polygraph's public grading
 * queue. The natural follow-up when `check_server` returns not_available.
 *
 * Tool description is LLM-facing — the agent reads it to decide when to
 * invoke. Voice rules from brand-foundation.md apply: plain English, no
 * empty intensifiers, no "AI safety" framing, no overclaim.
 *
 * No email: the caller is an agent, so we take no contact details. The MCP
 * server passes the connected client's identity (agent_id) so the queue
 * knows who asked, without prompting the user. The grade is fulfilled
 * best-effort; read it later by calling `check_server` again.
 */

import type { CallToolResult } from "@modelcontextprotocol/sdk/types.js";
import { z } from "zod";

import { PolygraphApiError, postGradeRequest } from "../api.js";

export const REQUEST_TOOL_NAME = "request_grade";

export const REQUEST_TOOL_TITLE = "Request a polygraph grade for an MCP server";

export const REQUEST_TOOL_DESCRIPTION = [
  "Add an MCP server to polygraph.so's public grading queue.",
  "",
  "Use this when `check_server` returns not_available and you want the server",
  "graded. The request is free and best-effort — polygraph runs the litmus",
  "test and publishes the grade, then you read it by calling `check_server`",
  "again later. This does not return a grade synchronously.",
  "",
  "No contact details are needed. Requesting the same server twice is a no-op,",
  "not a duplicate.",
  "",
  "Input: `server_ref` — the same registry-prefixed identifier `check_server`",
  "takes (e.g. npm/@scope/name, pypi/name, github/owner/repo).",
  "",
  "Returns `{ status: 'queued', created, demand }` — `created` is false if it",
  "was already queued, `demand` is how many requests stand behind it.",
].join("\n");

export const requestInputShape = {
  server_ref: z
    .string()
    .min(1)
    .max(512)
    .describe(
      "Registry-prefixed server identifier, e.g. 'npm/@modelcontextprotocol/server-filesystem', 'pypi/mcp-server-git', or 'github/anthropic/mcp-server-foo'.",
    ),
};

const requestInputSchema = z.object(requestInputShape);

export type RequestInput = z.infer<typeof requestInputSchema>;

/**
 * @param agentId identity of the connected MCP client (name/version), passed
 *   through so the queue can attribute the request. Undefined when the client
 *   didn't announce itself.
 */
export async function handleRequestGrade(
  input: RequestInput,
  agentId?: string,
): Promise<CallToolResult> {
  try {
    const body = await postGradeRequest(input.server_ref, agentId);
    const text = body.created
      ? `Queued ${input.server_ref} for grading (${body.demand} request(s) behind it). It'll be graded best-effort — call check_server again later to read the result.`
      : `${input.server_ref} was already in the queue (${body.demand} request(s) behind it). Call check_server again later to read the result.`;
    return {
      content: [{ type: "text", text }],
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
    content: [{ type: "text", text: `polygraph.so request failed: ${msg}` }],
    isError: true,
  };
}
