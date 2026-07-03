/**
 * Sync the thin MCP discovery catalog from directory providers into
 * catalog_servers + catalog_listings. Walks each provider newest-first,
 * canonicalizes listings across providers (same repo → one canonical server),
 * and upserts. Identity only — no grading, no enrichment.
 *
 * Modes:
 *   (default) incremental — stop once the newest servers are all already known
 *             (K consecutive fully-known pages), so a daily run is cheap.
 *   --backfill            — walk every page to the end of the directory.
 *
 * Usage:
 *   pnpm --filter @polygraph/scoring catalog:sync
 *   pnpm --filter @polygraph/scoring catalog:backfill
 *   pnpm --filter @polygraph/scoring catalog:sync -- --provider glama --max-pages 5
 */

import type { SupabaseClient } from "@supabase/supabase-js";
import type { CatalogProvider } from "@polygraph/core";
import { getSupabaseClient } from "../supabase.js";
import { rateLimitDelay } from "../adapters/fetch.js";
import {
  PROVIDERS,
  canonicalKey,
  type ProviderAdapter,
  type RawListing,
} from "../adapters/catalog/index.js";

/** Consecutive fully-known pages before an incremental walk stops. */
const STOP_AFTER_KNOWN_PAGES = 3;
/** Courtesy pause between page requests (well under Glama's ~100 req/s). */
const PAGE_DELAY_MS = 60;
/** Log a progress line every N pages. */
const LOG_EVERY = 20;

interface CliArgs {
  backfill: boolean;
  provider: string | null;
  maxPages: number | null;
}

function parseArgs(argv: readonly string[]): CliArgs {
  const args: CliArgs = { backfill: false, provider: null, maxPages: null };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === "--backfill") args.backfill = true;
    else if (a === "--provider") args.provider = argv[++i] ?? null;
    else if (a?.startsWith("--provider=")) args.provider = a.slice("--provider=".length);
    else if (a === "--max-pages") {
      const n = Number(argv[++i]);
      if (!Number.isFinite(n) || n <= 0) throw new Error("--max-pages must be a positive number");
      args.maxPages = n;
    } else if (a?.startsWith("--max-pages=")) {
      const n = Number(a.slice("--max-pages=".length));
      if (!Number.isFinite(n) || n <= 0) throw new Error("--max-pages must be a positive number");
      args.maxPages = n;
    }
  }
  return args;
}

/** Which of these provider_uids already have a listing (to count new servers). */
async function existingUids(
  supabase: SupabaseClient,
  provider: CatalogProvider,
  uids: string[],
): Promise<Set<string>> {
  if (uids.length === 0) return new Set();
  const { data, error } = await supabase
    .from("catalog_listings")
    .select("provider_uid")
    .eq("provider", provider)
    .in("provider_uid", uids);
  if (error) throw new Error(`existingUids query failed: ${error.message}`);
  return new Set((data ?? []).map((r) => r.provider_uid as string));
}

interface PageResult {
  total: number;
  newCount: number;
}

/** Upsert one page of listings + their canonical servers. */
async function upsertPage(
  supabase: SupabaseClient,
  provider: CatalogProvider,
  listings: RawListing[],
): Promise<PageResult> {
  if (listings.length === 0) return { total: 0, newCount: 0 };

  const now = new Date().toISOString();

  // Count how many are new before we write (for the stop condition).
  const known = await existingUids(
    supabase,
    provider,
    listings.map((l) => l.providerUid),
  );
  const newCount = listings.filter((l) => !known.has(l.providerUid)).length;

  // Group listings by canonical key so each real server is one catalog_servers
  // row, then upsert those servers and map key → id.
  const byKey = new Map<string, RawListing[]>();
  for (const l of listings) {
    const key = canonicalKey(provider, l);
    const group = byKey.get(key);
    if (group) group.push(l);
    else byKey.set(key, [l]);
  }

  const serverRows = Array.from(byKey.entries()).map(([key, group]) => {
    const withRepo = group.find((l) => l.repositoryUrl && l.repositoryUrl.trim().length > 0);
    const named = group.find((l) => l.name && l.name.trim().length > 0);
    return {
      canonical_key: key,
      name: named?.name ?? null,
      repository_url: withRepo?.repositoryUrl ?? null,
      // `gradeable` (and grading_target/resolution_*) are owned by catalog-resolve,
      // not sync — omitted here so a daily re-sync never clobbers a resolution result.
      last_seen_at: now, // first_seen_at omitted → preserved on conflict, defaulted on insert
    };
  });

  const { data: upserted, error: serverErr } = await supabase
    .from("catalog_servers")
    .upsert(serverRows, { onConflict: "canonical_key" })
    .select("id, canonical_key");
  if (serverErr) throw new Error(`catalog_servers upsert failed: ${serverErr.message}`);

  const idByKey = new Map<string, string>();
  for (const row of upserted ?? []) idByKey.set(row.canonical_key as string, row.id as string);

  const listingRows = listings.map((l) => {
    const serverId = idByKey.get(canonicalKey(provider, l));
    if (!serverId) throw new Error(`no catalog_server id for ${provider}:${l.providerUid}`);
    return {
      catalog_server_id: serverId,
      provider,
      provider_uid: l.providerUid,
      namespace: l.namespace ?? null,
      slug: l.slug ?? null,
      name: l.name ?? null,
      url: l.url ?? null,
      attributes: l.attributes ?? [],
      provider_created_at: l.createdAt ?? null,
      last_synced_at: now, // first_synced_at omitted → preserved on conflict
    };
  });

  const { error: listingErr } = await supabase
    .from("catalog_listings")
    .upsert(listingRows, { onConflict: "provider,provider_uid" });
  if (listingErr) throw new Error(`catalog_listings upsert failed: ${listingErr.message}`);

  return { total: listings.length, newCount };
}

async function walkProvider(
  supabase: SupabaseClient,
  adapter: ProviderAdapter,
  args: CliArgs,
): Promise<void> {
  const provider = adapter.provider;
  console.log(`[${provider}] starting ${args.backfill ? "backfill" : "incremental sync"}`);

  let cursor: string | undefined;
  let pages = 0;
  let totalListings = 0;
  let totalNew = 0;
  let consecutiveKnownPages = 0;

  while (true) {
    const page = await adapter.fetchPage(cursor);
    pages++;

    const { total, newCount } = await upsertPage(supabase, provider, page.listings);
    totalListings += total;
    totalNew += newCount;

    if (!args.backfill && total > 0) {
      if (newCount === 0) consecutiveKnownPages++;
      else consecutiveKnownPages = 0;
      if (consecutiveKnownPages >= STOP_AFTER_KNOWN_PAGES) {
        console.log(
          `[${provider}] stopping: ${STOP_AFTER_KNOWN_PAGES} consecutive fully-known pages`,
        );
        break;
      }
    }

    if (pages % LOG_EVERY === 0) {
      console.log(`[${provider}] page ${pages} · ${totalListings} listings · ${totalNew} new`);
    }

    if (args.maxPages && pages >= args.maxPages) {
      console.log(`[${provider}] stopping: --max-pages ${args.maxPages} reached`);
      break;
    }
    if (!page.hasNext || !page.nextCursor) {
      console.log(`[${provider}] reached end of directory`);
      break;
    }

    cursor = page.nextCursor;
    await rateLimitDelay(PAGE_DELAY_MS);
  }

  console.log(`[${provider}] done · ${pages} pages · ${totalListings} listings · ${totalNew} new`);
}

async function main(): Promise<void> {
  const args = parseArgs(process.argv.slice(2));
  const adapters = args.provider
    ? PROVIDERS.filter((p) => p.provider === args.provider)
    : PROVIDERS;
  if (adapters.length === 0) {
    throw new Error(`no catalog provider matches --provider ${args.provider}`);
  }

  const supabase = getSupabaseClient();
  for (const adapter of adapters) {
    await walkProvider(supabase, adapter, args);
  }
}

main().catch((err: unknown) => {
  console.error(err);
  process.exit(1);
});
