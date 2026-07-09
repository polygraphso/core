/**
 * GitHub Security Advisories adapter — repository-level published advisories.
 *
 * For a github/owner/repo MCP there is no deps.dev package to key on, so CVE
 * coverage comes from the advisories the maintainer published ON that repo:
 * GET /repos/{owner}/{repo}/security-advisories. This is repo-scoped (the repo's
 * own disclosed advisories), NOT the full dependency tree — the CVE tab states
 * that limit in its copy.
 *
 * Reuses the github adapter's token + headers. Returns [] on 404/403 (no
 * advisories, or the repo doesn't expose them) so a repo without advisories is
 * a clean empty, not an error.
 */

import { fetchWithRetry } from "./fetch.js";
import { githubHeaders, requireToken } from "./github.js";
import type { AdvisorySeverity } from "./depsdev.js";
import { normalizeSeverity } from "./osv.js";

const LABEL = "ghsa";
const API = "https://api.github.com";

/** A normalized repo security advisory. */
export interface GhsaAdvisory {
  ghsa_id: string;
  cve_ids: string[];
  severity: AdvisorySeverity | null;
  cvss: number | null;
  cvss_vector: string | null;
  summary: string | null;
  url: string | null;
  published_at: string | null;
  withdrawn_at: string | null;
  /** Vulnerable range for the repo's own package, if the advisory names one. */
  affected_range: string | null;
  fixed_version: string | null;
}

interface RepoAdvisoryVulnerability {
  vulnerable_version_range?: string | null;
  first_patched_version?: { identifier?: string } | string | null;
}

interface RepoAdvisoryIdentifier {
  type?: string;
  value?: string;
}

interface RepoAdvisoryResponse {
  ghsa_id?: string;
  cve_id?: string | null;
  summary?: string | null;
  severity?: string | null;
  html_url?: string | null;
  published_at?: string | null;
  withdrawn_at?: string | null;
  cvss?: { vector_string?: string | null; score?: number | null } | null;
  identifiers?: RepoAdvisoryIdentifier[];
  vulnerabilities?: RepoAdvisoryVulnerability[];
}

function patchedIdentifier(v: RepoAdvisoryVulnerability | undefined): string | null {
  const fp = v?.first_patched_version;
  if (!fp) return null;
  if (typeof fp === "string") return fp;
  return fp.identifier ?? null;
}

export function normalizeRepoAdvisory(raw: RepoAdvisoryResponse): GhsaAdvisory | null {
  if (!raw.ghsa_id) return null;
  const cveIds = (raw.identifiers ?? [])
    .filter((i) => (i.type ?? "").toUpperCase() === "CVE" && i.value)
    .map((i) => i.value as string);
  if (cveIds.length === 0 && raw.cve_id) cveIds.push(raw.cve_id);

  const firstVuln = raw.vulnerabilities?.[0];

  return {
    ghsa_id: raw.ghsa_id,
    cve_ids: cveIds,
    severity: normalizeSeverity(raw.severity),
    cvss: raw.cvss?.score ?? null,
    cvss_vector: raw.cvss?.vector_string ?? null,
    summary: raw.summary ?? null,
    url: raw.html_url ?? `https://github.com/advisories/${raw.ghsa_id}`,
    published_at: raw.published_at ?? null,
    withdrawn_at: raw.withdrawn_at ?? null,
    affected_range: firstVuln?.vulnerable_version_range ?? null,
    fixed_version: patchedIdentifier(firstVuln),
  };
}

export async function fetchRepoSecurityAdvisories(
  owner: string,
  repo: string,
): Promise<GhsaAdvisory[]> {
  let res: Response;
  try {
    res = await fetchWithRetry(
      `${API}/repos/${owner}/${repo}/security-advisories?per_page=100&state=published`,
      { label: LABEL, headers: githubHeaders(requireToken()), passThroughStatuses: [403, 404] },
    );
  } catch {
    return [];
  }
  if (!res.ok || res.status === 403 || res.status === 404) return [];

  const rows = (await res.json()) as RepoAdvisoryResponse[];
  if (!Array.isArray(rows)) return [];
  return rows
    .map(normalizeRepoAdvisory)
    .filter((a): a is GhsaAdvisory => a !== null);
}
