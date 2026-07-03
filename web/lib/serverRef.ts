/**
 * Pure, client-safe server-ref path helpers.
 *
 * These live apart from `badgeData.ts` (which is `server-only`) so client
 * components — e.g. the request-a-grade combobox — can build `/mcp/<…>` links
 * without dragging the Supabase/grade-fetch server code into the browser bundle.
 * `badgeData.ts` re-exports both so existing server-side importers are unchanged.
 */

/** A remote-endpoint key is the graded https:// URL itself (registry keys never are). */
export function isRemoteKey(key: string): boolean {
  return key.startsWith("https://") || key.startsWith("http://");
}

/**
 * Canonical key → URL-path-safe form for `/mcp/<…>` and `?server=<…>`. Registry
 * keys pass through; a remote URL's `://` collapses to `/` so it survives the
 * catch-all path (`https://mcp.x.io` → `https/mcp.x.io`). decodeRef reverses it.
 */
export function refToPath(key: string): string {
  return isRemoteKey(key) ? key.replace("://", "/") : key;
}
