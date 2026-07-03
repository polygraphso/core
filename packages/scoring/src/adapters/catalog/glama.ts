/**
 * Glama catalog provider — enumerates the full MCP directory, newest-first,
 * for the thin discovery index. This is the LIST counterpart to the existing
 * single-server `../glama.ts` (which fetches one server + scrapes its score
 * page); the two are intentionally separate. Grades are not read here — the
 * catalog is identity only.
 *
 * API: GET /api/mcp/v1/servers?first=100&after=<cursor>
 *   → { servers: [...], pageInfo: { endCursor, hasNextPage, ... } }
 * The opaque cursor is base64 JSON `{ createdAt: <unix s>, id }`. Servers carry
 * no per-server createdAt, so we derive a page-granular createdAt from the
 * page's endCursor (the oldest item on the page) and stamp every listing on the
 * page with it: monotonic non-increasing across pages, tied within a page —
 * enough for newest-first ordering.
 *
 * Deep pagination occasionally returns an empty `servers` with
 * `hasNextPage:true`; that's transient, so we retry the same cursor a few times
 * before giving up.
 */

import { fetchWithRetry, rateLimitDelay } from "../fetch.js";
import type { CatalogPage, ProviderAdapter, RawListing } from "./types.js";

const LABEL = "glama-catalog";
const BASE = "https://glama.ai/api/mcp/v1/servers";
const PAGE_SIZE = 100;
const EMPTY_PAGE_RETRIES = 4;
const BROWSER_UA =
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36";

interface GlamaListServer {
  id?: string;
  namespace?: string;
  slug?: string;
  name?: string;
  url?: string;
  repository?: { url?: string } | null;
  attributes?: string[];
}

interface GlamaPageInfo {
  endCursor?: string | null;
  hasNextPage?: boolean;
}

interface GlamaListResponse {
  servers?: GlamaListServer[];
  pageInfo?: GlamaPageInfo;
}

/** Decode the base64 cursor's `createdAt` (unix seconds) to an ISO string. */
function createdAtFromCursor(cursor: string | null | undefined): string | undefined {
  if (!cursor) return undefined;
  try {
    const decoded = JSON.parse(Buffer.from(cursor, "base64").toString("utf-8")) as {
      createdAt?: number;
    };
    if (typeof decoded.createdAt === "number" && Number.isFinite(decoded.createdAt)) {
      return new Date(decoded.createdAt * 1000).toISOString();
    }
  } catch {
    // Malformed cursor — leave createdAt unset rather than fail the walk.
  }
  return undefined;
}

function toRawListing(s: GlamaListServer, createdAt: string | undefined): RawListing | null {
  if (!s.id) return null; // no stable id → can't key a listing
  const repo = s.repository?.url?.trim();
  return {
    providerUid: s.id,
    namespace: s.namespace ?? undefined,
    slug: s.slug ?? undefined,
    name: s.name ?? undefined,
    repositoryUrl: repo && repo.length > 0 ? repo : undefined,
    url: s.url ?? undefined,
    attributes: Array.isArray(s.attributes) ? s.attributes : [],
    createdAt,
  };
}

async function fetchOnce(cursor?: string): Promise<GlamaListResponse> {
  const url = new URL(BASE);
  url.searchParams.set("first", String(PAGE_SIZE));
  if (cursor) url.searchParams.set("after", cursor);
  const res = await fetchWithRetry(url.toString(), {
    label: LABEL,
    headers: { "User-Agent": BROWSER_UA },
  });
  return (await res.json()) as GlamaListResponse;
}

export const glamaProvider: ProviderAdapter = {
  provider: "glama",

  async fetchPage(cursor?: string): Promise<CatalogPage> {
    for (let attempt = 1; attempt <= EMPTY_PAGE_RETRIES; attempt++) {
      const body = await fetchOnce(cursor);
      const servers = body.servers ?? [];
      const pageInfo = body.pageInfo ?? {};
      const hasNext = pageInfo.hasNextPage === true;

      // Non-empty, or a genuine end-of-list empty page: return it.
      if (servers.length > 0 || !hasNext) {
        const createdAt = createdAtFromCursor(pageInfo.endCursor);
        const listings = servers
          .map((s) => toRawListing(s, createdAt))
          .filter((l): l is RawListing => l !== null);
        return { listings, nextCursor: pageInfo.endCursor ?? undefined, hasNext };
      }

      // Empty page but hasNextPage:true → transient. Retry the SAME cursor.
      console.log(`[${LABEL}] transient empty page (attempt ${attempt}), retrying same cursor`);
      await rateLimitDelay(500 * attempt);
    }

    // Persisted empty-with-hasNext after retries: stop the walk rather than loop
    // forever. Rare; log loudly so a truncated backfill is visible.
    console.warn(`[${LABEL}] empty page persisted after ${EMPTY_PAGE_RETRIES} retries — ending walk`);
    return { listings: [], hasNext: false };
  },
};
