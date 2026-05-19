/**
 * deps.dev adapter — pulls dependents count, advisory count, and license
 * for an npm or pypi package. Dependents count is exposed on v3alpha;
 * everything else is v3.
 *
 * Pruned vs. agentic-talent-app: dropped the per-advisory CVSS lookup
 * (severity is litmus / risk territory, not adoption) and SLSA provenance
 * (security signal, out of scope for adoption v1). Brief says
 * "Dependency vulnerabilities (lift the existing approach)" — we keep
 * advisory_count, which is the load-bearing signal.
 *
 * Returns null when the package isn't indexed by deps.dev (404 on the
 * package endpoint, or zero versions).
 */

import { fetchWithRetry } from "./fetch.js";

const LABEL = "depsdev";
const BASE_V3 = "https://api.deps.dev/v3";
const BASE_ALPHA = "https://api.deps.dev/v3alpha";

export type DepsDevEcosystem = "npm" | "pypi";

export interface DepsDevAdapterData {
  ecosystem: DepsDevEcosystem;
  package_name: string;
  latest_version: string | null;
  dependents_count: number;
  advisory_count: number;
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
}

interface DepsDevPackageResponse {
  versions?: DepsDevVersion[];
}

interface DepsDevDependentsResponse {
  dependentCount?: number;
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

  // The version-detail endpoint has the richer view of advisoryKeys + licenses.
  // 404 here means the version exists in the list but the detail endpoint
  // doesn't have it — fall back to the version object from the package list.
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

  return {
    ecosystem,
    package_name: packageName,
    latest_version: version,
    dependents_count: dependentsCount,
    advisory_count: (verJson.advisoryKeys ?? []).filter((k) => k.id).length,
    license_detected: verJson.licenses?.[0] ?? null,
  };
}
