/**
 * `polygraph check <ref>` — POSTs the ref to /api/cli/check, prints the
 * result. Plain text only; output strings match the CLI brief verbatim.
 *
 * Voice: brand-foundation.md — plain English, no startup register. The
 * arrow prefix (`→ `) is the one nod to a "format" — it's an ASCII-safe
 * marker that scans as a line of output, not decoration.
 */

import { readFileSync } from "node:fs";
import { join } from "node:path";
import { NETWORK_FAILURE_LINE, checkUrl } from "./api.js";
import { RefParseError, canonicalRef, parseRef, type ParsedRef } from "./identity.js";

type ApiResponse =
  | {
      status: "graded";
      polygraph: unknown;
      polygraph_detail?: {
        methodology_version?: string;
        computed_at?: string;
        evidence_url?: string | null;
        resolved_version?: string | null;
      } | null;
      notify_url: string;
      /** The version in play (installed/pinned, else registry latest). */
      current_version?: string | null;
      /** false when a different (older) graded version is shown as a fallback. */
      version_match?: boolean | null;
    }
  | {
      status: "not_available";
      notify_url: string;
    };

const GRADES = new Set(["A", "B", "C", "D", "F"]);

/**
 * The version of an npm package as installed in the current project, so a bare
 * `polygraphso check npm/foo` reports the grade for the version you'd actually
 * run. Reads the top-level `node_modules/<pkg>/package.json` (covers hoisted
 * npm/pnpm/yarn installs); null when not installed, leaving the server to
 * resolve the registry's current latest. npm only — pypi/github resolve server-side.
 */
function installedNpmVersion(parsed: ParsedRef): string | null {
  if (parsed.registry !== "npm") return null;
  const pkg = parsed.owner ? `${parsed.owner}/${parsed.name}` : parsed.name;
  try {
    const path = join(process.cwd(), "node_modules", ...pkg.split("/"), "package.json");
    const json = JSON.parse(readFileSync(path, "utf8")) as { version?: unknown };
    return typeof json.version === "string" ? json.version : null;
  } catch {
    return null;
  }
}

const USAGE_HINT = [
  "polygraphso check requires a registry-prefixed ref.",
  "examples:",
  "  polygraphso check npm/@modelcontextprotocol/server-filesystem",
  "  polygraphso check pypi/mcp-server-git",
  "  polygraphso check github/owner/repo",
].join("\n");

/** Returns the exit code; the CLI entry hands it to process.exit. */
export async function runCheck(args: readonly string[]): Promise<number> {
  const ref = args[0];
  if (!ref) {
    process.stderr.write(USAGE_HINT + "\n");
    return 2;
  }

  // Reject obvious junk before we hit the network. The API would also
  // 400 these, but we save a round-trip and the user gets the same hint.
  let parsed;
  try {
    parsed = parseRef(ref);
  } catch (err) {
    if (err instanceof RefParseError) {
      process.stderr.write(USAGE_HINT + "\n");
      return 2;
    }
    throw err;
  }

  // Resolve the version in play: a pinned ref is exact; otherwise pin the
  // locally-installed version so we report the grade for what you'd actually run.
  // If nothing is installed, send the bare ref and the server resolves the
  // registry's current latest. The versionless canonical keys the demand counter.
  const canonical = canonicalRef(parsed);
  const effectiveVersion = parsed.version ?? installedNpmVersion(parsed);
  const serverRef = effectiveVersion ? `${canonical}@${effectiveVersion}` : canonical;

  let res: Response;
  try {
    res = await fetch(checkUrl(), {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ server_ref: serverRef }),
    });
  } catch {
    process.stderr.write(NETWORK_FAILURE_LINE + "\n");
    return 1;
  }

  if (res.status === 400) {
    // The server reproduces RefParseError messages here. Surface the
    // usage hint rather than the raw 400 body — the user mistyped a ref.
    process.stderr.write(USAGE_HINT + "\n");
    return 2;
  }

  if (!res.ok) {
    process.stderr.write(`polygraphso: server returned ${res.status}. Try again in a moment.\n`);
    return 1;
  }

  let body: ApiResponse;
  try {
    body = (await res.json()) as ApiResponse;
  } catch {
    process.stderr.write("polygraphso: malformed response from server.\n");
    return 1;
  }

  // Brief shows the notify URL without the protocol scheme; strip it for
  // display. The API still returns the canonical https:// form.
  const displayUrl = body.notify_url.replace(/^https?:\/\//, "");

  if (body.status === "graded" && typeof body.polygraph === "string" && GRADES.has(body.polygraph)) {
    const detail = body.polygraph_detail ?? null;
    const method = detail?.methodology_version ?? "litmus";
    const date = detail?.computed_at ? detail.computed_at.slice(0, 10) : null;
    const gradedVer = detail?.resolved_version ?? null;
    const ver = gradedVer ? ` · version ${gradedVer}` : "";
    const polyLine = `→ polygraph: ${body.polygraph}${ver} · ${method}${date ? ` · ${date}` : ""}`;
    const lines = [polyLine];
    // Freshness: the graded version differs from the version in play.
    const currentVer = body.current_version ?? null;
    if (body.version_match === false && currentVer && gradedVer && currentVer !== gradedVer) {
      lines.push(`→ note: graded ${gradedVer}; your version is ${currentVer} (not yet graded)`);
    }
    const evidence = detail?.evidence_url;
    lines.push(
      evidence
        ? `→ evidence → ${evidence.replace(/^https?:\/\//, "")}`
        : `→ details → polygraph.so/#checks`,
    );
    process.stdout.write(lines.join("\n") + "\n");
    return 0;
  }

  if (body.status === "not_available") {
    process.stdout.write(
      `→ not available yet\n→ notify me → ${displayUrl}\n`,
    );
    return 0;
  }

  process.stderr.write("polygraphso: unexpected response from server.\n");
  return 1;
}

export const __testing = { USAGE_HINT };
