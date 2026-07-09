/**
 * Daily advisory ingest. For every distinct gradeable ecosystem-entry target,
 * pulls the current CVEs (deps.dev + OSV for npm/pypi, GitHub Security Advisories
 * for github targets) and upserts them into advisories / advisory_targets so the
 * CVE tab and the weekly digest can read real advisory detail.
 *
 * Usage:
 *   pnpm --filter @polygraph/scoring advisories
 *   pnpm --filter @polygraph/scoring advisories -- --limit 5
 *   pnpm --filter @polygraph/scoring advisories -- --dry-run
 */

import { getSupabaseClient } from "../supabase.js";
import { fetchDepsDev } from "../adapters/depsdev.js";
import { fetchOsvVuln } from "../adapters/osv.js";
import { fetchRepoSecurityAdvisories } from "../adapters/ghsa.js";
import { supabaseAdvisoryStore } from "../advisories/store.js";
import { runAdvisoryIngest } from "../advisories/ingest.js";

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
  const store = supabaseAdvisoryStore(supabase);

  console.log(
    `[advisories] starting${args.limit ? ` (limit=${args.limit})` : ""}${args.dryRun ? " [dry-run]" : ""}`,
  );
  const start = Date.now();
  const result = await runAdvisoryIngest(
    store,
    { fetchDepsDev, fetchOsvVuln, fetchRepoSecurityAdvisories },
    { limit: args.limit, dryRun: args.dryRun },
  );
  const elapsed = ((Date.now() - start) / 1000).toFixed(1);

  console.log(`\n[advisories] complete in ${elapsed}s`);
  console.log(`  processed: ${result.targetsProcessed} targets (npm/pypi ${result.npmPypiCovered}, github ${result.githubCovered})`);
  console.log(`  advisories written: ${result.advisoriesWritten}`);
  if (result.targetsSkipped.length > 0) {
    console.log(`  skipped: ${result.targetsSkipped.length}`);
    for (const s of result.targetsSkipped) console.log(`    - ${s.target}: ${s.reason}`);
  }
}

main().catch((err: unknown) => {
  console.error(err);
  process.exit(1);
});
