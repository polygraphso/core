/**
 * Hourly alert entrypoint.
 *
 * Hosted grading is discontinued: this script is a no-op so a manual
 * `alerts:ci` cannot enqueue new-version regrades onto the VPS.
 */

async function main(): Promise<void> {
  console.log("[alerts] hosted grading is discontinued — not enqueueing regrades");
}

main().catch((err: unknown) => {
  console.error(err);
  process.exit(1);
});
