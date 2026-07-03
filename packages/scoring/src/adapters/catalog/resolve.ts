/**
 * Resolve a discovered catalog server into a runnable grading target — the ref
 * the litmus harness can actually launch/connect to. A bare github repo isn't
 * gradeable; an npm/pypi ref or a remote https MCP URL is.
 *
 * Tiered, cheapest first:
 *   1. npm via package.json — read the repo's root package.json, verify the name
 *      on the npm registry with a repository backlink. Catches clean, single-
 *      package npm servers deterministically, no scraping.
 *   2. Glama config block — fetch the provider page and parse the embedded MCP
 *      client config ("command"/"args"), which Glama already resolved. Catches
 *      remote https URLs (via mcp-remote), pypi (uvx), and the npm packages that
 *      tier 1 misses (private/workspace-root monorepos → one representative).
 *   3. README shell command — on the same page, recover a registry install
 *      documented as a code-block command (`uvx <pkg>` / `npx -y <pkg>` /
 *      `uv tool install <pkg>`) rather than structured JSON. Freeform text is
 *      noisy, so a candidate is accepted only when it (a) names this server and
 *      (b) actually exists on its registry.
 *
 * Targets are formatted to match hosted_runs.target exactly: `npm/<pkg>`,
 * `pypi/<pkg>` (no version tag), or a query-stripped `https://` URL — so the
 * coverage join is an exact match.
 */

import type { CatalogGradingKind } from "@polygraph/core";
import { fetchWithRetry } from "../fetch.js";
import { normalizeRepoKey } from "./index.js";

const BROWSER_UA =
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36";

export interface ResolvedTarget {
  kind: CatalogGradingKind;
  /** 'npm/<pkg>' | 'pypi/<pkg>' | 'https://…' */
  target: string;
  source: "npm_pkgjson" | "glama_config" | "readme_command";
}

export type ResolveOutcome =
  | { status: "resolved"; target: ResolvedTarget }
  | { status: "unresolved" }
  | { status: "error"; message: string };

// ── Pure helpers (unit-tested) ──────────────────────────────────────────────

/**
 * Drop a trailing `@version` from a package spec, keeping a leading scope `@`.
 *   tavily-mcp@latest                       → tavily-mcp
 *   @modelcontextprotocol/server-github@0.4 → @modelcontextprotocol/server-github
 *   @upstash/context7-mcp                   → @upstash/context7-mcp (scope @ kept)
 */
export function stripVersion(pkg: string): string {
  const at = pkg.lastIndexOf("@");
  return at > 0 ? pkg.slice(0, at) : pkg;
}

/** Canonical https target: drop the query string (placeholder auth) + trailing slash. */
export function normalizeUrlTarget(url: string): string {
  const noQuery = url.split("?")[0] ?? url;
  return noQuery.replace(/\/+$/, "");
}

/** The npm package name from a root package.json, or null if private / nameless. */
export function npmNameFromPackageJson(text: string): string | null {
  let pj: { name?: unknown; private?: unknown };
  try {
    pj = JSON.parse(text) as typeof pj;
  } catch {
    return null;
  }
  if (pj.private === true) return null; // workspace root / unpublished
  return typeof pj.name === "string" && pj.name.trim().length > 0 ? pj.name.trim() : null;
}

const ENTITIES: Record<string, string> = {
  "&quot;": '"',
  "&#34;": '"',
  "&lt;": "<",
  "&gt;": ">",
  "&#39;": "'",
  "&#x27;": "'",
  "&amp;": "&",
};

function decodeEntities(s: string): string {
  return s.replace(/&(?:quot|#34|lt|gt|#39|#x27|amp);/g, (m) => ENTITIES[m] ?? m);
}

/** Every quoted string inside an `"args": [ … ]` array body. */
function quotedStrings(body: string): string[] {
  const out: string[] = [];
  const re = /"((?:[^"\\]|\\.)*)"/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(body)) !== null) out.push(m[1]!);
  return out;
}

/**
 * A plausible npm/pypi package spec — not a github/file/url/path install. `npx`
 * and `uvx` happily launch `github:owner/repo`, `git+https://…`, tarball URLs,
 * or local paths; none of those are a registry package the harness can grade as
 * `npm/<pkg>` / `pypi/<pkg>`, so reject them.
 */
function looksLikePackageSpec(token: string): boolean {
  if (token.length === 0) return false;
  if (token.includes(":")) return false; // github:/git+https://http:// etc.
  if (token.startsWith(".") || token.startsWith("/")) return false; // local path
  return true;
}

/** Lowercase alphanumerics only — for comparing package names to slugs. */
function normName(s: string): string {
  return s.toLowerCase().replace(/[^a-z0-9]/g, "");
}

/**
 * Packages that show up in READMEs but are never the server's own gradeable
 * artifact: the MCP SDK/inspector, generic launchers, and common dev tooling.
 */
const GENERIC_README_PKGS = new Set([
  "mcp", "fastmcp", "mcp-remote", "modelcontextprotocol",
  "tsx", "tsc", "typescript", "wrangler", "vite", "esbuild", "nodemon", "ts-node",
  "pyyaml", "pip", "pipx", "uv", "poetry", "setuptools", "wheel", "hatch",
  "@modelcontextprotocol/inspector", "@modelcontextprotocol/sdk",
  // Framework / build CLIs that appear in `npx …` setup lines but are never the
  // server's own package (the server names itself `<framework>-mcp`).
  "expo", "next", "nuxt", "astro", "remix", "svelte", "turbo", "nx",
  "serve", "http-server", "concurrently", "pm2", "create-react-app",
]);

/** Clean a token captured from freeform shell text into a bare package spec, or null. */
function cleanPackageToken(raw: string): string | null {
  const m = /^[@A-Za-z0-9._/-]+/.exec(raw);
  if (!m) return null;
  const tok = m[0].replace(/[.\-_/]+$/, ""); // strip trailing punctuation / stray slash
  return tok.length > 0 ? tok : null;
}

/**
 * Extract candidate install/run packages from a page's freeform text (README +
 * rendered code blocks) — the shell-command form the structured mcpServers-JSON
 * parser doesn't see. Conservative: registry-installable launchers only
 * (uv tool install / pip install / uvx / npx), with the bare SDK, generic
 * tooling, mcp-remote, and create-* scaffolders filtered out. The name is NOT
 * yet confirmed to be this server's package — matchesServerName + a registry
 * existence check gate that downstream.
 */
export function parseReadmeRunCommands(text: string): { kind: CatalogGradingKind; pkg: string }[] {
  const out: { kind: CatalogGradingKind; pkg: string }[] = [];
  const seen = new Set<string>();
  const push = (kind: "npm" | "pypi", raw: string | undefined) => {
    if (!raw) return;
    const cleaned = cleanPackageToken(raw);
    if (!cleaned || !looksLikePackageSpec(cleaned)) return;
    const pkg = stripVersion(cleaned);
    if (GENERIC_README_PKGS.has(pkg.toLowerCase())) return;
    if (pkg.startsWith("create-")) return; // scaffolders, not the server
    const key = `${kind}/${pkg}`;
    if (seen.has(key)) return;
    seen.add(key);
    out.push({ kind, pkg });
  };

  // Install-name forms first — most reliable, this IS the published package name.
  for (const m of text.matchAll(/\buv\s+tool\s+install\s+(\S+)/g)) push("pypi", m[1]);
  for (const m of text.matchAll(/\b(?:pipx|pip3?)\s+install\s+(\S+)/g)) push("pypi", m[1]);
  // Run forms.
  for (const m of text.matchAll(/\buvx\s+(?:--from\s+(\S+)|(\S+))/g)) push("pypi", m[1] ?? m[2]);
  for (const m of text.matchAll(/\bnpx\s+(?:-y\s+|--yes\s+)?(\S+)/g)) {
    if (m[1] !== "mcp-remote") push("npm", m[1]);
  }
  return out;
}

/**
 * Does `pkg` plausibly name THIS server (vs an unrelated tool mentioned in the
 * README)? Compares significant name parts (mcp/server affixes stripped) of the
 * package against the server's slug / repo name. Guards against the bare SDK and
 * generic collisions: a package whose significant name is too short, or a slug
 * that carries no signal beyond mcp/server, never matches.
 */
export function matchesServerName(pkg: string, slug: string | null, repoName: string | null): boolean {
  if (normName(pkg).length < 4) return false; // "mcp", "tsx", …
  const sig = (s: string) => normName(s).replace(/mcp|server/g, "");
  const p = sig(pkg);
  if (p.length < 3) return false;
  const targets = [slug, repoName]
    .filter((x): x is string => !!x)
    .map(sig)
    .filter((t) => t.length >= 3);
  return targets.some((t) => p.includes(t) || t.includes(p));
}

/** Map a launch command + its arg tokens to a grading target, or null. */
function targetFromCommand(program: string, tokens: string[]): Omit<ResolvedTarget, "source"> | null {
  // Windows wrapper: `cmd /c npx -y <pkg>` → unwrap to the real launcher.
  if (program === "cmd") {
    const idx = tokens.findIndex((t) => t === "npx" || t === "uvx");
    if (idx === -1) return null;
    return targetFromCommand(tokens[idx]!, tokens.slice(idx + 1));
  }

  if (program === "npx") {
    if (tokens.includes("mcp-remote")) {
      const url = tokens.find((t) => /^https?:\/\//i.test(t));
      return url ? { kind: "url", target: normalizeUrlTarget(url) } : null;
    }
    const pkg = tokens.find((t) => !t.startsWith("-") && t !== "mcp-remote");
    return pkg && looksLikePackageSpec(pkg) ? { kind: "npm", target: `npm/${stripVersion(pkg)}` } : null;
  }

  if (program === "uvx") {
    const fromIdx = tokens.indexOf("--from");
    const pkg = fromIdx >= 0 ? tokens[fromIdx + 1] : tokens.find((t) => !t.startsWith("-"));
    return pkg && looksLikePackageSpec(pkg) ? { kind: "pypi", target: `pypi/${stripVersion(pkg)}` } : null;
  }

  // docker / node / python / uv-run / deno / … → local build or container,
  // not gradeable as a plain ref in v1.
  return null;
}

/**
 * Parse the runnable target out of a Glama server page's embedded MCP config.
 * Considers every `"command"` block (both the structured `"command":"npx"` +
 * `"args":[…]` form and the full-command-string form), then picks by
 * preference: npm > pypi > url (npm/stdio grades richer than a remote endpoint;
 * for a monorepo the first npm block is the representative). Returns null when
 * the page carries no launchable config — never guesses from a bare `"url"`,
 * which on Glama is page chrome (the founder's profile), not the server.
 */
export function parseGlamaConfigTarget(html: string): ResolvedTarget | null {
  const text = decodeEntities(html);

  const cmdRe = /"command"\s*:\s*"((?:[^"\\]|\\.)*)"/g;
  const commands: { value: string; start: number; end: number }[] = [];
  let m: RegExpExecArray | null;
  while ((m = cmdRe.exec(text)) !== null) {
    commands.push({ value: m[1]!, start: m.index, end: m.index + m[0].length });
  }

  const candidates: Omit<ResolvedTarget, "source">[] = [];
  for (let i = 0; i < commands.length; i++) {
    const cmd = commands[i]!;
    let program: string;
    let tokens: string[];

    if (/\s/.test(cmd.value.trim())) {
      // Full command line packed into "command".
      const parts = cmd.value.trim().split(/\s+/);
      program = parts[0]!;
      tokens = parts.slice(1);
    } else {
      program = cmd.value.trim();
      // Its "args" array lives between this command and the next one.
      const windowEnd = commands[i + 1]?.start ?? Math.min(cmd.end + 400, text.length);
      const argsMatch = /"args"\s*:\s*\[([^\]]*)\]/.exec(text.slice(cmd.end, windowEnd));
      tokens = argsMatch ? quotedStrings(argsMatch[1]!) : [];
    }

    const t = targetFromCommand(program, tokens);
    if (t) candidates.push(t);
  }

  if (candidates.length === 0) return null;
  const byKind = (k: CatalogGradingKind) => candidates.find((c) => c.kind === k);
  const chosen = byKind("npm") ?? byKind("pypi") ?? byKind("url") ?? null;
  return chosen ? { ...chosen, source: "glama_config" } : null;
}

// ── Network tiers ────────────────────────────────────────────────────────────

/** owner/repo for a github repository URL, else null (only github in tier 1). */
function githubOwnerRepo(repositoryUrl: string): string | null {
  const key = normalizeRepoKey(repositoryUrl); // github.com/owner/repo
  if (!key.startsWith("github.com/")) return null;
  const rest = key.slice("github.com/".length);
  return /^[^/]+\/[^/]+$/.test(rest) ? rest : null;
}

/** Tier 1: repo root package.json → npm registry verify (with repo backlink). */
async function resolveViaPackageJson(repositoryUrl: string): Promise<ResolvedTarget | null> {
  const ownerRepo = githubOwnerRepo(repositoryUrl);
  if (!ownerRepo) return null;

  const pkgRes = await fetchWithRetry(
    `https://raw.githubusercontent.com/${ownerRepo}/HEAD/package.json`,
    { label: "resolve-pkgjson", headers: { "User-Agent": BROWSER_UA }, passThroughStatuses: [404] },
  );
  if (pkgRes.status === 404) return null;
  const name = npmNameFromPackageJson(await pkgRes.text());
  if (!name) return null;

  const npmRes = await fetchWithRetry(`https://registry.npmjs.org/${name}`, {
    label: "resolve-npm",
    headers: { "User-Agent": BROWSER_UA },
    passThroughStatuses: [404],
  });
  if (npmRes.status === 404) return null;

  const meta = (await npmRes.json()) as { repository?: { url?: string } | string };
  const repoField = typeof meta.repository === "string" ? meta.repository : meta.repository?.url;
  // Require a backlink to THIS repo so we never grab an unrelated same-named pkg.
  if (!repoField || !repoField.toLowerCase().includes(ownerRepo.toLowerCase())) return null;

  return { kind: "npm", target: `npm/${name}`, source: "npm_pkgjson" };
}

/** The repo name (last path segment) from a repository URL, for self-name matching. */
function repoNameFromUrl(repositoryUrl: string): string | null {
  const last = normalizeRepoKey(repositoryUrl).split("/").pop() ?? "";
  return last.length > 0 ? last : null;
}

/** Fetch a Glama server page's HTML, or null if the page is gone (404). */
async function fetchGlamaHtml(namespace: string, slug: string): Promise<string | null> {
  const res = await fetchWithRetry(`https://glama.ai/mcp/servers/${namespace}/${slug}`, {
    label: "resolve-glama",
    headers: { "User-Agent": BROWSER_UA },
    passThroughStatuses: [404],
  });
  if (res.status === 404) return null;
  return res.text();
}

/**
 * Verify an npm README candidate. It must exist AND — when we know the server's
 * repo — its npm `repository` must backlink there, exactly as tier 1 requires.
 * That backlink is what tells `<framework>-mcp → npm/<framework>` apart from a
 * real self-published package: the framework's repo is its own, not the server's.
 * With no known repo we fall back to existence (best effort for remote-only rows).
 */
async function npmVerify(pkg: string, ownerRepo: string | null): Promise<boolean> {
  const res = await fetchWithRetry(`https://registry.npmjs.org/${pkg}`, {
    label: "resolve-verify-npm",
    headers: { "User-Agent": BROWSER_UA },
    passThroughStatuses: [404],
  });
  if (res.status < 200 || res.status >= 300) return false;
  if (!ownerRepo) return true;
  const meta = (await res.json()) as { repository?: { url?: string } | string };
  const repoField = typeof meta.repository === "string" ? meta.repository : meta.repository?.url;
  return !!repoField && repoField.toLowerCase().includes(ownerRepo.toLowerCase());
}

/** Verify a pypi README candidate exists (pypi's namespace is far less polluted). */
async function pypiVerify(pkg: string): Promise<boolean> {
  const res = await fetchWithRetry(`https://pypi.org/pypi/${pkg}/json`, {
    label: "resolve-verify-pypi",
    headers: { "User-Agent": BROWSER_UA },
    passThroughStatuses: [404],
  });
  return res.status >= 200 && res.status < 300;
}

/** Decode entities and unescape the JSON-embedded copy of the README. */
function decodeReadme(html: string): string {
  return decodeEntities(html).replace(/\\n/g, "\n").replace(/\\"/g, '"');
}

/**
 * Tier 3: recover a target from a shell-command install documented in the page's
 * README/code blocks (not the structured mcpServers JSON). Only accepts a
 * package that (a) names this server (matchesServerName) and (b) actually exists
 * on its registry — both guards keep precision high on noisy freeform text.
 */
async function resolveViaReadmeCommand(
  html: string,
  slug: string | null,
  repoName: string | null,
  ownerRepo: string | null,
): Promise<ResolvedTarget | null> {
  const candidates = parseReadmeRunCommands(decodeReadme(html)).filter((c) =>
    matchesServerName(c.pkg, slug, repoName),
  );
  for (const c of candidates) {
    if (c.kind === "url") continue; // readme parser only yields npm/pypi
    const ok = c.kind === "npm" ? await npmVerify(c.pkg, ownerRepo) : await pypiVerify(c.pkg);
    if (ok) {
      const target = c.kind === "npm" ? `npm/${c.pkg}` : `pypi/${c.pkg}`;
      return { kind: c.kind, target, source: "readme_command" };
    }
  }
  return null;
}

/** github owner/repo of the official MCP reference servers. */
const OFFICIAL_SERVERS_OWNER_REPO = "modelcontextprotocol/servers";

/**
 * Tier 2 trusts a Glama page's structured config without a repo backlink (unlike
 * tiers 1 and 3), so an example `@modelcontextprotocol/server-*` block — ubiquitous
 * boilerplate copied into unrelated servers' pages — gets borrowed as a bogus
 * target ("Fillout.io MCP Server" → npm/@modelcontextprotocol/server-fillout, or a
 * real official grade mislabelled onto an unrelated row). That scope is published
 * only from the official servers repo, so accept it there and reject it everywhere
 * else, including rows with no known repo (ownership unconfirmable).
 */
export function isBorrowedOfficialTarget(target: string, ownerRepo: string | null): boolean {
  if (!/^npm\/@modelcontextprotocol\/server-/.test(target)) return false;
  return ownerRepo?.toLowerCase() !== OFFICIAL_SERVERS_OWNER_REPO;
}

export interface ResolveInput {
  repositoryUrl: string | null;
  namespace: string | null;
  slug: string | null;
}

/**
 * Resolve one server through the tiers. A tier that finds nothing falls through
 * to the next; a tier whose network call fails is remembered so the overall
 * outcome is 'error' (retried next run) rather than a false 'unresolved'.
 * Tiers 2 and 3 share a single Glama page fetch.
 */
export async function resolveServer(input: ResolveInput): Promise<ResolveOutcome> {
  let hadError = false;
  const repoName = input.repositoryUrl ? repoNameFromUrl(input.repositoryUrl) : null;
  const ownerRepo = input.repositoryUrl ? githubOwnerRepo(input.repositoryUrl) : null;

  // Tier 1 — repo package.json → npm registry verify.
  if (input.repositoryUrl) {
    try {
      const t = await resolveViaPackageJson(input.repositoryUrl);
      if (t) return { status: "resolved", target: t };
    } catch (err) {
      hadError = true;
      console.warn(`[resolve] pkgjson tier failed for ${input.repositoryUrl}: ${String(err)}`);
    }
  }

  // Tiers 2 & 3 — one Glama page fetch, structured config then README command.
  if (input.namespace && input.slug) {
    try {
      const html = await fetchGlamaHtml(input.namespace, input.slug);
      if (html) {
        const structured = parseGlamaConfigTarget(html);
        // Tier 2 has no backlink check, so drop a borrowed official target and
        // fall through to tier 3 (which does verify) rather than resolve a mislabel.
        if (structured && !isBorrowedOfficialTarget(structured.target, ownerRepo)) {
          return { status: "resolved", target: structured };
        }
        const readme = await resolveViaReadmeCommand(html, input.slug, repoName, ownerRepo);
        if (readme) return { status: "resolved", target: readme };
      }
    } catch (err) {
      hadError = true;
      console.warn(`[resolve] glama tier failed for ${input.namespace}/${input.slug}: ${String(err)}`);
    }
  }

  if (hadError) return { status: "error", message: "one or more resolution tiers errored" };
  return { status: "unresolved" };
}
