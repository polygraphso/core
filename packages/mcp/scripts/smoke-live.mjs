#!/usr/bin/env node
// Live smoke test against the real polygraph.so API. Calls check_server and
// list_servers via stdio JSON-RPC and prints the results. Slower than the
// pure-shape smoke; useful before publish.
//
// Run from packages/mcp:  node scripts/smoke-live.mjs
//
// Not in the published artifact.

import { spawn } from "node:child_process";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
const entry = resolve(here, "..", "dist", "index.js");

const proc = spawn("node", [entry], {
  stdio: ["pipe", "pipe", "inherit"],
  env: { ...process.env },
});

let buffer = "";
const pending = new Map();
proc.stdout.on("data", (chunk) => {
  buffer += chunk.toString("utf-8");
  while (true) {
    const nl = buffer.indexOf("\n");
    if (nl === -1) break;
    const line = buffer.slice(0, nl).trim();
    buffer = buffer.slice(nl + 1);
    if (!line) continue;
    try {
      const msg = JSON.parse(line);
      if (msg.id !== undefined && pending.has(msg.id)) {
        const { resolve } = pending.get(msg.id);
        pending.delete(msg.id);
        resolve(msg);
      }
    } catch {
      /* ignore */
    }
  }
});

let nextId = 1;
function request(method, params) {
  const id = nextId++;
  return new Promise((resolveFn, rejectFn) => {
    const timer = setTimeout(() => rejectFn(new Error(`timeout: ${method}`)), 15_000);
    pending.set(id, {
      resolve: (msg) => {
        clearTimeout(timer);
        resolveFn(msg);
      },
    });
    proc.stdin.write(JSON.stringify({ jsonrpc: "2.0", id, method, params }) + "\n");
  });
}
function notify(method, params) {
  proc.stdin.write(JSON.stringify({ jsonrpc: "2.0", method, params }) + "\n");
}

try {
  await request("initialize", {
    protocolVersion: "2025-06-18",
    capabilities: {},
    clientInfo: { name: "polygraphso-smoke-live", version: "0.0.0" },
  });
  notify("notifications/initialized", {});

  console.log("→ check_server npm/@modelcontextprotocol/server-filesystem");
  const checked = await request("tools/call", {
    name: "check_server",
    arguments: { server_ref: "npm/@modelcontextprotocol/server-filesystem" },
  });
  const checkedText = checked.result?.content?.[0]?.text ?? "(none)";
  console.log(checkedText);

  console.log("\n→ check_server npm/this-package-does-not-exist-yet");
  const missed = await request("tools/call", {
    name: "check_server",
    arguments: { server_ref: "npm/this-package-does-not-exist-yet" },
  });
  console.log(missed.result?.content?.[0]?.text ?? "(none)");

  console.log("\n→ list_servers (first 3 of total)");
  const listed = await request("tools/call", {
    name: "list_servers",
    arguments: {},
  });
  const body = JSON.parse(listed.result?.content?.[0]?.text ?? "{}");
  console.log(`total: ${body.total}`);
  for (const entry of (body.servers ?? []).slice(0, 3)) {
    console.log(`  ${entry.server_ref}  ${entry.adoption_tier ?? "—"}  ${entry.polygraph ?? "—"}`);
  }
} finally {
  proc.kill("SIGTERM");
}
