/**
 * Manual probe: run every available adapter against a single server ref
 * and print the result. Useful for debugging the scoring loop ("what did
 * scoring see for X?") without dropping into a REPL.
 *
 * Usage:
 *   pnpm --filter @polygraph/scoring probe <ref>
 *
 * Refs:
 *   npm/@modelcontextprotocol/server-filesystem    (scoped npm — chains to github via npm's repository field)
 *   npm/lodash                                     (unscoped npm)
 *   pypi/mcp-server-git                            (pypi — adapter lands in Phase 3)
 *   github/modelcontextprotocol/servers            (github direct)
 *
 * Reads SUPABASE_URL/SUPABASE_SERVICE_ROLE_KEY and GITHUB_TOKEN from
 * `.env` at the repo root (no DB writes — purely read-side).
 */

import { parseServerRef } from "@polygraph/core";
import { fetchGitHub } from "../adapters/github.js";
import { fetchNpm } from "../adapters/npm.js";

const USAGE = `Usage: pnpm --filter @polygraph/scoring probe <ref>
Examples:
  pnpm --filter @polygraph/scoring probe npm/@modelcontextprotocol/server-filesystem
  pnpm --filter @polygraph/scoring probe npm/lodash
  pnpm --filter @polygraph/scoring probe github/modelcontextprotocol/servers
  pnpm --filter @polygraph/scoring probe pypi/mcp-server-git`;

function section(label: string): void {
  console.log(`\n${"━".repeat(70)}`);
  console.log(label);
  console.log("━".repeat(70));
}

async function timed<T>(label: string, fn: () => Promise<T>): Promise<T> {
  const start = Date.now();
  try {
    const result = await fn();
    console.log(`(${label} took ${Date.now() - start}ms)`);
    return result;
  } catch (err) {
    console.log(`(${label} failed after ${Date.now() - start}ms)`);
    throw err;
  }
}

async function main(): Promise<void> {
  const ref = process.argv[2];
  if (!ref) {
    console.error(USAGE);
    process.exit(1);
  }

  const parsed = parseServerRef(ref);
  section(`Parsed ref`);
  console.dir(parsed);

  if (parsed.registry === "npm") {
    const pkg = parsed.owner ? `${parsed.owner}/${parsed.name}` : parsed.name;
    section(`npm: ${pkg}`);
    const npm = await timed("fetchNpm", () => fetchNpm(pkg));
    console.dir(npm, { depth: 4 });

    if (npm?.github_owner_repo) {
      const { owner, repo } = npm.github_owner_repo;
      section(`github (chained from npm.repository): ${owner}/${repo}`);
      const gh = await timed("fetchGitHub", () => fetchGitHub(owner, repo));
      console.dir(gh, { depth: 4 });
    }
  } else if (parsed.registry === "github") {
    if (!parsed.owner) {
      throw new Error("github refs require owner/repo");
    }
    section(`github: ${parsed.owner}/${parsed.name}`);
    const gh = await timed("fetchGitHub", () => fetchGitHub(parsed.owner!, parsed.name));
    console.dir(gh, { depth: 4 });
  } else if (parsed.registry === "pypi") {
    section(`pypi: ${parsed.name}`);
    console.log("pypi adapter lands in Phase 3 — probe will run it once it exists.");
  }
}

main().catch((err: unknown) => {
  console.error(err);
  process.exit(1);
});
