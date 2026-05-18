/**
 * npm adapter — pulls adoption signals for a published npm package.
 *
 * Signals returned (all mapped into AdoptionComponents downstream):
 *   - latest_version       — for version-detection in the orchestration loop
 *   - last_publish_date    — freshness signal
 *   - deprecated           — adoption-decay signal
 *   - downloads_last_month — primary adoption signal
 *   - weekly_downloads     — 8 weeks of weekly totals for velocity
 *   - github_owner_repo    — chained to the github adapter when present
 *
 * Returns null when the package doesn't exist on npm (404). Throws on
 * other errors after retries are exhausted.
 */

import { fetchWithRetry } from "./fetch.js";

const LABEL = "npm";

export interface NpmAdapterData {
  package_name: string;
  latest_version: string | null;
  last_publish_date: string | null;
  deprecated: boolean;
  github_owner_repo: { owner: string; repo: string } | null;
  downloads_last_month: number;
  /** Length 8, oldest week first. Empty if downloads/range endpoint failed. */
  weekly_downloads: number[];
}

interface NpmMetadata {
  "dist-tags"?: { latest?: string };
  time?: Record<string, string>;
  repository?: NpmRepoField;
  versions?: Record<string, NpmVersionEntry>;
}

interface NpmVersionEntry {
  deprecated?: string | boolean;
  repository?: NpmRepoField;
}

type NpmRepoField = string | { url?: string } | undefined;

interface NpmDownloadsPoint {
  downloads?: number;
}

interface NpmDownloadsRange {
  downloads?: Array<{ downloads: number; day: string }>;
}

export function extractGithubOwnerRepo(field: NpmRepoField): { owner: string; repo: string } | null {
  if (!field) return null;
  const url = typeof field === "string" ? field : field.url;
  if (typeof url !== "string") return null;
  const cleaned = url.replace(/^git\+/, "").replace(/\.git$/, "").replace(/^ssh:\/\/git@/, "https://");
  const match = cleaned.match(/github\.com[/:]([\w.-]+)\/([\w.-]+?)(?:\/|$)/);
  if (!match) return null;
  return { owner: match[1]!, repo: match[2]! };
}

function eightWeekRange(now: Date = new Date()): string {
  const fmt = (d: Date) => d.toISOString().slice(0, 10);
  const end = fmt(now);
  const start = fmt(new Date(now.getTime() - 56 * 24 * 60 * 60 * 1000));
  return `${start}:${end}`;
}

export function toWeeklyDownloads(daily: NpmDownloadsRange): number[] {
  const points = daily.downloads;
  if (!Array.isArray(points) || points.length === 0) return [];
  const counts = points.map((p) => p.downloads);
  const weeks: number[] = [];
  for (let i = 0; i < 8 && (i + 1) * 7 <= counts.length; i++) {
    weeks.push(counts.slice(i * 7, (i + 1) * 7).reduce((s, n) => s + n, 0));
  }
  return weeks;
}

export async function fetchNpm(packageName: string): Promise<NpmAdapterData | null> {
  const encoded = encodeURIComponent(packageName);

  const [metaRes, dlMonthRes, dlRangeRes] = await Promise.all([
    fetchWithRetry(`https://registry.npmjs.org/${encoded}`, {
      label: LABEL,
      passThroughStatuses: [404],
    }),
    fetchWithRetry(`https://api.npmjs.org/downloads/point/last-month/${encoded}`, {
      label: LABEL,
      passThroughStatuses: [404],
    }),
    fetchWithRetry(
      `https://api.npmjs.org/downloads/range/${eightWeekRange()}/${encoded}`,
      { label: LABEL, passThroughStatuses: [404] },
    ),
  ]);

  if (metaRes.status === 404) return null;

  const meta = (await metaRes.json()) as NpmMetadata;
  const latest = meta["dist-tags"]?.latest ?? null;
  const latestEntry = latest ? meta.versions?.[latest] : undefined;
  const lastPublish =
    (latest && meta.time?.[latest]) || meta.time?.["modified"] || null;

  // Repository can live on the top-level packument or on the version entry.
  const ghRef = extractGithubOwnerRepo(meta.repository ?? latestEntry?.repository);

  const downloadsLastMonth = dlMonthRes.ok
    ? ((await dlMonthRes.json()) as NpmDownloadsPoint).downloads ?? 0
    : 0;

  const weeklyDownloads = dlRangeRes.ok
    ? toWeeklyDownloads((await dlRangeRes.json()) as NpmDownloadsRange)
    : [];

  return {
    package_name: packageName,
    latest_version: latest,
    last_publish_date: lastPublish,
    deprecated: Boolean(latestEntry?.deprecated),
    github_owner_repo: ghRef,
    downloads_last_month: downloadsLastMonth,
    weekly_downloads: weeklyDownloads,
  };
}
