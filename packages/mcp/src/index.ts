#!/usr/bin/env node
/**
 * `@polygraphso/mcp` — MCP server entry point.
 *
 * Stdio transport (the universal MCP transport — Claude Desktop, Cursor, and
 * every other MCP client speak it). The process is launched by the client;
 * we read JSON-RPC on stdin, write on stdout, log to stderr (stdout is
 * reserved for the JSON-RPC framing).
 *
 * Tools registered for v0.1.0:
 *   - check_server  → POST /api/cli/check
 *   - list_servers  → GET  /api/cli/list
 *
 * `notify_about` is deferred to v0.2 because POST /api/notify hasn't shipped
 * yet — see packages/mcp/README.md "Roadmap".
 */

import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";

import {
  CHECK_TOOL_DESCRIPTION,
  CHECK_TOOL_NAME,
  CHECK_TOOL_TITLE,
  checkInputShape,
  handleCheck,
} from "./tools/check.js";
import {
  LIST_TOOL_DESCRIPTION,
  LIST_TOOL_NAME,
  LIST_TOOL_TITLE,
  handleList,
} from "./tools/list.js";

function readVersion(): string {
  const here = dirname(fileURLToPath(import.meta.url));
  // dist/index.js → ../package.json
  const pkgPath = resolve(here, "..", "package.json");
  const pkg = JSON.parse(readFileSync(pkgPath, "utf-8")) as { version?: string };
  return pkg.version ?? "0.0.0";
}

export function buildServer(): McpServer {
  const server = new McpServer(
    { name: "polygraphso", version: readVersion() },
    {
      instructions: [
        "polygraph.so issues independent, lab-evaluated trust grades for MCP",
        "servers (called 'polygraphs'). Use `check_server` to look up the",
        "polygraph for a specific MCP server before recommending or installing",
        "it. Use `list_servers` to discover which servers polygraph tracks.",
        "",
        "Be honest about coverage: a server with no polygraph yet is neither",
        "safe nor unsafe — it's unevaluated. Surface that to the user.",
      ].join("\n"),
    },
  );

  server.registerTool(
    CHECK_TOOL_NAME,
    {
      title: CHECK_TOOL_TITLE,
      description: CHECK_TOOL_DESCRIPTION,
      inputSchema: checkInputShape,
      annotations: {
        title: CHECK_TOOL_TITLE,
        readOnlyHint: true,
        destructiveHint: false,
        idempotentHint: true,
        openWorldHint: true,
      },
    },
    handleCheck,
  );

  server.registerTool(
    LIST_TOOL_NAME,
    {
      title: LIST_TOOL_TITLE,
      description: LIST_TOOL_DESCRIPTION,
      annotations: {
        title: LIST_TOOL_TITLE,
        readOnlyHint: true,
        destructiveHint: false,
        idempotentHint: true,
        openWorldHint: true,
      },
    },
    handleList,
  );

  return server;
}

async function main(): Promise<void> {
  const server = buildServer();
  const transport = new StdioServerTransport();
  await server.connect(transport);
  // Connect resolves when the transport is wired up; the server then runs
  // until stdin closes. No explicit shutdown — the transport handles it.
}

// Execute when invoked as a binary. Importable as a module for tests.
const invokedDirectly = (() => {
  try {
    return process.argv[1] === fileURLToPath(import.meta.url);
  } catch {
    return false;
  }
})();

if (invokedDirectly) {
  main().catch((err: unknown) => {
    const msg = err instanceof Error ? err.stack ?? err.message : String(err);
    process.stderr.write(`polygraphso-mcp: fatal: ${msg}\n`);
    process.exit(1);
  });
}
