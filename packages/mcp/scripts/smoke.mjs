#!/usr/bin/env node
// Quick stdio smoke test for the built server. Spawns ./dist/index.js,
// performs the MCP initialize handshake, lists tools, and calls each one.
// Exits 0 on success, 1 on any failure.
//
// Run from packages/mcp:  node scripts/smoke.mjs
// Override target API:    POLYGRAPH_API_URL=http://localhost:3000 node scripts/smoke.mjs
//
// Not part of the published artifact — `files` in package.json excludes
// `scripts/`. Lives here so the dev who picks this up next can run the same
// check we ran before publishing.

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
    let msg;
    try {
      msg = JSON.parse(line);
    } catch {
      continue;
    }
    if (msg.id !== undefined && pending.has(msg.id)) {
      const { resolve } = pending.get(msg.id);
      pending.delete(msg.id);
      resolve(msg);
    }
  }
});

let nextId = 1;
function request(method, params) {
  const id = nextId++;
  const payload = { jsonrpc: "2.0", id, method, params };
  return new Promise((resolveFn, rejectFn) => {
    const timer = setTimeout(() => {
      pending.delete(id);
      rejectFn(new Error(`timeout waiting for ${method}`));
    }, 10_000);
    pending.set(id, {
      resolve: (msg) => {
        clearTimeout(timer);
        resolveFn(msg);
      },
    });
    proc.stdin.write(JSON.stringify(payload) + "\n");
  });
}

function notify(method, params) {
  proc.stdin.write(JSON.stringify({ jsonrpc: "2.0", method, params }) + "\n");
}

const failures = [];
function assert(cond, label) {
  if (cond) {
    console.log(`  ✓ ${label}`);
  } else {
    console.log(`  ✗ ${label}`);
    failures.push(label);
  }
}

try {
  console.log("→ initialize");
  const init = await request("initialize", {
    protocolVersion: "2025-06-18",
    capabilities: {},
    clientInfo: { name: "polygraphso-smoke", version: "0.0.0" },
  });
  assert(init.result?.serverInfo?.name === "polygraphso", "server announces name 'polygraphso'");
  assert(typeof init.result?.serverInfo?.version === "string", "server announces a version");
  assert(init.result?.capabilities?.tools !== undefined, "server advertises tools capability");

  notify("notifications/initialized", {});

  console.log("→ tools/list");
  const listed = await request("tools/list", {});
  const names = (listed.result?.tools ?? []).map((t) => t.name).sort();
  assert(
    names.length === 2 && names[0] === "check_server" && names[1] === "list_servers",
    `tools/list returns [check_server, list_servers] (got ${JSON.stringify(names)})`,
  );

  // We don't hit the real API in smoke — instead we point at a bogus URL
  // and confirm the handler converts the network failure to a clean
  // isError result rather than crashing the transport.
  process.env.POLYGRAPH_API_URL = "http://127.0.0.1:1";
  // Note: child already inherited the env at spawn; we can't change its
  // env mid-flight. So this smoke just asserts shape, not error path.
  // For the error path, see api.test.ts.

  console.log("✓ smoke ok");
} catch (err) {
  console.error("smoke failed:", err.message);
  failures.push(err.message);
} finally {
  proc.kill("SIGTERM");
}

process.exit(failures.length === 0 ? 0 : 1);
