/**
 * Hourly version-poll entrypoint. Light pass over every npm/pypi-tracked
 * server: hits the metadata endpoint, compares to `versions`, inserts +
 * NOTIFY when a new version appears.
 *
 * No scoring. The daily `score` job picks up new version_ids through the
 * same code path and writes adoption_scores.
 *
 * Usage:
 *   pnpm --filter @polygraph/scoring poll
 *   pnpm --filter @polygraph/scoring poll -- --limit 10
 *
 * Phase 5b will wrap this in a cron (Hetzner systemd-timer or Supabase
 * Edge Function scheduled trigger — pending the deploy-target decision).
 */

import { getSupabaseClient } from "../supabase.js";
import { pollVersions } from "../scoring/poll-versions.js";

interface CliArgs {
  limit?: number;
}

function parseArgs(argv: readonly string[]): CliArgs {
  const args: CliArgs = {};
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === "--limit") {
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

  console.log(`[poll] starting${args.limit ? ` (limit=${args.limit})` : ""}`);
  const start = Date.now();
  const result = await pollVersions(supabase, args);
  const elapsed = ((Date.now() - start) / 1000).toFixed(1);

  console.log(`\n[poll] complete in ${elapsed}s`);
  console.log(`  checked:      ${result.checked} servers`);
  console.log(`  new_versions: ${result.new_versions}`);
  if (result.skipped.length > 0) {
    console.log(`  skipped:      ${result.skipped.length}`);
    for (const s of result.skipped) console.log(`    - ${s.server_id}: ${s.reason}`);
  }
}

main().catch((err: unknown) => {
  console.error(err);
  process.exit(1);
});
