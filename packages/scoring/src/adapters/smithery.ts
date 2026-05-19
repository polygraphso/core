/**
 * Smithery adapter — JSON API for use_count + verified flag + deploy
 * status. Per brief, Smithery's verified flag is a component (not a
 * weight) in adoption; use_count is an adoption signal.
 *
 * Smithery requires a browser-style User-Agent to bypass bot detection.
 *
 * Returns null when the server isn't on Smithery (404).
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

interface SmitheryServer {
  qualifiedName?: string;
  useCount?: number;
  verified?: boolean;
  isDeployed?: boolean;
  createdAt?: string;
}

export async function fetchSmithery(
  qualifiedName: string,
): Promise<SmitheryAdapterData | null> {
  const res = await fetchWithRetry(
    `https://registry.smithery.ai/servers/${encodeURIComponent(qualifiedName)}`,
    {
      label: LABEL,
      passThroughStatuses: [404],
      headers: { "User-Agent": BROWSER_UA, Accept: "application/json" },
    },
  );
  if (res.status === 404) return null;

  const server = (await res.json()) as SmitheryServer;
  return {
    qualified_name: server.qualifiedName ?? qualifiedName,
    use_count: server.useCount ?? 0,
    verified: server.verified ?? false,
    is_deployed: server.isDeployed ?? false,
    smithery_created_at: server.createdAt ?? null,
  };
}
