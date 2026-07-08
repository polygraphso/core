/**
 * One-shot backfill: populate commit_sha + commit_at on the github-sourced grades
 * that were published before the commit anchor landed, so the whole current
 * ecosystem is monitorable without waiting for a regrade.
 *
 * For each published hosted_runs row whose target is github-sourced (a skill
 * `github/owner/repo#path` or a github server `github/owner/repo`) and has no
 * commit anchor yet, resolve the PATH-SCOPED latest commit as of the row's
 * resolved_version — i.e. the commit that was in effect for the snapshot that was
 * actually graded, not whatever is newest now — and write it back.
 *
 * Idempotent (skips rows already anchored) and rate-limited. Safe to re-run.
 *
 * Usage:
 *   pnpm --filter @polygraph/scoring backfill:commit-anchor [--dry-run]
 *
 * Needs SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, and GITHUB_TOKEN.
 */

import { getSupabaseClient } from "../supabase.js";
import { latestCommitForPath } from "../adapters/github.js";
import { rateLimitDelay } from "../adapters/fetch.js";
import { parseGithubTarget } from "../alerts/alerts.js";

interface Row {
  id: string;
  target: string;
  resolved_version: string | null;
}

async function main(): Promise<void> {
  const dryRun = process.argv.includes("--dry-run");
  const supabase = getSupabaseClient();

  // Published, github-sourced, not yet anchored. published_at NOT NULL keeps this
  // to the rows the monitor + report pages actually read.
  const { data, error } = await supabase
    .from("hosted_runs")
    .select("id, target, resolved_version")
    .like("target", "github/%")
    .is("commit_sha", null)
    .not("published_at", "is", null);
  if (error) throw new Error(`backfill: query failed: ${error.message}`);

  const rows = (data ?? []) as Row[];
  console.log(`[backfill] ${rows.length} github grade(s) to anchor${dryRun ? " (dry run)" : ""}`);

  let updated = 0;
  const skipped: Array<{ target: string; reason: string }> = [];

  for (const row of rows) {
    const gh = parseGithubTarget(row.target);
    if (!gh) {
      skipped.push({ target: row.target, reason: "unparseable github target" });
      continue;
    }
    let info;
    try {
      // Anchor at resolved_version so the commit reflects the graded snapshot.
      info = await latestCommitForPath(gh.owner, gh.repo, row.resolved_version, gh.subPath);
    } catch (err) {
      skipped.push({ target: row.target, reason: err instanceof Error ? err.message : String(err) });
      continue;
    }
    if (!info) {
      skipped.push({ target: row.target, reason: "no commit (repo/path gone?)" });
      continue;
    }

    if (dryRun) {
      console.log(`  would anchor ${row.target} → ${info.sha.slice(0, 8)} (${info.committedAt ?? "no date"})`);
    } else {
      const { error: upErr } = await supabase
        .from("hosted_runs")
        .update({ commit_sha: info.sha, commit_at: info.committedAt })
        .eq("id", row.id);
      if (upErr) {
        skipped.push({ target: row.target, reason: `update failed: ${upErr.message}` });
        continue;
      }
      console.log(`  anchored ${row.target} → ${info.sha.slice(0, 8)} (${info.committedAt ?? "no date"})`);
    }
    updated += 1;
    await rateLimitDelay(200);
  }

  console.log(`\n[backfill] ${dryRun ? "would anchor" : "anchored"} ${updated}; skipped ${skipped.length}`);
  for (const s of skipped) console.log(`  - ${s.target}: ${s.reason}`);
}

main().catch((err: unknown) => {
  console.error(err);
  process.exit(1);
});
