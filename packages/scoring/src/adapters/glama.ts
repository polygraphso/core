/**
 * Glama adapter — JSON API for identity (namespace, slug, repo URL,
 * SPDX license) plus HTML scrape of the score page for letter grades.
 *
 * Per brief, Glama grades are ingested as components, not as weights in
 * the adoption formula. They sit in adoption_scores.components for the
 * forensic view; the compute step never multiplies them.
 *
 * Caveat: the grade scrape is brittle by definition — Glama doesn't
 * expose grades in the public API, so we derive them from checklist
 * strings on the /score page. Lifted as-is from agentic-talent-app per
 * the "extract what's proven, don't re-engineer" rule. If Glama updates
 * their UI, all grade fields become null and the rest of the adapter
 * still returns useful data.
 *
 * Returns null when the server isn't on Glama (404 from the JSON API).
 */

import { fetchWithRetry } from "./fetch.js";

const LABEL = "glama";
const BROWSER_UA =
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36";

export interface GlamaAdapterData {
  namespace: string;
  slug: string;
  repository_url: string | null;
  spdx_license: string | null;
  /** From HTML scrape — null when Glama's checklist text changes. */
  security_grade: string | null;
  quality_grade: string | null;
  license_grade: string | null;
  tool_count: number | null;
}

interface GlamaApiServer {
  namespace?: string;
  slug?: string;
  repository?: { url?: string };
  spdxLicense?: { name?: string } | null;
}

function gradeFromQualityPoints(points: number): "A" | "B" | "C" | "D" | "F" {
  if (points >= 2) return "A";
  if (points >= 1) return "B";
  if (points >= 0) return "C";
  if (points >= -1) return "D";
  return "F";
}

export function deriveGradesFromScorePage(scoreHtml: string): {
  security_grade: string | null;
  quality_grade: string | null;
  license_grade: string | null;
} {
  const text = scoreHtml.toLowerCase();

  const license_grade = text.includes("missing license") ? "F" : null;

  let security_grade: string | null = null;
  if (text.includes("no known vulnerabilities")) security_grade = "A";
  else if (text.includes("known vulnerabilities")) security_grade = "D";

  let points = 0;
  if (text.includes("has readme")) points += 1;
  if (text.includes("has a release")) points += 1;
  if (text.includes("provides tools")) points += 1;
  if (text.includes("missing or invalid glama.json")) points -= 1;
  if (text.includes("no recent usage")) points -= 1;
  if (text.includes("author not verified")) points -= 1;

  return { security_grade, quality_grade: gradeFromQualityPoints(points), license_grade };
}

export function extractToolCount(html: string): number | null {
  const match = html.match(/(\d+)\s+tool/i);
  return match ? Number(match[1]) : null;
}

export async function fetchGlama(
  namespace: string,
  slug: string,
): Promise<GlamaAdapterData | null> {
  const encNs = encodeURIComponent(namespace);
  const encSlug = encodeURIComponent(slug);

  const apiRes = await fetchWithRetry(
    `https://glama.ai/api/mcp/v1/servers/${encNs}/${encSlug}`,
    { label: LABEL, passThroughStatuses: [404] },
  );
  if (apiRes.status === 404) return null;

  const apiData = (await apiRes.json()) as GlamaApiServer;

  let security_grade: string | null = null;
  let quality_grade: string | null = null;
  let license_grade: string | null = null;
  let tool_count: number | null = null;

  try {
    const pageRes = await fetchWithRetry(
      `https://glama.ai/mcp/servers/${encNs}/${encSlug}`,
      { label: LABEL, headers: { "User-Agent": BROWSER_UA }, passThroughStatuses: [404] },
    );
    if (pageRes.ok) {
      tool_count = extractToolCount(await pageRes.text());
    }

    const scoreRes = await fetchWithRetry(
      `https://glama.ai/mcp/servers/${encNs}/${encSlug}/score`,
      { label: LABEL, headers: { "User-Agent": BROWSER_UA }, passThroughStatuses: [404] },
    );
    if (scoreRes.ok) {
      ({ security_grade, quality_grade, license_grade } = deriveGradesFromScorePage(
        await scoreRes.text(),
      ));
    }
  } catch {
    // Scraping is best-effort. Grades stay null on failure.
  }

  return {
    namespace: apiData.namespace ?? namespace,
    slug: apiData.slug ?? slug,
    repository_url: apiData.repository?.url ?? null,
    spdx_license: apiData.spdxLicense?.name ?? null,
    security_grade,
    quality_grade,
    license_grade,
    tool_count,
  };
}
