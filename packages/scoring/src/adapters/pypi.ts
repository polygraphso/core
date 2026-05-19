/**
 * pypi adapter — same shape as npm, sourced from pypi.org/pypi/{pkg}/json
 * (metadata) and pypistats.org (downloads). PyPI packages are flat — no
 * owner segment — so the input is just the package name.
 *
 * Returns null when the package doesn't exist on PyPI (404).
 */

import { fetchWithRetry, rateLimitDelay } from "./fetch.js";

const LABEL = "pypi";
/**
 * pypistats.org rate-limits aggressive bursts; the production scoring log
 * showed ~10 429s when we fired the two pypistats endpoints in parallel
 * per server. Serialize them with a small courtesy delay between to stay
 * under the rate limit. The pypi.org metadata call is on a different
 * host so it still runs in parallel with the first pypistats call.
 */
const PYPISTATS_DELAY_MS = 200;

export interface PypiAdapterData {
  package_name: string;
  latest_version: string | null;
  last_release_date: string | null;
  github_owner_repo: { owner: string; repo: string } | null;
  downloads_last_month: number;
  /** Length 8, oldest week first. Empty if pypistats range endpoint failed. */
  weekly_downloads: number[];
}

interface PypiJsonResponse {
  info?: {
    version?: string;
    project_urls?: Record<string, string>;
    home_page?: string;
  };
  releases?: Record<string, Array<{ upload_time?: string }>>;
  urls?: Array<{ upload_time?: string }>;
}

interface PypiStatsRecent {
  data?: { last_month?: number };
}

interface PypiStatsRange {
  data?: Array<{ date: string; downloads: number }>;
}

const GITHUB_URL_RE = /github\.com[/:]([\w.-]+)\/([\w.-]+?)(?:\/|$)/;

export function extractGithubFromPypiInfo(info: PypiJsonResponse["info"]): { owner: string; repo: string } | null {
  if (!info) return null;
  const candidates: string[] = [];
  if (info.home_page) candidates.push(info.home_page);
  for (const url of Object.values(info.project_urls ?? {})) {
    if (typeof url === "string") candidates.push(url);
  }
  for (const url of candidates) {
    const match = url.match(GITHUB_URL_RE);
    if (match) return { owner: match[1]!, repo: match[2]!.replace(/\.git$/, "") };
  }
  return null;
}

export function toPypiWeeklyDownloads(range: PypiStatsRange): number[] {
  const points = range.data;
  if (!Array.isArray(points) || points.length === 0) return [];
  // pypistats returns ascending date order; we want oldest-first 8-week buckets.
  // Take the last 56 days, then group by 7.
  const sorted = [...points].sort((a, b) => a.date.localeCompare(b.date));
  const last56 = sorted.slice(-56);
  if (last56.length < 56) return [];
  const weeks: number[] = [];
  for (let i = 0; i < 8; i++) {
    weeks.push(last56.slice(i * 7, (i + 1) * 7).reduce((s, d) => s + d.downloads, 0));
  }
  return weeks;
}

export async function fetchPypi(packageName: string): Promise<PypiAdapterData | null> {
  const encoded = encodeURIComponent(packageName);

  // pypi.org + the first pypistats call in parallel (different hosts).
  const [metaRes, recentRes] = await Promise.all([
    fetchWithRetry(`https://pypi.org/pypi/${encoded}/json`, {
      label: LABEL,
      passThroughStatuses: [404],
    }),
    fetchWithRetry(`https://pypistats.org/api/packages/${encoded}/recent`, {
      label: LABEL,
      passThroughStatuses: [404],
    }),
  ]);
  // Space out the second pypistats call so we don't trigger their burst limit.
  await rateLimitDelay(PYPISTATS_DELAY_MS);
  const rangeRes = await fetchWithRetry(
    `https://pypistats.org/api/packages/${encoded}/overall?mirrors=true`,
    { label: LABEL, passThroughStatuses: [404] },
  );

  if (metaRes.status === 404) return null;

  const meta = (await metaRes.json()) as PypiJsonResponse;
  const info = meta.info;
  const latestVersion = info?.version ?? null;

  // Last release date: prefer urls (files for the latest version), fall back to releases[version]
  let lastRelease: string | null = null;
  if (meta.urls && meta.urls.length > 0) {
    lastRelease = meta.urls[meta.urls.length - 1]?.upload_time ?? null;
  } else if (latestVersion && meta.releases?.[latestVersion]?.length) {
    const files = meta.releases[latestVersion]!;
    lastRelease = files[files.length - 1]?.upload_time ?? null;
  }

  const downloadsLastMonth = recentRes.ok
    ? ((await recentRes.json()) as PypiStatsRecent).data?.last_month ?? 0
    : 0;

  const weeklyDownloads = rangeRes.ok
    ? toPypiWeeklyDownloads((await rangeRes.json()) as PypiStatsRange)
    : [];

  return {
    package_name: packageName,
    latest_version: latestVersion,
    last_release_date: lastRelease,
    github_owner_repo: extractGithubFromPypiInfo(info),
    downloads_last_month: downloadsLastMonth,
    weekly_downloads: weeklyDownloads,
  };
}
