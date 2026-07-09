import "server-only";

/**
 * Turn a graded entry (entry + live grade detail) into the serializable view model
 * the dashboard's client components and the public page render. This is where the
 * grade detail becomes a compact check strip, the remediation fixes, and the
 * canonical report path — computed once, server-side, so nothing downstream needs
 * the DB or the grade loaders.
 */

import { decodeRef } from "@/lib/badgeData";
import { refToPath } from "@/lib/serverRef";
import { skillRefToPath } from "@/lib/skillGrades";
import { mcpFixItems, skillFixItems, type FixItem } from "@/lib/remediation";
import type { GradedEcosystemEntry } from "@/lib/ecosystemData";
import type { EcosystemEntryVM, EcosystemEntryCheck } from "@/lib/ecosystemTypes";

function reportPathFor(target: string | null, kind: string): string | null {
  if (!target) return null;
  if (kind === "skill") return `/skill/${skillRefToPath(target)}`;
  const key = decodeRef(target);
  return key ? `/mcp/${refToPath(key)}` : null;
}

export function buildEntryVM(g: GradedEcosystemEntry): EcosystemEntryVM {
  const { entry } = g;
  const name =
    entry.metadata.name ?? entry.metadata.project ?? entry.target ?? "—";

  let checks: EcosystemEntryCheck[] = [];
  let fixes: FixItem[] = [];

  if (g.mcpDetail) {
    const d = g.mcpDetail;
    checks = [
      { code: "C-01", status: d.c01 },
      { code: "C-02", status: d.c02 },
      { code: "C-03", status: d.c03 },
      { code: "C-04", status: d.c04 },
    ];
    fixes = mcpFixItems(d);
  } else if (g.skillDetail) {
    checks = g.skillDetail.categories.map((c) => ({ code: c.code, status: c.status }));
    fixes = skillFixItems(g.skillDetail);
  }

  return {
    id: entry.id,
    target: entry.target,
    targetKind: entry.target_kind,
    name,
    cohort: entry.cohort,
    visible: entry.visible,
    featured: entry.featured,
    grade: g.grade,
    checks,
    completedAt: g.completedAt,
    reportPath: reportPathFor(entry.target, entry.target_kind),
    fixes,
    gradeStatus: entry.last_grade_status,
  };
}

export function buildEntryVMs(list: GradedEcosystemEntry[]): EcosystemEntryVM[] {
  return list.map(buildEntryVM);
}
