/**
 * CVE view-model + coverage types, in a client-safe module (NO `server-only`) so
 * the CvesManager client component and the server data layer share them. Runtime
 * reads live in lib/cveData (server-only); this file is types + pure helpers.
 *
 * web/ is a standalone Vercel deploy target, so these mirror the advisories
 * schema (packages/core/src/types.ts) rather than import it.
 */

import type { EcosystemEntryKind } from "@/lib/ecosystemTypes";

export type CveSeverity = "CRITICAL" | "HIGH" | "MODERATE" | "LOW";
export type CveCoverage = "covered" | "not_covered";

export const SEVERITY_RANK: Record<CveSeverity, number> = {
  CRITICAL: 4,
  HIGH: 3,
  MODERATE: 2,
  LOW: 1,
};

/** One advisory affecting an entry, ready to render. */
export interface AdvisoryVM {
  ghsaId: string;
  cveIds: string[];
  severity: CveSeverity | null;
  cvss: number | null;
  summary: string | null;
  url: string | null;
  affectedRange: string | null;
  fixedVersion: string | null;
  publishedAt: string | null;
}

/** One tracked MCP/skill entry with its current advisories (or coverage note). */
export interface EcosystemCveGroupVM {
  entryId: string;
  name: string;
  target: string | null;
  targetKind: EcosystemEntryKind;
  coverage: CveCoverage;
  /** Highest severity among the advisories, for sort / at-a-glance. */
  topSeverity: CveSeverity | null;
  advisories: AdvisoryVM[];
}

/**
 * Strip a skill's `#path` suffix so the read-side key matches the ingest's
 * `package_key` (advisory coverage is repo-level). Mirrors the scoring ingest's
 * normalizeTargetKey.
 */
export function normalizeTargetKey(target: string): string {
  const hash = target.indexOf("#");
  return hash === -1 ? target : target.slice(0, hash);
}

/**
 * Which entries can have package-level CVE coverage: npm / pypi / github targets.
 * Remote https:// endpoints have no package advisory feed → "not covered".
 */
export function coverageFor(targetKind: EcosystemEntryKind, target: string | null): CveCoverage {
  if (!target || targetKind === "remote_url") return "not_covered";
  return /^(npm|pypi|github)\//.test(normalizeTargetKey(target)) ? "covered" : "not_covered";
}
