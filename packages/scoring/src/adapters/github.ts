/**
 * GitHub adapter — pulls adoption signals for a public repo.
 *
 * Signals returned:
 *   - stars, forks, contributors_count
 *   - archived (deprecation signal)
 *   - last_push_at, created_at
 *   - pr_count_open, pr_count_closed (via search API)
 *   - commit_activity_last_year (52-week array of weekly commit counts)
 *
 * Requires `GITHUB_TOKEN` at call time per the documented operational
 * stance — unauthed requests are 60/hr which is unworkable at scale and
 * silent rate-limit failures are the worst kind of bug. Throws loud if
 * missing.
 *
 * Returns null when the repo doesn't exist or is private (404). Throws
 * on other failures after retries.
 */

import { fetchWithRetry, rateLimitDelay } from "./fetch.js";

const LABEL = "github";
const DELAY_MS = 200;
const API = "https://api.github.com";

export interface GithubAdapterData {
  owner: string;
  repo: string;
  stars: number;
  forks: number;
  contributors_count: number;
  archived: boolean;
  last_push_at: string | null;
  created_at: string | null;
  pr_count_open: number;
  pr_count_closed: number;
  /** Length 52 when available. Empty when GitHub's stats endpoint isn't ready (it computes on first request). */
  commit_activity_last_year: number[];
}

interface RepoResponse {
  stargazers_count?: number;
  forks_count?: number;
  archived?: boolean;
  pushed_at?: string;
  created_at?: string;
}

interface SearchResponse {
  total_count?: number;
}

interface WeekActivity {
  total?: number;
}

function requireToken(): string {
  const token = process.env.GITHUB_TOKEN;
  if (!token) {
    throw new Error(
      "GITHUB_TOKEN is required for the GitHub adapter. Unauthed requests are " +
      "rate-limited at 60/hr, which silently breaks scoring runs. Set it in .env.",
    );
  }
  return token;
}

function githubHeaders(token: string): Record<string, string> {
  return {
    Accept: "application/vnd.github+json",
    "X-GitHub-Api-Version": "2022-11-28",
    Authorization: `Bearer ${token}`,
  };
}

export function parseContributorsCount(linkHeader: string | null): number {
  if (!linkHeader) return 1; // single-page response, exactly one page of contributors
  const match = linkHeader.match(/[?&]page=(\d+)>;\s*rel="last"/);
  return match ? Number(match[1]) : 1;
}

export async function fetchGitHub(
  owner: string,
  repo: string,
): Promise<GithubAdapterData | null> {
  const headers = githubHeaders(requireToken());

  const repoRes = await fetchWithRetry(`${API}/repos/${owner}/${repo}`, {
    label: LABEL,
    headers,
    passThroughStatuses: [404],
  });
  if (repoRes.status === 404) return null;

  const repoData = (await repoRes.json()) as RepoResponse;
  await rateLimitDelay(DELAY_MS);

  // Contributors — single request with per_page=1 lets us read the count
  // from the Link header's `rel="last"` instead of paginating all of them.
  let contributorsCount = 0;
  try {
    const contribRes = await fetchWithRetry(
      `${API}/repos/${owner}/${repo}/contributors?per_page=1&anon=false`,
      { label: LABEL, headers, passThroughStatuses: [404, 204] },
    );
    if (contribRes.ok) {
      contributorsCount = parseContributorsCount(contribRes.headers.get("link"));
      await contribRes.text(); // drain body
    }
  } catch {
    // non-critical
  }
  await rateLimitDelay(DELAY_MS);

  // PR counts via search API — total_count is what we want, per_page=1 minimizes body.
  let prCountOpen = 0;
  let prCountClosed = 0;
  try {
    const [openRes, closedRes] = await Promise.all([
      fetchWithRetry(
        `${API}/search/issues?q=repo:${owner}/${repo}+type:pr+state:open&per_page=1`,
        { label: LABEL, headers },
      ),
      fetchWithRetry(
        `${API}/search/issues?q=repo:${owner}/${repo}+type:pr+state:closed&per_page=1`,
        { label: LABEL, headers },
      ),
    ]);
    prCountOpen = ((await openRes.json()) as SearchResponse).total_count ?? 0;
    prCountClosed = ((await closedRes.json()) as SearchResponse).total_count ?? 0;
  } catch {
    // non-critical
  }
  await rateLimitDelay(DELAY_MS);

  // commit_activity returns 202 (computing) on first request for a repo
  // GitHub hasn't seen recently. Empty array is the right fallback —
  // next daily run will get the real data.
  let commitActivity: number[] = [];
  try {
    const activityRes = await fetchWithRetry(
      `${API}/repos/${owner}/${repo}/stats/commit_activity`,
      { label: LABEL, headers, passThroughStatuses: [202] },
    );
    if (activityRes.status === 200) {
      const weeks = (await activityRes.json()) as WeekActivity[];
      commitActivity = weeks.map((w) => w.total ?? 0);
    }
  } catch {
    // non-critical
  }

  return {
    owner,
    repo,
    stars: repoData.stargazers_count ?? 0,
    forks: repoData.forks_count ?? 0,
    contributors_count: contributorsCount,
    archived: repoData.archived ?? false,
    last_push_at: repoData.pushed_at ?? null,
    created_at: repoData.created_at ?? null,
    pr_count_open: prCountOpen,
    pr_count_closed: prCountClosed,
    commit_activity_last_year: commitActivity,
  };
}
