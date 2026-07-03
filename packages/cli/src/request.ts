/**
 * `polygraphso request <ref>` — add an ungraded server to the public grading
 * queue via POST /api/cli/grade-request. Free, best-effort; the natural
 * follow-up to a `check` that came back "not available yet". Read the grade
 * later with `polygraphso check <ref>`.
 *
 * Voice: brand-foundation.md — plain English, arrow-prefixed output lines.
 */

import { NETWORK_FAILURE_LINE, requestUrl } from "./api.js";
import { RefParseError, canonicalRef, parseRef } from "./identity.js";

interface QueuedResponse {
  status: "queued";
  created: boolean;
  demand: number;
}

const USAGE_HINT = [
  "polygraphso request adds a server to the public grading queue.",
  "examples:",
  "  polygraphso request npm/@modelcontextprotocol/server-filesystem",
  "  polygraphso request pypi/mcp-server-git",
  "  polygraphso request github/owner/repo",
].join("\n");

function formatQueued(ref: string, body: { created: boolean; demand: number }): string {
  const n = body.demand;
  const plural = n === 1 ? "" : "s";
  const lines = body.created
    ? [`→ queued ${ref} for grading`]
    : [`→ ${ref} is already in the queue`];
  lines.push(`→ ${n} request${plural} so far · graded best-effort`);
  lines.push(`→ check back → polygraphso check ${ref}`);
  return lines.join("\n");
}

/** Returns the exit code; the CLI entry hands it to process.exit. */
export async function runRequest(args: readonly string[]): Promise<number> {
  const ref = args[0];
  if (!ref) {
    process.stderr.write(USAGE_HINT + "\n");
    return 2;
  }

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

  // The queue is versionless — a grade is keyed to the canonical server, so a
  // pinned @version is dropped here.
  const canonical = canonicalRef(parsed);

  let res: Response;
  try {
    res = await fetch(requestUrl(), {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ server_ref: canonical, source: "cli" }),
    });
  } catch {
    process.stderr.write(NETWORK_FAILURE_LINE + "\n");
    return 1;
  }

  if (res.status === 400) {
    process.stderr.write(USAGE_HINT + "\n");
    return 2;
  }

  if (!res.ok) {
    process.stderr.write(`polygraphso: server returned ${res.status}. Try again in a moment.\n`);
    return 1;
  }

  let body: QueuedResponse;
  try {
    body = (await res.json()) as QueuedResponse;
  } catch {
    process.stderr.write("polygraphso: malformed response from server.\n");
    return 1;
  }

  process.stdout.write(formatQueued(canonical, body) + "\n");
  return 0;
}

export const __testing = { formatQueued, USAGE_HINT };
