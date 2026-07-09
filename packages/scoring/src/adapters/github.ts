/**
 * GitHub adapter — pulls adoption signals for a public repo.
 *
 * Signals returned:
 *   - stars, forks, contributors_count
 *   - archived (deprecation signal)
 *   - last_push_at, created_at
 *   - pr_count_open, pr_count_closed (via search API)
 *   - commit_activity_last_year (52-week array of weekly commit counts)
 *   - has_security_md, has_contributing_md (community-profile signals)
 *   - release_count_last_year, avg_days_between_releases (version cadence)
 *
 * Community profile and release cadence are static metadata signals —
 * per the locked scope-split rule in scoring-brief.md, they belong here
 * (not litmus). Compute doesn't currently consume them, but they sit in
 * adoption_scores.components for the forensic view and are ready for
 * future weighting.
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
  /**
   * Null when the /search/issues fetch failed (GitHub returns 422 for
   * niche cases — very-new/empty repos, validation issues — that retries
   * don't fix). Distinguishing "fetch failed" from "actually 0 PRs" lets
   * compute treat the former as structurally absent (per scoring-brief.md)
   * instead of silently counting it as zero activity.
   */
  pr_count_open: number | null;
  pr_count_closed: number | null;
  /** Length 52 when available. Empty when GitHub's stats endpoint isn't ready (it computes on first request). */
  commit_activity_last_year: number[];
  has_security_md: boolean;
  has_contributing_md: boolean;
  release_count_last_year: number;
  /** Null when fewer than two releases exist. */
  avg_days_between_releases: number | null;
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

interface CommunityProfileResponse {
  files?: {
    security?: unknown;
    contributing?: unknown;
  };
}

interface ReleaseResponse {
  published_at?: string | null;
}

export function requireToken(): string {
  const token = process.env.GITHUB_TOKEN;
  if (!token) {
    throw new Error(
      "GITHUB_TOKEN is required for the GitHub adapter. Unauthed requests are " +
      "rate-limited at 60/hr, which silently breaks scoring runs. Set it in .env.",
    );
  }
  return token;
}

export function githubHeaders(token: string): Record<string, string> {
  return {
    Accept: "application/vnd.github+json",
    "X-GitHub-Api-Version": "2022-11-28",
    Authorization: `Bearer ${token}`,
  };
}

export interface CommitInfo {
  sha: string;
  /** Committer date (ISO 8601) — when the commit landed. Null if absent. */
  committedAt: string | null;
}

interface CommitListItem {
  sha?: string;
  commit?: { committer?: { date?: string | null } | null } | null;
}

/**
 * Latest commit touching `subPath` (PATH-SCOPED), on branch/commit `ref` (the
 * repo's default branch when omitted). This is the GitHub "version stream" the
 * monitor watches for skills and GitHub servers: capture, backfill, and live
 * monitoring all call this so the value stored at grade time is computed the
 * same way it is compared later.
 *
 * Path-scoped is deliberate — a monorepo like BankrBot/skills holds many skills,
 * so scoping to the graded subdirectory means an unrelated skill's commit does
 * not look like a change to this one.
 *
 * Returns null when there is no such commit: 404 (missing repo/path), 409
 * (empty repo), or an empty result set. Throws on other failures after retries.
 */
export async function latestCommitForPath(
  owner: string,
  repo: string,
  ref?: string | null,
  subPath?: string | null,
): Promise<CommitInfo | null> {
  const headers = githubHeaders(requireToken());
  const params = new URLSearchParams({ per_page: "1" });
  if (ref) params.set("sha", ref);
  if (subPath) params.set("path", subPath);
  const res = await fetchWithRetry(
    `${API}/repos/${owner}/${repo}/commits?${params.toString()}`,
    { label: LABEL, headers, passThroughStatuses: [404, 409] },
  );
  if (res.status === 404 || res.status === 409) return null;
  const commits = (await res.json()) as CommitListItem[];
  const top = Array.isArray(commits) ? commits[0] : undefined;
  if (!top?.sha) return null;
  return { sha: top.sha, committedAt: top.commit?.committer?.date ?? null };
}

export function parseContributorsCount(linkHeader: string | null): number {
  if (!linkHeader) return 1; // single-page response, exactly one page of contributors
  const match = linkHeader.match(/[?&]page=(\d+)>;\s*rel="last"/);
  return match ? Number(match[1]) : 1;
}

const MS_PER_DAY = 1000 * 60 * 60 * 24;
const MS_PER_YEAR = 365 * MS_PER_DAY;

/**
 * Compute release-cadence signals from a list of published_at strings (any order).
 * Exported for unit testing.
 */
export function computeReleaseCadence(
  publishedAts: Array<string | null | undefined>,
  now: number = Date.now(),
): { release_count_last_year: number; avg_days_between_releases: number | null } {
  const timestamps = publishedAts
    .filter((iso): iso is string => Boolean(iso))
    .map((iso) => new Date(iso).getTime())
    .filter((t) => Number.isFinite(t));

  const release_count_last_year = timestamps.filter((t) => t > now - MS_PER_YEAR).length;

  if (timestamps.length < 2) {
    return { release_count_last_year, avg_days_between_releases: null };
  }
  const sorted = [...timestamps].sort((a, b) => b - a);
  let totalDiff = 0;
  for (let i = 0; i < sorted.length - 1; i++) {
    totalDiff += sorted[i]! - sorted[i + 1]!;
  }
  const avgMs = totalDiff / (sorted.length - 1);
  return {
    release_count_last_year,
    avg_days_between_releases: avgMs / MS_PER_DAY,
  };
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
  // 422 ("Validation Failed") comes back for some niche repos (very-new,
  // empty, query-validation edge cases). Retrying doesn't fix it and the
  // exponential backoff burns ~10s per affected repo, so pass it through
  // as a non-retry. On failure stay at null (not 0) so compute can
  // distinguish "search failed" from "actually zero PRs" — see comment
  // on GithubAdapterData.pr_count_open.
  let prCountOpen: number | null = null;
  let prCountClosed: number | null = null;
  try {
    const [openRes, closedRes] = await Promise.all([
      fetchWithRetry(
        `${API}/search/issues?q=repo:${owner}/${repo}+type:pr+state:open&per_page=1`,
        { label: LABEL, headers, passThroughStatuses: [422] },
      ),
      fetchWithRetry(
        `${API}/search/issues?q=repo:${owner}/${repo}+type:pr+state:closed&per_page=1`,
        { label: LABEL, headers, passThroughStatuses: [422] },
      ),
    ]);
    if (openRes.ok) {
      prCountOpen = ((await openRes.json()) as SearchResponse).total_count ?? 0;
    }
    if (closedRes.ok) {
      prCountClosed = ((await closedRes.json()) as SearchResponse).total_count ?? 0;
    }
  } catch {
    // network/timeout — null is the right "unknown" sentinel for compute
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
  await rateLimitDelay(DELAY_MS);

  // Community profile — static metadata, doesn't require any sandboxed
  // execution. Non-fatal; both flags default to false.
  let hasSecurityMd = false;
  let hasContributingMd = false;
  try {
    const profileRes = await fetchWithRetry(
      `${API}/repos/${owner}/${repo}/community/profile`,
      { label: LABEL, headers, passThroughStatuses: [404] },
    );
    if (profileRes.ok) {
      const profile = (await profileRes.json()) as CommunityProfileResponse;
      hasSecurityMd = Boolean(profile.files?.security);
      hasContributingMd = Boolean(profile.files?.contributing);
    }
  } catch {
    // non-critical
  }
  await rateLimitDelay(DELAY_MS);

  // Release cadence — version cadence is in-scope per the brief.
  let releaseCadence = {
    release_count_last_year: 0,
    avg_days_between_releases: null as number | null,
  };
  try {
    const relRes = await fetchWithRetry(
      `${API}/repos/${owner}/${repo}/releases?per_page=100`,
      { label: LABEL, headers, passThroughStatuses: [404] },
    );
    if (relRes.ok) {
      const releases = (await relRes.json()) as ReleaseResponse[];
      releaseCadence = computeReleaseCadence(releases.map((r) => r.published_at));
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
    has_security_md: hasSecurityMd,
    has_contributing_md: hasContributingMd,
    release_count_last_year: releaseCadence.release_count_last_year,
    avg_days_between_releases: releaseCadence.avg_days_between_releases,
  };
}
