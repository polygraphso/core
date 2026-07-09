/**
 * OSV adapter — per-advisory detail keyed by GHSA id.
 *
 * deps.dev tells us WHICH advisories affect a package (the GHSA ids) but only
 * carries a CVSS score. OSV (api.osv.dev, no key) is the authority for the rest:
 * CVE aliases, a human summary, the affected/fixed version ranges, and the
 * GitHub-reviewed severity. deps.dev advisory ids ARE GHSA ids, so we look each
 * one up directly.
 *
 * Returns null when OSV doesn't have the id (404) or the fetch fails — the caller
 * falls back to a minimal advisory row.
 */

import { fetchWithRetry } from "./fetch.js";
import type { AdvisorySeverity } from "./depsdev.js";

const LABEL = "osv";
const BASE = "https://api.osv.dev/v1";

/** One affected package in an OSV record, with its version range if present. */
export interface OsvAffected {
  /** OSV ecosystem string, e.g. "npm", "PyPI". */
  ecosystem: string;
  name: string;
  /** Human range string built from the introduced/fixed events, or null. */
  range: string | null;
  fixed_version: string | null;
}

export interface OsvAdvisory {
  ghsa_id: string;
  cve_ids: string[];
  severity: AdvisorySeverity | null;
  cvss: number | null;
  cvss_vector: string | null;
  summary: string | null;
  url: string | null;
  published_at: string | null;
  withdrawn_at: string | null;
  affected: OsvAffected[];
}

interface OsvRangeEvent {
  introduced?: string;
  fixed?: string;
  last_affected?: string;
}

interface OsvRange {
  type?: string;
  events?: OsvRangeEvent[];
}

interface OsvAffectedRaw {
  package?: { ecosystem?: string; name?: string };
  ranges?: OsvRange[];
}

interface OsvSeverityRaw {
  type?: string;
  score?: string;
}

interface OsvReference {
  type?: string;
  url?: string;
}

interface OsvVulnResponse {
  id?: string;
  aliases?: string[];
  summary?: string;
  published?: string;
  withdrawn?: string;
  severity?: OsvSeverityRaw[];
  affected?: OsvAffectedRaw[];
  references?: OsvReference[];
  database_specific?: { severity?: string };
}

/** GHSA severity strings → our enum. GHSA uses MODERATE; tolerate MEDIUM too. */
export function normalizeSeverity(raw: string | null | undefined): AdvisorySeverity | null {
  if (!raw) return null;
  const up = raw.toUpperCase();
  if (up === "CRITICAL") return "CRITICAL";
  if (up === "HIGH") return "HIGH";
  if (up === "MODERATE" || up === "MEDIUM") return "MODERATE";
  if (up === "LOW") return "LOW";
  return null;
}

/** Build a readable range string from OSV introduced/fixed events. */
function rangeString(events: OsvRangeEvent[]): { range: string | null; fixed: string | null } {
  const parts: string[] = [];
  let fixed: string | null = null;
  for (const e of events) {
    if (e.introduced && e.introduced !== "0") parts.push(`>=${e.introduced}`);
    else if (e.introduced === "0") parts.push(">=0");
    if (e.fixed) {
      parts.push(`<${e.fixed}`);
      fixed = e.fixed;
    }
    if (e.last_affected) parts.push(`<=${e.last_affected}`);
  }
  return { range: parts.length ? parts.join(" ") : null, fixed };
}

export async function fetchOsvVuln(ghsaId: string): Promise<OsvAdvisory | null> {
  let res: Response;
  try {
    res = await fetchWithRetry(`${BASE}/vulns/${encodeURIComponent(ghsaId)}`, {
      label: LABEL,
      passThroughStatuses: [404],
    });
  } catch {
    return null;
  }
  if (!res.ok || res.status === 404) return null;

  const data = (await res.json()) as OsvVulnResponse;

  const cvssVector =
    data.severity?.find((s) => (s.type ?? "").toUpperCase().startsWith("CVSS"))?.score ?? null;

  const affected: OsvAffected[] = (data.affected ?? []).flatMap((a) => {
    const pkg = a.package;
    if (!pkg?.ecosystem || !pkg.name) return [];
    const events = (a.ranges ?? []).flatMap((r) => r.events ?? []);
    const { range, fixed } = rangeString(events);
    return [{ ecosystem: pkg.ecosystem, name: pkg.name, range, fixed_version: fixed }];
  });

  const advisoryUrl =
    data.references?.find((r) => (r.type ?? "").toUpperCase() === "ADVISORY")?.url ??
    `https://github.com/advisories/${ghsaId}`;

  return {
    ghsa_id: ghsaId,
    cve_ids: (data.aliases ?? []).filter((a) => a.startsWith("CVE-")),
    severity: normalizeSeverity(data.database_specific?.severity),
    cvss: null,
    cvss_vector: cvssVector,
    summary: data.summary ?? null,
    url: advisoryUrl,
    published_at: data.published ?? null,
    withdrawn_at: data.withdrawn ?? null,
    affected,
  };
}
