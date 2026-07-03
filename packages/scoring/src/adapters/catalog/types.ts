/**
 * Provider-agnostic contract for enumerating an MCP directory into the thin
 * discovery catalog. Glama is the first implementation (./glama.ts); a future
 * Smithery / official-registry provider implements the same `ProviderAdapter`
 * and joins the `PROVIDERS` registry in ./index.ts — the sync script and the
 * catalog tables don't change.
 */

import type { CatalogProvider } from "@polygraph/core";

/**
 * One server as seen by a provider, before canonicalization. Optional fields
 * are whatever the provider happens to expose; only `providerUid` is required
 * (it's the stable per-provider identity we key listings on).
 */
export interface RawListing {
  /** Stable provider-specific id (Glama server id, Smithery qualifiedName, …). */
  providerUid: string;
  namespace?: string;
  slug?: string;
  name?: string;
  /** Source repository, if the provider knows it — the cross-provider dedup key. */
  repositoryUrl?: string;
  /** Provider-facing page URL. */
  url?: string;
  attributes?: string[];
  /** Provider creation time (ISO). May be page-granular — see glama.ts. */
  createdAt?: string;
}

/** One page of a provider's newest-first enumeration. */
export interface CatalogPage {
  listings: RawListing[];
  /** Opaque cursor to pass back for the next page. */
  nextCursor?: string;
  hasNext: boolean;
}

export interface ProviderAdapter {
  /** Stored verbatim in catalog_listings.provider. */
  readonly provider: CatalogProvider;
  /** Fetch one page, newest-first. Passing no cursor starts from the newest. */
  fetchPage(cursor?: string): Promise<CatalogPage>;
}
