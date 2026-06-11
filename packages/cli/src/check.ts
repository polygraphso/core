/**
 * `polygraph check <ref>` — POSTs the ref to /api/cli/check, prints the
 * result. Plain text only; output strings match the CLI brief verbatim.
 *
 * Voice: brand-foundation.md — plain English, no startup register. The
 * arrow prefix (`→ `) is the one nod to a "format" — it's an ASCII-safe
 * marker that scans as a line of output, not decoration.
 */

import { NETWORK_FAILURE_LINE, checkUrl } from "./api.js";
import { RefParseError, canonicalRef, parseRef } from "./identity.js";

type ApiResponse =
  | {
      status: "tracked";
      adoption_tier: "top10" | "top25" | "top50" | "top100" | null;
      polygraph: unknown;
      polygraph_detail?: {
        methodology_version?: string;
        computed_at?: string;
        evidence_url?: string | null;
      } | null;
      notify_url: string;
    }
  | {
      status: "not_available";
      notify_url: string;
    };

const GRADES = new Set(["A", "B", "D", "F"]);

const TIER_LABEL: Record<string, string> = {
  top10: "top 10 adoption",
  top25: "top 25 adoption",
  top50: "top 50 adoption",
  top100: "top 100 adoption",
};

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

  const canonical = canonicalRef(parsed);

  let res: Response;
  try {
    res = await fetch(checkUrl(), {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ server_ref: canonical }),
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

  if (body.status === "tracked") {
    const tierLine = body.adoption_tier
      ? `→ tracked · ${TIER_LABEL[body.adoption_tier]}`
      : "→ tracked";

    let polyLine = "→ polygraph: not yet available";
    let extraLines = `→ notify me → ${displayUrl}`;
    if (typeof body.polygraph === "string" && GRADES.has(body.polygraph)) {
      const detail = body.polygraph_detail ?? null;
      const method = detail?.methodology_version ?? "litmus-v1";
      const date = detail?.computed_at ? detail.computed_at.slice(0, 10) : null;
      polyLine = `→ polygraph: ${body.polygraph} · ${method}${date ? ` · ${date}` : ""}`;
      const evidence = detail?.evidence_url;
      extraLines = evidence
        ? `→ evidence → ${evidence.replace(/^https?:\/\//, "")}`
        : `→ updates → ${displayUrl}`;
    }

    process.stdout.write(`${tierLine}\n${polyLine}\n${extraLines}\n`);
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
