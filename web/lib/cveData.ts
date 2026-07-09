import "server-only";

/**
 * DB read layer for the CVE tab. Loads an ecosystem's entries and joins each to
 * the advisories currently affecting it (advisory_targets → advisories, keyed by
 * the versionless package key the ingest job writes). One batched `in(...)` query
 * covers every entry; remote_url entries are marked "not covered" (no feed).
 *
 * Advisory rows are populated daily by packages/scoring (ingest-advisories.ts).
 * A grade is never needed here — this reads the CVE store directly.
 */

import { getSupabaseAdmin } from "@/lib/supabase";
import { listEntries } from "@/lib/ecosystemData";
import type { EcosystemEntryRow } from "@/lib/ecosystemTypes";
import { coverageFor, normalizeTargetKey, type CveCoverage, type CveSeverity } from "@/lib/cveTypes";

/** One advisory joined to its (package_key) mapping row. */
export interface JoinedAdvisory {
  ghsa_id: string;
  cve_ids: string[];
  severity: CveSeverity | null;
  cvss: number | null;
  summary: string | null;
  url: string | null;
  affected_range: string | null;
  fixed_version: string | null;
  published_at: string | null;
}

export interface EntryAdvisories {
  entry: EcosystemEntryRow;
  coverage: CveCoverage;
  advisories: JoinedAdvisory[];
}

interface AdvisoryJoin {
  ghsa_id: string;
  cve_ids: string[] | null;
  severity: CveSeverity | null;
  cvss: number | null;
  cvss_vector: string | null;
  summary: string | null;
  url: string | null;
  published_at: string | null;
  withdrawn_at: string | null;
}

interface AdvisoryTargetJoinRow {
  package_key: string;
  affected_range: string | null;
  fixed_version: string | null;
  current_version: string | null;
  advisories: AdvisoryJoin | AdvisoryJoin[] | null;
}

const ADVISORY_SELECT =
  "package_key, affected_range, fixed_version, current_version, " +
  "advisories(ghsa_id, cve_ids, severity, cvss, cvss_vector, summary, url, published_at, withdrawn_at)";

/**
 * Every entry (with a target) joined to its current advisories. Entries that
 * can't have package coverage (remote_url) come back with coverage="not_covered"
 * and no advisories; tracked-only rows (null target) are dropped.
 */
export async function loadEcosystemAdvisories(ecosystemId: string): Promise<EntryAdvisories[]> {
  const db = getSupabaseAdmin();
  const entries = await listEntries(ecosystemId);
  const withTarget = entries.filter((e): e is EcosystemEntryRow & { target: string } => !!e.target);

  const keys = [
    ...new Set(
      withTarget
        .filter((e) => coverageFor(e.target_kind, e.target) === "covered")
        .map((e) => normalizeTargetKey(e.target)),
    ),
  ];

  const byKey = new Map<string, JoinedAdvisory[]>();
  if (db && keys.length > 0) {
    const { data } = await db
      .from("advisory_targets")
      .select(ADVISORY_SELECT)
      .in("package_key", keys)
      .eq("is_current_affected", true);
    for (const row of (data as AdvisoryTargetJoinRow[] | null) ?? []) {
      const adv = Array.isArray(row.advisories) ? row.advisories[0] : row.advisories;
      if (!adv || adv.withdrawn_at) continue; // suppress rescinded advisories
      const list = byKey.get(row.package_key) ?? [];
      list.push({
        ghsa_id: adv.ghsa_id,
        cve_ids: adv.cve_ids ?? [],
        severity: adv.severity,
        cvss: adv.cvss,
        summary: adv.summary,
        url: adv.url,
        affected_range: row.affected_range,
        fixed_version: row.fixed_version,
        published_at: adv.published_at,
      });
      byKey.set(row.package_key, list);
    }
  }

  return withTarget.map((entry) => {
    const coverage = coverageFor(entry.target_kind, entry.target);
    const advisories = coverage === "covered" ? byKey.get(normalizeTargetKey(entry.target)) ?? [] : [];
    return { entry, coverage, advisories };
  });
}
