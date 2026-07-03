#!/usr/bin/env node
/**
 * `polygraphso` — CLI entry. Dispatches subcommands; minimal arg parsing,
 * native Node 18+ fetch, zero runtime deps.
 *
 * The binary is `polygraphso` (the npm name; `polygraph` was already taken).
 * The product noun is still "polygraph" in all human-facing copy.
 *
 * Commands: `check`, `list`, `request`. `login`, `watch` land with the
 * onboarding session.
 */

import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import { runCheck } from "./check.js";
import { runList } from "./list.js";
import { runRequest } from "./request.js";

const HELP = [
  "polygraph — independent, lab-evaluated trust grades for AI agents.",
  "",
  "usage:",
  "  polygraphso check <registry>/<owner>/<name>",
  "  polygraphso request <registry>/<owner>/<name>",
  "  polygraphso list [--json]",
  "  polygraphso --version",
  "  polygraphso --help",
  "",
  "examples:",
  "  polygraphso check npm/@modelcontextprotocol/server-filesystem",
  "  polygraphso request pypi/mcp-server-git",
  "  polygraphso check github/owner/repo",
  "  polygraphso list",
  "  polygraphso list --json",
  "",
  "`request` adds an ungraded server to the public grading queue (free).",
  "More at https://polygraph.so",
].join("\n");

function readVersion(): string {
  const here = dirname(fileURLToPath(import.meta.url));
  // dist/cli.js → ../package.json
  const pkgPath = resolve(here, "..", "package.json");
  const pkg = JSON.parse(readFileSync(pkgPath, "utf-8")) as { version?: string };
  return pkg.version ?? "0.0.0";
}

async function main(argv: readonly string[]): Promise<number> {
  if (argv.length === 0 || argv[0] === "--help" || argv[0] === "-h" || argv[0] === "help") {
    process.stdout.write(HELP + "\n");
    return 0;
  }

  if (argv[0] === "--version" || argv[0] === "-v") {
    process.stdout.write(readVersion() + "\n");
    return 0;
  }

  if (argv[0] === "check") {
    return runCheck(argv.slice(1));
  }

  if (argv[0] === "request") {
    return runRequest(argv.slice(1));
  }

  if (argv[0] === "list") {
    return runList(argv.slice(1));
  }

  process.stderr.write(`polygraphso: unknown command "${argv[0]}".\n\n${HELP}\n`);
  return 2;
}

main(process.argv.slice(2)).then(
  (code) => process.exit(code),
  (err) => {
    const msg = err instanceof Error ? err.message : String(err);
    process.stderr.write(`polygraphso: ${msg}\n`);
    process.exit(1);
  },
);
