/**
 * Weekly ecosystem-digest entrypoint. Builds one digest per recipient for each
 * configured ecosystem due this ISO week: CVEs to fix + grade drops + new-version
 * regrades, per the ecosystem's alert strategy.
 *
 * Usage:
 *   pnpm --filter @polygraph/scoring ecosystem-alerts
 *   pnpm --filter @polygraph/scoring ecosystem-alerts -- --dry-run
 *   pnpm --filter @polygraph/scoring ecosystem-alerts -- --to you@example.com   # safe test send
 *   pnpm --filter @polygraph/scoring ecosystem-alerts -- --ecosystem <slug>     # (with --to) target one
 *
 * Wired to a weekly cron by .github/workflows/ecosystem-alerts.yml. Needs
 * SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, RESEND_API_KEY (optionally
 * ALERT_FROM_EMAIL / POLYGRAPH_SITE_URL / GITHUB_TOKEN for the drift enqueue).
 */

import { getSupabaseClient } from "../supabase.js";
import { runEcosystemAlerts, isoWeek } from "../alerts/ecosystem.js";
import { supabaseEcosystemAlertStore, type EcosystemAlertStore } from "../alerts/ecosystemStore.js";
import { resendSender } from "../alerts/email.js";

interface CliArgs {
  dryRun: boolean;
  to?: string;
  ecosystem?: string;
}

function parseArgs(argv: readonly string[]): CliArgs {
  const args: CliArgs = { dryRun: false };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === "--dry-run") args.dryRun = true;
    else if (a === "--to") args.to = argv[++i];
    else if (a?.startsWith("--to=")) args.to = a.slice("--to=".length);
    else if (a === "--ecosystem") args.ecosystem = argv[++i];
    else if (a?.startsWith("--ecosystem=")) args.ecosystem = a.slice("--ecosystem=".length);
  }
  return args;
}

async function main(): Promise<void> {
  const args = parseArgs(process.argv.slice(2));
  const supabase = getSupabaseClient();
  let store: EcosystemAlertStore = supabaseEcosystemAlertStore(supabase);

  // --ecosystem narrows the due set (only useful with --to for a targeted test).
  if (args.ecosystem) {
    const base = store;
    const slug = args.ecosystem;
    store = { ...base, dueEcosystems: async (p) => (await base.dueEcosystems(p)).filter((e) => e.slug === slug) };
  }

  const periodKey = isoWeek(new Date());
  const siteUrl = process.env.POLYGRAPH_SITE_URL?.trim() || undefined;

  // A dry run needs a sender only if it would send; with --to we always send. A
  // plain --dry-run uses a no-op sender so nothing leaves the box.
  const sender = args.dryRun && !args.to
    ? { send: async () => ({ id: "dry-run" }) }
    : resendSender();

  console.log(`[ecosystem-alerts] starting ${periodKey}${args.dryRun ? " [dry-run]" : ""}${args.to ? ` [to ${args.to}]` : ""}`);
  const start = Date.now();
  const result = await runEcosystemAlerts(store, {
    periodKey,
    sender,
    siteUrl,
    // Hosted grading is discontinued — skip freshness regrades onto the VPS.
    overrideRecipient: args.to,
    dryRun: args.dryRun,
    log: (m) => console.log(m),
  });
  const elapsed = ((Date.now() - start) / 1000).toFixed(1);

  console.log(`\n[ecosystem-alerts] complete in ${elapsed}s`);
  console.log(`  ecosystems: ${result.ecosystems} due, ${result.processed} processed`);
  console.log(`  digests:    sent ${result.digestsSent}, failed ${result.failed}`);
  console.log(`  regrades:   ${result.regradesEnqueued} enqueued`);
  if (result.skipped.length > 0) {
    console.log(`  skipped:    ${result.skipped.length}`);
    for (const s of result.skipped) console.log(`    - ${s.ecosystem}: ${s.reason}`);
  }
}

main().catch((err: unknown) => {
  console.error(err);
  process.exit(1);
});
