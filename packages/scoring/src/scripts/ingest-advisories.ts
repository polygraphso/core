/**
 * Daily advisory ingest. For every distinct gradeable ecosystem-entry target,
 * pulls the current CVEs (deps.dev + OSV for npm/pypi, GitHub Security Advisories
 * for github targets) and upserts them into advisories / advisory_targets so the
 * CVE tab and the weekly digest can read real advisory detail.
 *
 * By default it covers the curated ecosystem entries. Pass --all to cover every
 * package-addressable lib polygraph tracks (ecosystem entries ∪ graded targets ∪
 * tracked servers, npm/pypi/github; remote https:// endpoints have no feed).
 *
 * Usage:
 *   pnpm --filter @polygraph/scoring advisories
 *   pnpm --filter @polygraph/scoring advisories -- --limit 5
 *   pnpm --filter @polygraph/scoring advisories -- --dry-run
 *   pnpm --filter @polygraph/scoring advisories -- --all
 */

import type { SupabaseClient } from "@supabase/supabase-js";
import { getSupabaseClient } from "../supabase.js";
import { fetchDepsDev } from "../adapters/depsdev.js";
import { fetchOsvVuln } from "../adapters/osv.js";
import { fetchRepoSecurityAdvisories } from "../adapters/ghsa.js";
import { supabaseAdvisoryStore, type EntryTarget } from "../advisories/store.js";
import { runAdvisoryIngest } from "../advisories/ingest.js";

interface CliArgs {
  limit?: number;
  dryRun: boolean;
  all: boolean;
}

/**
 * Every package-addressable target polygraph tracks: the curated ecosystem
 * entries, plus every graded hosted_runs target, plus every tracked server.
 * npm/pypi/github only (remote https:// has no advisory feed); deduped.
 */
async function collectAllTargets(supabase: SupabaseClient): Promise<EntryTarget[]> {
  const seen = new Set<string>();
  const out: EntryTarget[] = [];
  const add = (target: string | null): void => {
    if (!target) return;
    const base = target.split("#")[0]!;
    if (!/^(npm|pypi|github)\//.test(base)) return;
    if (seen.has(target)) return;
    seen.add(target);
    out.push({ target, target_kind: target.includes("#") ? "skill" : "registry_ref" });
  };

  const { data: eco } = await supabase.from("ecosystem_entries").select("target").not("target", "is", null);
  for (const r of (eco as Array<{ target: string }> | null) ?? []) add(r.target);

  const { data: runs } = await supabase.from("hosted_runs").select("target").not("target", "is", null);
  for (const r of (runs as Array<{ target: string }> | null) ?? []) add(r.target);

  const { data: srv } = await supabase.from("servers").select("registry, owner, name");
  for (const r of (srv as Array<{ registry: string; owner: string | null; name: string }> | null) ?? []) {
    add(r.owner ? `${r.registry}/${r.owner}/${r.name}` : `${r.registry}/${r.name}`);
  }
  return out;
}

function parseArgs(argv: readonly string[]): CliArgs {
  const args: CliArgs = { dryRun: false, all: false };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === "--dry-run") {
      args.dryRun = true;
    } else if (a === "--all") {
      args.all = true;
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
  let store = supabaseAdvisoryStore(supabase);

  // --all widens the target set from the curated ecosystem entries to every
  // package-addressable lib polygraph tracks, by overriding the source query.
  if (args.all) {
    const base = store;
    const targets = await collectAllTargets(supabase);
    store = { ...base, distinctEcosystemTargets: async () => targets };
    console.log(`[advisories] --all: ${targets.length} distinct package targets`);
  }

  console.log(
    `[advisories] starting${args.all ? " (all libs)" : ""}${args.limit ? ` (limit=${args.limit})` : ""}${args.dryRun ? " [dry-run]" : ""}`,
  );
  const start = Date.now();
  const result = await runAdvisoryIngest(
    store,
    { fetchDepsDev, fetchOsvVuln, fetchRepoSecurityAdvisories },
    { limit: args.limit, dryRun: args.dryRun, concurrency: args.all ? 8 : 4 },
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
