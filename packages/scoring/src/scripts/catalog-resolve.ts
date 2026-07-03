/**
 * Resolve discovered catalog servers into runnable grading targets, in priority
 * order, capped per run. Reads `catalog_resolution_queue` (never-attempted →
 * errored → stale-unresolved, attribute-flagged & newest first), resolves each
 * via the tiered resolver, and writes grading_target/grading_kind/resolution_*
 * plus the three-state `gradeable` back to catalog_servers.
 *
 * Incremental by design: a daily run chips through a capped batch, so the whole
 * catalog is covered over several runs and errors/stale rows are retried later.
 *
 * Usage:
 *   pnpm --filter @polygraph/scoring catalog:resolve
 *   pnpm --filter @polygraph/scoring catalog:resolve -- --limit 500 --concurrency 8
 */

import type { SupabaseClient } from "@supabase/supabase-js";
import type { CatalogResolutionStatus } from "@polygraph/core";
import { getSupabaseClient } from "../supabase.js";
import { rateLimitDelay } from "../adapters/fetch.js";
import { resolveServer } from "../adapters/catalog/resolve.js";

/** Servers to attempt per run — enough to cover the catalog in a couple of weeks. */
const DEFAULT_LIMIT = 2000;
/** Cooldown before a previously-unresolved server is retried (repos publish late). */
const DEFAULT_STALE_DAYS = 14;
/** Parallel resolutions. Network-bound; kept modest to stay under Glama/CF limits. */
const DEFAULT_CONCURRENCY = 6;
/** Courtesy pause after each resolution, per lane. */
const PER_TASK_DELAY_MS = 40;
const LOG_EVERY = 50;
/** PostgREST caps a single response at ~1000 rows, so fetch the queue in chunks. */
const QUEUE_CHUNK = 1000;

interface CliArgs {
  limit: number;
  staleDays: number;
  concurrency: number;
}

function parseArgs(argv: readonly string[]): CliArgs {
  const args: CliArgs = {
    limit: DEFAULT_LIMIT,
    staleDays: DEFAULT_STALE_DAYS,
    concurrency: DEFAULT_CONCURRENCY,
  };
  const numFlag = (name: keyof CliArgs, raw: string | undefined) => {
    const n = Number(raw);
    if (!Number.isFinite(n) || n <= 0) throw new Error(`--${name} must be a positive number`);
    args[name] = n;
  };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === "--limit") numFlag("limit", argv[++i]);
    else if (a?.startsWith("--limit=")) numFlag("limit", a.slice("--limit=".length));
    else if (a === "--stale-days") numFlag("staleDays", argv[++i]);
    else if (a?.startsWith("--stale-days=")) numFlag("staleDays", a.slice("--stale-days=".length));
    else if (a === "--concurrency") numFlag("concurrency", argv[++i]);
    else if (a?.startsWith("--concurrency=")) numFlag("concurrency", a.slice("--concurrency=".length));
  }
  return args;
}

interface QueueRow {
  id: string;
  repository_url: string | null;
  namespace: string | null;
  slug: string | null;
  resolution_attempts: number;
}

/** Resolve one server and persist the outcome. Returns the resolution status. */
async function resolveOne(
  supabase: SupabaseClient,
  row: QueueRow,
): Promise<CatalogResolutionStatus> {
  const outcome = await resolveServer({
    repositoryUrl: row.repository_url,
    namespace: row.namespace,
    slug: row.slug,
  });

  const base = {
    resolution_checked_at: new Date().toISOString(),
    resolution_attempts: (row.resolution_attempts ?? 0) + 1,
  };

  let update: Record<string, unknown>;
  if (outcome.status === "resolved") {
    update = {
      ...base,
      resolution_status: "resolved",
      gradeable: true,
      grading_target: outcome.target.target,
      grading_kind: outcome.target.kind,
    };
  } else if (outcome.status === "unresolved") {
    update = {
      ...base,
      resolution_status: "unresolved",
      gradeable: false,
      grading_target: null,
      grading_kind: null,
    };
  } else {
    // Transient error — record the attempt, leave gradeable/target untouched so
    // a genuine prior result isn't clobbered; the queue retries it next run.
    update = { ...base, resolution_status: "error" };
  }

  const { error } = await supabase.from("catalog_servers").update(update).eq("id", row.id);
  if (error) throw new Error(`update ${row.id} failed: ${error.message}`);
  return outcome.status;
}

/** Run `worker` over `items` with at most `concurrency` in flight. */
async function runPool<T>(
  items: T[],
  concurrency: number,
  worker: (item: T) => Promise<void>,
): Promise<void> {
  let next = 0;
  const lane = async () => {
    while (next < items.length) {
      const item = items[next++]!;
      await worker(item);
    }
  };
  await Promise.all(Array.from({ length: Math.min(concurrency, items.length) }, lane));
}

async function main(): Promise<void> {
  const args = parseArgs(process.argv.slice(2));
  const supabase = getSupabaseClient();
  console.log(`[resolve] target ${args.limit} servers (concurrency ${args.concurrency})`);

  const tally: Record<CatalogResolutionStatus, number> = { resolved: 0, unresolved: 0, error: 0 };
  const seen = new Set<string>();
  let processed = 0;

  // Fetch the queue in chunks: each resolution changes a server's status, so it
  // drops out of the queue and the next fetch returns fresh work. `seen` guards
  // the tail case where error rows (still queue-eligible) reappear once the
  // never-attempted rows are drained.
  while (processed < args.limit) {
    const want = Math.min(QUEUE_CHUNK, args.limit - processed);
    const { data, error } = await supabase.rpc("catalog_resolution_queue", {
      batch_limit: want,
      stale_days: args.staleDays,
    });
    if (error) throw new Error(`catalog_resolution_queue failed: ${error.message}`);

    const batch = ((data ?? []) as QueueRow[]).filter((r) => !seen.has(r.id));
    if (batch.length === 0) {
      console.log("[resolve] queue drained");
      break;
    }
    console.log(`[resolve] batch of ${batch.length} (processed ${processed}/${args.limit})`);

    await runPool(batch, args.concurrency, async (row) => {
      seen.add(row.id);
      let status: CatalogResolutionStatus;
      try {
        status = await resolveOne(supabase, row);
      } catch (err) {
        console.warn(`[resolve] ${row.id} failed: ${String(err)}`);
        status = "error";
      }
      tally[status]++;
      processed++;
      if (processed % LOG_EVERY === 0) {
        console.log(
          `[resolve] ${processed}/${args.limit} · ${tally.resolved} resolved · ${tally.unresolved} unresolved · ${tally.error} error`,
        );
      }
      await rateLimitDelay(PER_TASK_DELAY_MS);
    });
  }

  console.log(
    `[resolve] done · ${processed} attempted · ${tally.resolved} resolved · ${tally.unresolved} unresolved · ${tally.error} error`,
  );
}

main().catch((err: unknown) => {
  console.error(err);
  process.exit(1);
});
