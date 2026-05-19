/**
 * OpenSSF Scorecard adapter — ingests the precomputed score for a github
 * repo from api.scorecard.dev. Per brief, we ingest scores rather than
 * recompute them.
 *
 * Returns null when the repo isn't in the Scorecard dataset (most repos
 * aren't — Scorecard runs against a curated set of widely-used projects).
 */

import { fetchWithRetry } from "./fetch.js";

const LABEL = "openssf";
const BASE = "https://api.scorecard.dev";

export interface OpenSSFAdapterData {
  owner: string;
  repo: string;
  aggregate_score: number;
  /** Sub-check scores keyed by check name. Score is 0-10 or -1 (not applicable). */
  checks: Record<string, number>;
}

interface ScorecardCheck {
  name?: string;
  score?: number;
}

interface ScorecardResponse {
  score?: number;
  checks?: ScorecardCheck[];
}

export async function fetchOpenSSF(
  owner: string,
  repo: string,
): Promise<OpenSSFAdapterData | null> {
  const url = `${BASE}/projects/github.com/${encodeURIComponent(owner)}/${encodeURIComponent(repo)}`;
  const res = await fetchWithRetry(url, {
    label: LABEL,
    passThroughStatuses: [404],
  });
  if (res.status === 404) return null;

  const json = (await res.json()) as ScorecardResponse;
  const checks: Record<string, number> = {};
  for (const c of json.checks ?? []) {
    if (c.name && typeof c.score === "number") {
      checks[c.name] = c.score;
    }
  }

  return {
    owner,
    repo,
    aggregate_score: json.score ?? 0,
    checks,
  };
}
