/**
 * Manual probe: run every available adapter against a single server ref
 * and print the result. Useful for debugging the scoring loop ("what did
 * scoring see for X?") without dropping into a REPL.
 *
 * Usage:
 *   pnpm --filter @polygraph/scoring probe <ref>
 *
 * Refs:
 *   npm/@modelcontextprotocol/server-filesystem    (scoped npm)
 *   npm/lodash                                     (unscoped npm)
 *   pypi/mcp-server-git                            (pypi — flat namespace)
 *   github/modelcontextprotocol/servers            (github direct)
 *
 * For npm and pypi refs, the github adapter chains automatically via the
 * package's repository URL. OpenSSF, deps.dev, Glama, and Smithery are
 * called when the ref allows (their identity model differs — see code).
 *
 * Reads SUPABASE_URL/SUPABASE_SERVICE_ROLE_KEY and GITHUB_TOKEN from
 * `.env` at the repo root (no DB writes — purely read-side).
 */

import { parseServerRef, type ParsedServerRef } from "@polygraph/core";
import { fetchDepsDev } from "../adapters/depsdev.js";
import { fetchGitHub } from "../adapters/github.js";
import { fetchGlama } from "../adapters/glama.js";
import { fetchNpm } from "../adapters/npm.js";
import { fetchOpenSSF } from "../adapters/openssf.js";
import { fetchPypi } from "../adapters/pypi.js";
import { fetchSmithery } from "../adapters/smithery.js";

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

/**
 * Best-effort translation from polygraph ref to Glama's namespace/slug.
 * Glama drops npm's leading `@scope` `@` and uses `scope` directly.
 * Returns null when no reasonable translation exists.
 */
function glamaIdentityFor(parsed: ParsedServerRef): { namespace: string; slug: string } | null {
  if (parsed.registry === "npm" && parsed.owner) {
    return { namespace: parsed.owner.replace(/^@/, ""), slug: parsed.name };
  }
  return null;
}

/**
 * Smithery's qualifiedName commonly matches the scoped npm identifier
 * (e.g. `@modelcontextprotocol/server-filesystem`). 404 is expected and
 * non-fatal — many polygraph-tracked servers won't be on Smithery.
 */
function smitheryIdentityFor(parsed: ParsedServerRef): string | null {
  if (parsed.registry === "npm" && parsed.owner) {
    return `${parsed.owner}/${parsed.name}`;
  }
  return null;
}

async function runOpenSSF(owner: string, repo: string): Promise<void> {
  section(`openssf (chained): ${owner}/${repo}`);
  const data = await timed("fetchOpenSSF", () => fetchOpenSSF(owner, repo));
  if (data === null) {
    console.log("(not in Scorecard dataset)");
  } else {
    console.dir(data, { depth: 4 });
  }
}

async function runChainedGitHub(owner: string, repo: string): Promise<void> {
  section(`github (chained): ${owner}/${repo}`);
  const data = await timed("fetchGitHub", () => fetchGitHub(owner, repo));
  console.dir(data, { depth: 4 });
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

  let githubOwnerRepo: { owner: string; repo: string } | null = null;

  if (parsed.registry === "npm") {
    const pkg = parsed.owner ? `${parsed.owner}/${parsed.name}` : parsed.name;
    section(`npm: ${pkg}`);
    const npm = await timed("fetchNpm", () => fetchNpm(pkg));
    console.dir(npm, { depth: 4 });
    githubOwnerRepo = npm?.github_owner_repo ?? null;

    section(`depsdev (npm): ${pkg}`);
    const depsdev = await timed("fetchDepsDev", () => fetchDepsDev(pkg, "npm"));
    if (depsdev === null) console.log("(not on deps.dev)");
    else console.dir(depsdev, { depth: 4 });
  } else if (parsed.registry === "pypi") {
    section(`pypi: ${parsed.name}`);
    const pypi = await timed("fetchPypi", () => fetchPypi(parsed.name));
    console.dir(pypi, { depth: 4 });
    githubOwnerRepo = pypi?.github_owner_repo ?? null;

    section(`depsdev (pypi): ${parsed.name}`);
    const depsdev = await timed("fetchDepsDev", () => fetchDepsDev(parsed.name, "pypi"));
    if (depsdev === null) console.log("(not on deps.dev)");
    else console.dir(depsdev, { depth: 4 });
  } else if (parsed.registry === "github") {
    if (!parsed.owner) throw new Error("github refs require owner/repo");
    githubOwnerRepo = { owner: parsed.owner, repo: parsed.name };
  }

  if (githubOwnerRepo) {
    await runChainedGitHub(githubOwnerRepo.owner, githubOwnerRepo.repo);
    await runOpenSSF(githubOwnerRepo.owner, githubOwnerRepo.repo);
  }

  const glama = glamaIdentityFor(parsed);
  if (glama) {
    section(`glama: ${glama.namespace}/${glama.slug}`);
    const data = await timed("fetchGlama", () => fetchGlama(glama.namespace, glama.slug));
    if (data === null) console.log("(not on Glama)");
    else console.dir(data, { depth: 4 });
  }

  const smithery = smitheryIdentityFor(parsed);
  if (smithery) {
    section(`smithery: ${smithery}`);
    const data = await timed("fetchSmithery", () => fetchSmithery(smithery));
    if (data === null) console.log("(not on Smithery)");
    else console.dir(data, { depth: 4 });
  }
}

main().catch((err: unknown) => {
  console.error(err);
  process.exit(1);
});
