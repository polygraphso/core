/**
 * Hourly grade-request fulfillment entrypoint. Reconciles in_progress requests
 * against their grading runs (complete + email on publish, decline on failure),
 * then enqueues the oldest queued requests onto the hosted runner's free
 * auto-publish lane.
 *
 * Usage:
 *   pnpm --filter @polygraph/scoring fulfill
 *
 * Wired to a cron by .github/workflows/fulfill.yml. Needs SUPABASE_URL,
 * SUPABASE_SERVICE_ROLE_KEY, and RESEND_API_KEY (optionally ALERT_FROM_EMAIL /
 * POLYGRAPH_SITE_URL).
 */

import { getSupabaseClient } from "../supabase.js";
import { runFulfillment } from "../fulfill/fulfill.js";
import { supabaseFulfillStore } from "../fulfill/store.js";
import { resendSender } from "../alerts/email.js";

async function main(): Promise<void> {
  const supabase = getSupabaseClient();
  const store = supabaseFulfillStore(supabase);
  const sender = resendSender();
  // Treat a blank POLYGRAPH_SITE_URL (an undefined GitHub Actions `${{ vars.X }}`
  // expands to "") as unset so the link origin falls back to the default.
  const siteUrl = process.env.POLYGRAPH_SITE_URL?.trim() || undefined;

  console.log("[fulfill] starting");
  const start = Date.now();
  const result = await runFulfillment(store, { sender, siteUrl, log: (m) => console.log(m) });
  const elapsed = ((Date.now() - start) / 1000).toFixed(1);

  console.log(`\n[fulfill] complete in ${elapsed}s`);
  console.log(`  completed: ${result.completed}`);
  console.log(`  declined:  ${result.declined}`);
  console.log(`  pending:   ${result.pending}`);
  console.log(`  enqueued:  ${result.enqueued}`);
  if (result.emailFailed > 0) console.log(`  email failures: ${result.emailFailed}`);
  if (result.skipped.length > 0) {
    console.log(`  skipped:   ${result.skipped.length}`);
    for (const s of result.skipped) console.log(`    - ${s.target}: ${s.reason}`);
  }
}

main().catch((err: unknown) => {
  console.error(err);
  process.exit(1);
});
