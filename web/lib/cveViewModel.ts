import "server-only";

/**
 * Turn the joined entry-advisory rows into the serializable CVE groups the
 * CvesManager client component renders — one group per tracked entry, advisories
 * sorted high→low, groups ordered affected-first. Computed server-side so the
 * client needs no DB access, mirroring ecosystemViewModel.
 */

import type { EntryAdvisories, JoinedAdvisory } from "@/lib/cveData";
import {
  SEVERITY_RANK,
  type AdvisoryVM,
  type CveSeverity,
  type EcosystemCveGroupVM,
} from "@/lib/cveTypes";

function rank(sev: CveSeverity | null): number {
  return sev ? SEVERITY_RANK[sev] : 0;
}

function topSeverity(list: JoinedAdvisory[]): CveSeverity | null {
  let top: CveSeverity | null = null;
  for (const a of list) {
    if (a.severity && rank(a.severity) > rank(top)) top = a.severity;
  }
  return top;
}

export function buildCveGroups(list: EntryAdvisories[]): EcosystemCveGroupVM[] {
  const groups: EcosystemCveGroupVM[] = list.map((ea) => {
    const advisories: AdvisoryVM[] = ea.advisories
      .map((a) => ({
        ghsaId: a.ghsa_id,
        cveIds: a.cve_ids,
        severity: a.severity,
        cvss: a.cvss,
        summary: a.summary,
        url: a.url,
        affectedRange: a.affected_range,
        fixedVersion: a.fixed_version,
        publishedAt: a.published_at,
      }))
      .sort((x, y) => rank(y.severity) - rank(x.severity));
    return {
      entryId: ea.entry.id,
      name: ea.entry.metadata.name ?? ea.entry.metadata.project ?? ea.entry.target ?? "—",
      target: ea.entry.target,
      targetKind: ea.entry.target_kind,
      coverage: ea.coverage,
      topSeverity: topSeverity(ea.advisories),
      advisories,
    };
  });

  // Affected entries first (by top severity), then covered-clean, then not-covered.
  const weight = (g: EcosystemCveGroupVM): number =>
    g.advisories.length ? 10 + rank(g.topSeverity) : g.coverage === "covered" ? 1 : 0;
  return groups.sort((a, b) => weight(b) - weight(a) || a.name.localeCompare(b.name));
}
