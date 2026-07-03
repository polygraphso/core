/**
 * Catalog provider registry + the provider-agnostic helpers the sync script
 * uses to canonicalize and score listings. Adding a provider = implement
 * `ProviderAdapter` and append it to `PROVIDERS`.
 */

import type { CatalogProvider } from "@polygraph/core";
import { glamaProvider } from "./glama.js";
import type { ProviderAdapter, RawListing } from "./types.js";

export type { CatalogPage, ProviderAdapter, RawListing } from "./types.js";
export { glamaProvider } from "./glama.js";

/** Every provider the sync enumerates. Future providers join here. */
export const PROVIDERS: ProviderAdapter[] = [glamaProvider];

/**
 * Normalize a repository URL into a cross-provider identity, so the same repo
 * seen via different providers (or under different casings / with/without
 * `.git`) collapses to one canonical key.
 *   https://github.com/Owner/Repo.git → github.com/owner/repo
 *   git@github.com:Owner/Repo.git     → github.com/owner/repo
 */
export function normalizeRepoKey(raw: string): string {
  let s = raw.trim();
  const ssh = s.match(/^git@([^:]+):(.+)$/);
  if (ssh) s = `${ssh[1]}/${ssh[2]}`;
  s = s.replace(/^https?:\/\//i, "");
  s = s.replace(/^www\./i, "");
  s = s.replace(/\.git$/i, "");
  s = s.replace(/\/+$/, "");
  return s.toLowerCase();
}

/**
 * The cross-provider dedup key for a listing: its normalized repo URL when it
 * has one, else a provider-scoped fallback so repo-less servers still get a
 * stable (if un-mergeable) canonical row.
 */
export function canonicalKey(provider: CatalogProvider, listing: RawListing): string {
  const repo = listing.repositoryUrl?.trim();
  if (repo && repo.length > 0) return normalizeRepoKey(repo);
  return `${provider}:${listing.providerUid}`;
}
