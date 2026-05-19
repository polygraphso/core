/**
 * One-shot scoring run. Scrapes every tracked server (or --limit N),
 * computes raw dimensions + shared-repo mask + rank/tier, and writes one
 * `adoption_scores` row per server. With --dry-run, prints the would-be
 * results without touching the DB.
 *
 * Usage:
 *   pnpm --filter @polygraph/scoring score
 *   pnpm --filter @polygraph/scoring score -- --limit 5
 *   pnpm --filter @polygraph/scoring score -- --dry-run
 *
 * Phase 5 will wrap this in a daily cron — for now it's a manual admin
 * tool, useful for smoke-testing the math against the real adapter
 * outputs.
 */

import { getSupabaseClient } from "../supabase.js";
import { scoreAllTrackedServers } from "../scoring/orchestrate.js";

interface CliArgs {
  limit?: number;
  dryRun: boolean;
}

function parseArgs(argv: readonly string[]): CliArgs {
  const args: CliArgs = { dryRun: false };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === "--dry-run") {
      args.dryRun = true;
    } else if (a === "--limit") {
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

  console.log(
    `[score] starting${args.limit ? ` (limit=${args.limit})` : ""}${args.dryRun ? " [dry-run]" : ""}`,
  );
  const start = Date.now();
  const result = await scoreAllTrackedServers(supabase, args);
  const elapsed = ((Date.now() - start) / 1000).toFixed(1);

  console.log(`\n[score] complete in ${elapsed}s`);
  console.log(`  scored:  ${result.scored.length} servers`);
  console.log(`  written: ${result.rows_written} adoption_scores rows`);
  if (result.skipped.length > 0) {
    console.log(`  skipped: ${result.skipped.length}`);
    for (const s of result.skipped) console.log(`    - ${s.server_id}: ${s.reason}`);
  }

  console.log(`\nTop 10:`);
  for (const s of result.scored.slice(0, 10)) {
    console.log(`  ${String(s.rank).padStart(2)}.  ${s.score.toString().padStart(5)}  ${s.tier ?? "—".padStart(7)}  ${s.server_id}  (${s.sources_used.join(", ")})`);
  }
}

main().catch((err: unknown) => {
  console.error(err);
  process.exit(1);
});
