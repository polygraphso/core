/**
 * `polygraphso list` — GETs every tracked server, prints a column-aligned
 * table. `--json` emits the raw API response for piping into `jq`.
 *
 * Sort comes from the server; the CLI just renders.
 *
 * Layout: server_ref | tier label | polygraph status. Tier and polygraph
 * are short fixed-width strings. server_ref is the variable column — we
 * size it to the longest real ref + 2, capped so total width stays
 * <= MAX_WIDTH on narrow terminals; refs past the cap get truncated with
 * an ellipsis. No line wrapping.
 */

import { NETWORK_FAILURE_LINE, listUrl } from "./api.js";

interface ListEntry {
  server_ref: string;
  adoption_tier: "top10" | "top25" | "top50" | "top100" | null;
  polygraph: null | "pending" | "A" | "B" | "D" | "F";
  // Surfaced in --json for tooling; the human table stays a tight overview
  // (the per-server methodology version shows in `check`).
  methodology_version?: string | null;
}

interface ListResponse {
  servers: ListEntry[];
  total: number;
}

const TIER_LABEL: Record<string, string> = {
  top10: "top 10",
  top25: "top 25",
  top50: "top 50",
  top100: "top 100",
};
const TIER_LABEL_WIDTH = 8; // "top 100" + breathing room
const POLY_COL_WIDTH = 9;   // "pending" / single letter — pad to 9

const MAX_WIDTH = 100;
const MIN_REF_WIDTH = 30;
const GAP = 4; // spaces between columns

function tierLabel(tier: ListEntry["adoption_tier"]): string {
  return tier ? TIER_LABEL[tier] ?? "" : "—";
}

function polyLabel(grade: ListEntry["polygraph"]): string {
  if (grade === null) return "pending";
  return grade; // 'pending' literal or A–F
}

function padRight(s: string, width: number): string {
  if (s.length >= width) return s;
  return s + " ".repeat(width - s.length);
}

/**
 * Decide the server_ref column width given the rendered set and the
 * terminal width. Returns the chosen width; refs longer than that get
 * truncated with `…`.
 */
function chooseRefWidth(refs: readonly string[], termCols: number): number {
  const longest = refs.reduce((max, r) => Math.max(max, r.length), 0);
  const fixedTail = GAP + TIER_LABEL_WIDTH + GAP + POLY_COL_WIDTH;
  const cap = Math.max(MIN_REF_WIDTH, Math.min(termCols, MAX_WIDTH) - fixedTail);
  return Math.min(longest, cap);
}

function truncate(s: string, width: number): string {
  if (s.length <= width) return s;
  return s.slice(0, Math.max(1, width - 1)) + "…";
}

function termWidth(): number {
  const cols = process.stdout.columns;
  return typeof cols === "number" && cols > 0 ? cols : 80;
}

interface ListArgs {
  json: boolean;
  unknown: string[];
}

function parseArgs(argv: readonly string[]): ListArgs {
  const out: ListArgs = { json: false, unknown: [] };
  for (const a of argv) {
    if (a === "--json") out.json = true;
    else out.unknown.push(a);
  }
  return out;
}

export async function runList(argv: readonly string[]): Promise<number> {
  const args = parseArgs(argv);
  if (args.unknown.length > 0) {
    process.stderr.write(
      `polygraphso list: unknown argument "${args.unknown[0]}". Try --json or no flags.\n`,
    );
    return 2;
  }

  let res: Response;
  try {
    res = await fetch(listUrl(), { method: "GET" });
  } catch {
    process.stderr.write(NETWORK_FAILURE_LINE + "\n");
    return 1;
  }

  if (!res.ok) {
    process.stderr.write(`polygraphso: server returned ${res.status}. Try again in a moment.\n`);
    return 1;
  }

  let body: ListResponse;
  try {
    body = (await res.json()) as ListResponse;
  } catch {
    process.stderr.write("polygraphso: malformed response from server.\n");
    return 1;
  }

  if (args.json) {
    process.stdout.write(JSON.stringify(body, null, 2) + "\n");
    return 0;
  }

  if (body.total === 0) {
    process.stdout.write("no servers tracked yet.\n");
    return 0;
  }

  const refs = body.servers.map((s) => s.server_ref);
  const refWidth = chooseRefWidth(refs, termWidth());

  const lines = body.servers.map((s) => {
    const ref = padRight(truncate(s.server_ref, refWidth), refWidth);
    const tier = padRight(tierLabel(s.adoption_tier), TIER_LABEL_WIDTH);
    const poly = polyLabel(s.polygraph);
    return `${ref}${" ".repeat(GAP)}${tier}${" ".repeat(GAP)}${poly}`;
  });

  // Blank line above and below the table for breathing room, then the
  // footer. Matches the brief's layout.
  process.stdout.write("\n" + lines.join("\n") + "\n\n");
  process.stdout.write(
    `${body.total} servers tracked. Run \`polygraphso check <ref>\` for details.\n`,
  );
  return 0;
}

export const __testing = { chooseRefWidth, truncate, padRight };
