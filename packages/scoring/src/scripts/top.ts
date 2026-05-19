/**
 * Read-side admin: dump the current top-N ranking as JSON. Reads from
 * adoption_scores (latest row per version) — no scoring run is triggered.
 *
 * Usage:
 *   pnpm --filter @polygraph/scoring top
 *   pnpm --filter @polygraph/scoring top -- --limit 50
 *   pnpm --filter @polygraph/scoring top -- --pretty
 */

import { getSupabaseClient } from "../supabase.js";
import { readTopRanked } from "../scoring/reporter.js";

interface CliArgs {
  limit: number;
  pretty: boolean;
}

function parseArgs(argv: readonly string[]): CliArgs {
  const args: CliArgs = { limit: 50, pretty: false };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === "--pretty") args.pretty = true;
    else if (a === "--limit") {
      const n = Number(argv[++i]);
      if (!Number.isFinite(n) || n <= 0) throw new Error("--limit must be a positive number");
      args.limit = n;
    } else if (a?.startsWith("--limit=")) {
      const n = Number(a.slice("--limit=".length));
      if (!Number.isFinite(n) || n <= 0) throw new Error("--limit must be a positive number");
      args.limit = n;
    }
  }
  return args;
}

async function main(): Promise<void> {
  const args = parseArgs(process.argv.slice(2));
  const supabase = getSupabaseClient();
  const rows = await readTopRanked(supabase, args.limit);
  console.log(JSON.stringify(rows, null, args.pretty ? 2 : 0));
}

main().catch((err: unknown) => {
  console.error(err);
  process.exit(1);
});
