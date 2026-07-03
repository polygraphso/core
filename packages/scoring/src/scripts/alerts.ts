/**
 * Hourly alert entrypoint. Runs the new-version regrade alert engine: enqueue
 * regrades for monitored targets with an ungraded new version, then email the
 * watchers whose latest published grade is newer than they've seen.
 *
 * Usage:
 *   pnpm --filter @polygraph/scoring alerts
 *
 * Wired to a cron by .github/workflows/alerts.yml. Needs SUPABASE_URL,
 * SUPABASE_SERVICE_ROLE_KEY, and RESEND_API_KEY (optionally ALERT_FROM_EMAIL /
 * POLYGRAPH_SITE_URL).
 */

import { getSupabaseClient } from "../supabase.js";
import { runAlerts } from "../alerts/alerts.js";
import { supabaseAlertStore } from "../alerts/store.js";
import { resendSender } from "../alerts/email.js";

async function main(): Promise<void> {
  const supabase = getSupabaseClient();
  const store = supabaseAlertStore(supabase);
  const sender = resendSender();
  // Treat a blank POLYGRAPH_SITE_URL (an undefined GitHub Actions `${{ vars.X }}`
  // expands to "") as unset so the link origin falls back to the default.
  const siteUrl = process.env.POLYGRAPH_SITE_URL?.trim() || undefined;

  console.log("[alerts] starting");
  const start = Date.now();
  const result = await runAlerts(store, { sender, siteUrl, log: (m) => console.log(m) });
  const elapsed = ((Date.now() - start) / 1000).toFixed(1);

  console.log(`\n[alerts] complete in ${elapsed}s`);
  console.log(`  monitors:  ${result.monitors} (${result.targets} targets)`);
  console.log(`  enqueued:  ${result.enqueued} regrades`);
  console.log(`  notified:  ${result.notified} (sent ${result.sent}, failed ${result.failed})`);
  if (result.skipped.length > 0) {
    console.log(`  skipped:   ${result.skipped.length}`);
    for (const s of result.skipped) console.log(`    - ${s.target}: ${s.reason}`);
  }
}

main().catch((err: unknown) => {
  console.error(err);
  process.exit(1);
});
