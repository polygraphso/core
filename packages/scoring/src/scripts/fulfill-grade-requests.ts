/**
 * Hourly grade-request fulfillment entrypoint.
 *
 * Hosted grading is discontinued: this script is a no-op so a manual
 * `fulfill:ci` cannot enqueue new hosted_runs onto the VPS.
 */

async function main(): Promise<void> {
  console.log("[fulfill] hosted grading is discontinued — not enqueueing new runs");
}

main().catch((err: unknown) => {
  console.error(err);
  process.exit(1);
});
