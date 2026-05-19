/**
 * Smithery adapter — uses the search/list endpoint and filters for an
 * exact qualifiedName match.
 *
 * Smithery's `GET /servers/{qualifiedName}` endpoint does NOT return
 * `useCount` (confirmed against the live API after the first scoring
 * run came back with useCount=0 for every server). Only the list /
 * search endpoint `GET /servers?q={query}` includes it. So we search
 * by qualifiedName and pick the result whose qualifiedName matches
 * exactly. No fuzzy fallback — silent false positives are unacceptable
 * for trust-grading data (per scoring-brief.md).
 *
 * Smithery requires a browser User-Agent to bypass bot detection.
 *
 * Returns null when no result on Smithery matches the exact
 * qualifiedName (which is most of our seed — only the 8 curated
 * identities in servers.yaml have Smithery counterparts).
 */

import { fetchWithRetry } from "./fetch.js";

const LABEL = "smithery";
const BROWSER_UA =
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36";

export interface SmitheryAdapterData {
  qualified_name: string;
  use_count: number;
  verified: boolean;
  is_deployed: boolean;
  smithery_created_at: string | null;
}

interface SmitheryServerEntry {
  qualifiedName?: string;
  useCount?: number;
  verified?: boolean;
  isDeployed?: boolean;
  createdAt?: string;
}

interface SmitheryListResponse {
  servers?: SmitheryServerEntry[];
}

export async function fetchSmithery(
  qualifiedName: string,
): Promise<SmitheryAdapterData | null> {
  // Search by qualifiedName. Smithery's search can return up to N results
  // ordered by their internal relevance — we always look for an exact
  // qualifiedName match, never accepting a near-miss.
  const url = `https://registry.smithery.ai/servers?q=${encodeURIComponent(qualifiedName)}&pageSize=10`;
  const res = await fetchWithRetry(url, {
    label: LABEL,
    passThroughStatuses: [404],
    headers: { "User-Agent": BROWSER_UA, Accept: "application/json" },
  });
  if (!res.ok) return null;

  const body = (await res.json()) as SmitheryListResponse;
  const match = (body.servers ?? []).find((s) => s.qualifiedName === qualifiedName);
  if (!match) return null;

  return {
    qualified_name: match.qualifiedName ?? qualifiedName,
    use_count: match.useCount ?? 0,
    verified: match.verified ?? false,
    is_deployed: match.isDeployed ?? false,
    smithery_created_at: match.createdAt ?? null,
  };
}
