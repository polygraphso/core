/**
 * deps.dev adapter — pulls dependents count, advisory count + CVSS
 * severities, license, and SLSA provenance for an npm or pypi package.
 *
 * Per scoring-brief.md's locked scope-split rule: static / supply-chain
 * signals belong in scoring even when they're "security-flavored." CVSS
 * severity is a load-bearing input to the Risk term in the adoption
 * formula (without it, Risk degrades to a flat advisory count); SLSA
 * provenance is a static integrity signal that doesn't show up in any
 * litmus probe.
 *
 * Returns null when the package isn't indexed by deps.dev (404 on the
 * package endpoint, or zero versions).
 */

import { fetchWithRetry } from "./fetch.js";

const LABEL = "depsdev";
const BASE_V3 = "https://api.deps.dev/v3";
/** Dependent counts are only exposed on v3alpha (`:dependents`). */
const BASE_ALPHA = "https://api.deps.dev/v3alpha";

export type DepsDevEcosystem = "npm" | "pypi";

export type AdvisorySeverity = "CRITICAL" | "HIGH" | "MODERATE" | "LOW";

const SEVERITY_RANK: Record<AdvisorySeverity, number> = {
  CRITICAL: 4,
  HIGH: 3,
  MODERATE: 2,
  LOW: 1,
};

export interface DepsDevAdapterData {
  ecosystem: DepsDevEcosystem;
  package_name: string;
  latest_version: string | null;
  dependents_count: number;
  advisory_count: number;
  /** Highest severity across all advisories on the default version, or null when none. */
  max_advisory_severity: AdvisorySeverity | null;
  /**
   * Per-advisory severities, sorted high → low. Component-grade detail so
   * compute can do weighted (severity × count) rather than just "highest."
   * Empty when advisory_count is 0 or when the per-advisory fetches failed.
   */
  advisory_severities: AdvisorySeverity[];
  has_slsa_provenance: boolean;
  license_detected: string | null;
}

interface VersionKey {
  version?: string;
}

interface DepsDevVersion {
  versionKey?: VersionKey;
  isDefault?: boolean;
  licenses?: string[];
  advisoryKeys?: Array<{ id?: string }>;
  slsaProvenances?: unknown[];
}

interface DepsDevPackageResponse {
  versions?: DepsDevVersion[];
}

interface DepsDevDependentsResponse {
  dependentCount?: number;
}

interface AdvisoryResponse {
  cvss3Score?: number;
}

export function cvssToSeverity(score: number): AdvisorySeverity {
  if (score >= 9.0) return "CRITICAL";
  if (score >= 7.0) return "HIGH";
  if (score >= 4.0) return "MODERATE";
  return "LOW";
}

async function fetchAdvisorySeverities(advisoryIds: string[]): Promise<AdvisorySeverity[]> {
  if (advisoryIds.length === 0) return [];
  const results = await Promise.all(
    advisoryIds.map(async (id): Promise<AdvisorySeverity | null> => {
      try {
        const res = await fetchWithRetry(`${BASE_V3}/advisories/${encodeURIComponent(id)}`, {
          label: LABEL,
          passThroughStatuses: [404],
        });
        if (!res.ok) return null;
        const data = (await res.json()) as AdvisoryResponse;
        if (typeof data.cvss3Score === "number" && Number.isFinite(data.cvss3Score)) {
          return cvssToSeverity(data.cvss3Score);
        }
        return null;
      } catch {
        return null;
      }
    }),
  );
  return results
    .filter((s): s is AdvisorySeverity => s !== null)
    .sort((a, b) => SEVERITY_RANK[b] - SEVERITY_RANK[a]);
}

export async function fetchDepsDev(
  packageName: string,
  ecosystem: DepsDevEcosystem,
): Promise<DepsDevAdapterData | null> {
  const encName = encodeURIComponent(packageName);
  const pkgBase = `${BASE_V3}/systems/${ecosystem}/packages/${encName}`;

  const pkgRes = await fetchWithRetry(pkgBase, {
    label: LABEL,
    passThroughStatuses: [404],
  });
  if (pkgRes.status === 404) return null;

  const pkgData = (await pkgRes.json()) as DepsDevPackageResponse;
  const versions = pkgData.versions ?? [];
  if (versions.length === 0) return null;

  // Prefer the default version; fall back to the last one in the list.
  const defaultVer = versions.find((v) => v.isDefault) ?? versions[versions.length - 1]!;
  const version = defaultVer.versionKey?.version;
  if (!version) return null;

  // The version-detail endpoint has the richer view of advisoryKeys + licenses
  // + slsaProvenances. 404 here means the version exists in the list but the
  // detail endpoint doesn't have it — fall back to the version object from
  // the package list.
  const verRes = await fetchWithRetry(`${pkgBase}/versions/${encodeURIComponent(version)}`, {
    label: LABEL,
    passThroughStatuses: [404],
  });
  const verJson =
    verRes.ok && verRes.status !== 404
      ? ((await verRes.json()) as DepsDevVersion)
      : defaultVer;

  let dependentsCount = 0;
  try {
    const depRes = await fetchWithRetry(
      `${BASE_ALPHA}/systems/${ecosystem}/packages/${encName}/versions/${encodeURIComponent(version)}:dependents`,
      { label: LABEL, passThroughStatuses: [404] },
    );
    if (depRes.ok) {
      const depData = (await depRes.json()) as DepsDevDependentsResponse;
      dependentsCount = depData.dependentCount ?? 0;
    }
  } catch {
    // non-critical — dependents is a bonus signal
  }

  const advisoryIds = (verJson.advisoryKeys ?? [])
    .map((k) => k.id)
    .filter((id): id is string => Boolean(id));
  const advisorySeverities = await fetchAdvisorySeverities(advisoryIds);

  return {
    ecosystem,
    package_name: packageName,
    latest_version: version,
    dependents_count: dependentsCount,
    advisory_count: advisoryIds.length,
    max_advisory_severity: advisorySeverities[0] ?? null,
    advisory_severities: advisorySeverities,
    has_slsa_provenance: (verJson.slsaProvenances?.length ?? 0) > 0,
    license_detected: verJson.licenses?.[0] ?? null,
  };
}
