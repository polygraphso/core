/**
 * Published grades for the CLI/lookup, read from `hosted_runs` — the SAME
 * source the website's §03 / hero card read. This is what keeps the CLI
 * in sync with the site: there is no separate grade store. (The old
 * `behavioral_grades` table is unused — the grader writes hosted_runs.)
 *
 * A grade is "published" when status='complete' and published_at is set.
 * Per-check detail, fingerprint, and methodology version come from the
 * evidence bundle (the website's source of truth), with the flat columns
 * as fallback.
 */

import type { SupabaseClient } from "@supabase/supabase-js";

export type LitmusGrade = "A" | "B" | "C" | "D" | "F";

// Mirrors the website's ChecksSoFar select (plus published_at for dating).
export const HOSTED_GRADE_COLUMNS =
  "target, target_kind, grade, rationale, evidence, tool_defs_fingerprint, c01, c02, c03, published_at";

interface EvidenceCategory {
  code?: string;
  status?: string;
  reason?: string | null;
}
interface EvidenceBundle {
  toolDefsFingerprint?: string;
  categories?: EvidenceCategory[];
  methodologyVersion?: string;
}

export interface HostedGradeRow {
  target: string;
  target_kind: string;
  grade: string | null;
  rationale: string | null;
  evidence: EvidenceBundle | null;
  tool_defs_fingerprint: string | null;
  c01: string | null;
  c02: string | null;
  c03: string | null;
  published_at: string | null;
}

export interface PolygraphDetail {
  grade: LitmusGrade;
  c01: string | null;
  c02: string | null;
  c03: string | null;
  tool_defs_fingerprint: string | null;
  methodology_version: string;
  rationale: string | null;
  evidence_url: string | null;
  computed_at: string | null;
}

const GRADES = new Set(["A", "B", "C", "D", "F"]);

function categoryStatus(bundle: EvidenceBundle | null, code: string): string | null {
  const c = bundle?.categories?.find((x) => x.code === code);
  if (!c || !c.status) return null;
  if (c.status === "skipped" && c.reason) return `skipped — ${c.reason}`;
  return c.status;
}

/** Build the CLI grade + detail from a hosted_runs row. Prefers the
 *  evidence bundle, falls back to flat columns. Null if no valid grade. */
export function detailFromRow(
  row: HostedGradeRow,
): { grade: LitmusGrade; detail: PolygraphDetail } | null {
  const g = row.grade;
  if (!g || !GRADES.has(g)) return null;
  const grade = g as LitmusGrade;
  const bundle = row.evidence ?? null;
  return {
    grade,
    detail: {
      grade,
      c01: categoryStatus(bundle, "C-01") ?? row.c01 ?? null,
      c02: categoryStatus(bundle, "C-02") ?? row.c02 ?? null,
      c03: categoryStatus(bundle, "C-03") ?? row.c03 ?? null,
      tool_defs_fingerprint:
        bundle?.toolDefsFingerprint ?? row.tool_defs_fingerprint ?? null,
      methodology_version: bundle?.methodologyVersion ?? "litmus",
      rationale: row.rationale ?? null,
      evidence_url: null,
      computed_at: row.published_at ?? null,
    },
  };
}

/** Latest published registry grade for a versionless server_key. */
export async function fetchPublishedGrade(
  db: SupabaseClient,
  serverKey: string,
): Promise<{ grade: LitmusGrade; detail: PolygraphDetail } | null> {
  const { data, error } = await db
    .from("hosted_runs")
    .select(HOSTED_GRADE_COLUMNS)
    .eq("target", serverKey)
    .eq("target_kind", "registry_ref")
    .eq("status", "complete")
    .not("published_at", "is", null)
    .order("published_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (error) {
    console.warn("[hostedGrades] grade lookup soft-failed:", error.message);
    return null;
  }
  if (!data) return null;
  return detailFromRow(data as HostedGradeRow);
}

/** All published registry grades, keyed by target (versionless server_key),
 *  for the list endpoint's in-memory join. */
export async function fetchPublishedGradeMap(
  db: SupabaseClient,
): Promise<Map<string, LitmusGrade>> {
  const map = new Map<string, LitmusGrade>();
  const { data, error } = await db
    .from("hosted_runs")
    .select("target, grade, published_at")
    .eq("target_kind", "registry_ref")
    .eq("status", "complete")
    .not("published_at", "is", null)
    .order("published_at", { ascending: false });
  if (error) {
    console.warn("[hostedGrades] grade map soft-failed:", error.message);
    return map;
  }
  for (const row of (data ?? []) as Array<{ target: string; grade: string | null }>) {
    // First (most recent) wins — the query is ordered published_at desc.
    if (map.has(row.target)) continue;
    if (row.grade && GRADES.has(row.grade)) {
      map.set(row.target, row.grade as LitmusGrade);
    }
  }
  return map;
}
