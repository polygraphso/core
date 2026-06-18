import "server-only";

/**
 * Resolve a registry ref's current "latest" version — the version a consumer
 * would actually install today. Used by the lookup path so a bare `npm/foo`
 * check reports the grade for the version in play, not an arbitrary graded row.
 *
 * Network-backed (npm registry / PyPI JSON API), so it is cached per instance
 * and fail-soft: any failure (timeout, 404, github refs, offline) returns null,
 * and the caller falls back to the latest graded version. github has no package
 * "latest" concept, so it always resolves null.
 */

export interface RegistryRefParts {
  registry: "npm" | "pypi" | "github";
  owner: string | null;
  name: string;
}

interface CacheEntry {
  version: string | null;
  at: number;
}

const cache = new Map<string, CacheEntry>();
const TTL_MS = 10 * 60 * 1000; // 10 min — registries update on publish, not by the second
const FETCH_TIMEOUT_MS = 2500; // don't let a slow registry stall the lookup

async function fetchJson(url: string): Promise<unknown | null> {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), FETCH_TIMEOUT_MS);
  try {
    const res = await fetch(url, { signal: ctrl.signal, headers: { accept: "application/json" } });
    if (!res.ok) return null;
    return (await res.json()) as unknown;
  } catch {
    return null;
  } finally {
    clearTimeout(timer);
  }
}

export async function resolveLatestVersion(parts: RegistryRefParts): Promise<string | null> {
  const key = `${parts.registry}/${parts.owner ?? ""}/${parts.name}`;
  const hit = cache.get(key);
  if (hit && Date.now() - hit.at < TTL_MS) return hit.version;

  let version: string | null = null;
  if (parts.registry === "npm") {
    // npm packument `/latest` endpoint; the scope slash must be percent-encoded.
    const npmName = parts.owner ? `${parts.owner}/${parts.name}` : parts.name;
    const data = (await fetchJson(`https://registry.npmjs.org/${npmName.replace(/\//g, "%2F")}/latest`)) as
      | { version?: unknown }
      | null;
    version = typeof data?.version === "string" ? data.version : null;
  } else if (parts.registry === "pypi") {
    const data = (await fetchJson(`https://pypi.org/pypi/${encodeURIComponent(parts.name)}/json`)) as
      | { info?: { version?: unknown } }
      | null;
    version = typeof data?.info?.version === "string" ? data.info.version : null;
  }
  // github: no package-version concept → null (caller falls back to latest graded).

  cache.set(key, { version, at: Date.now() });
  return version;
}
