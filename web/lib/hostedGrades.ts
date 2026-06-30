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
  "target, target_kind, grade, rationale, evidence, tool_defs_fingerprint, content_hash, c01, c02, c03, resolved_version, published_at";

interface EvidenceFinding {
  kind?: string;
  severity?: string;
  match?: string;
  context?: string;
  tool?: string;
  file?: string;
  host?: string;
}
interface EvidenceProbe {
  id?: string;
  status?: string;
  findings?: EvidenceFinding[];
}
interface EvidenceCategory {
  code?: string;
  status?: string;
  reason?: string | null;
  probes?: EvidenceProbe[];
}
interface EvidenceBundle {
  toolDefsFingerprint?: string;
  categories?: EvidenceCategory[];
  methodologyVersion?: string;
  // The version the grade was run against (null for HTTP/unresolved targets).
  resolvedVersion?: string | null;
  // The grader writes the rationale into the bundle as `gradeRationale`;
  // the flat `rationale` column may or may not be populated, so we fall
  // back to this. (Confirmed against a live web3auth evidence bundle.)
  gradeRationale?: string;
}

export interface HostedGradeRow {
  target: string;
  target_kind: string;
  grade: string | null;
  rationale: string | null;
  evidence: EvidenceBundle | null;
  tool_defs_fingerprint: string | null;
  /** Whole-directory sha256 ("0x"+64hex) — skills only; null for servers. The
   *  skill attestation's trust anchor (twin of tool_defs_fingerprint). */
  content_hash: string | null;
  c01: string | null;
  c02: string | null;
  c03: string | null;
  resolved_version: string | null;
  published_at: string | null;
}

/** One flagged behavior from a probe (public evidence-bundle content). The
 *  twin of skillGrades' SkillFinding, but for the behavioral harness — so it
 *  also carries the offending `tool` and, for C-02 egress, the reached `host`. */
export interface McpFinding {
  kind: string | null;
  severity: string | null;
  match: string | null;
  /** Bounded context window around the match (C-01/C-04 text scans); the bundle
   *  already omits it for canary / internals-leak findings. */
  context: string | null;
  tool: string | null;
  file: string | null;
  host: string | null;
}

/** A category's verdict plus the findings behind it, flattened from the bundle's
 *  per-probe results. `status` is the RAW bundle status ("pass"|"fail"|"skipped"
 *  |"partial"), undecorated — unlike the c01..c04 display strings. */
export interface PolygraphCategory {
  code: string;
  status: string | null;
  reason: string | null;
  findings: McpFinding[];
}

export interface PolygraphDetail {
  grade: LitmusGrade;
  c01: string | null;
  c02: string | null;
  c03: string | null;
  /** C-04 adversarial-input handling — no flat column; read from the evidence bundle.
   *  Affects the letter grade like the others. */
  c04: string | null;
  tool_defs_fingerprint: string | null;
  methodology_version: string;
  /** The version the grade was run against; null for HTTP/unresolved targets. */
  resolved_version: string | null;
  rationale: string | null;
  evidence_url: string | null;
  computed_at: string | null;
  /** Per-category verdicts + findings from the evidence bundle, for the
   *  remediation page. Empty when the row carries no (or a legacy, probe-less)
   *  bundle — the report page reads the c01..c04 strings instead, so this is
   *  purely additive. */
  categories: PolygraphCategory[];
}

const GRADES = new Set(["A", "B", "C", "D", "F"]);

function categoryStatus(bundle: EvidenceBundle | null, code: string): string | null {
  const c = bundle?.categories?.find((x) => x.code === code);
  if (!c || !c.status) return null;
  if (c.status === "skipped" && c.reason) return `skipped — ${c.reason}`;
  return c.status;
}

function normalizeFinding(f: EvidenceFinding): McpFinding {
  return {
    kind: f.kind ?? null,
    severity: f.severity ?? null,
    match: f.match ?? null,
    context: f.context ?? null,
    tool: f.tool ?? null,
    file: f.file ?? null,
    host: f.host ?? null,
  };
}

/** Flatten the bundle's category → probe → finding tree into per-category
 *  verdicts + findings for the remediation page. Empty for a null/legacy bundle. */
function categoriesFromBundle(bundle: EvidenceBundle | null): PolygraphCategory[] {
  return (bundle?.categories ?? [])
    .filter((c) => c.code)
    .map((c) => ({
      code: c.code as string,
      status: c.status ?? null,
      reason: c.reason ?? null,
      findings: (c.probes ?? []).flatMap((p) => (p.findings ?? []).map(normalizeFinding)),
    }));
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
      // No flat column for C-04 — read from the evidence bundle.
      c04: categoryStatus(bundle, "C-04"),
      tool_defs_fingerprint:
        bundle?.toolDefsFingerprint ?? row.tool_defs_fingerprint ?? null,
      methodology_version: bundle?.methodologyVersion ?? "litmus",
      // Prefer the first-class column (migration 0002); fall back to the bundle
      // for rows graded before it was populated.
      resolved_version: row.resolved_version ?? bundle?.resolvedVersion ?? null,
      rationale: row.rationale ?? bundle?.gradeRationale ?? null,
      evidence_url: null,
      computed_at: row.published_at ?? null,
      categories: categoriesFromBundle(bundle),
    },
  };
}

/**
 * Latest published registry grade for a versionless server_key. With `version`,
 * only a grade run against that EXACT version matches (a different version → null,
 * i.e. "not graded for this version"); without it, the latest published grade for
 * any version. Version is matched on the first-class `resolved_version` column
 * (migration 0002), which is indexed and decoupled from the evidence-bundle shape
 * — replacing the prior `evidence->>resolvedVersion` JSONB probe.
 */
export async function fetchPublishedGrade(
  db: SupabaseClient,
  serverKey: string,
  version?: string | null,
): Promise<{ grade: LitmusGrade; detail: PolygraphDetail } | null> {
  let query = db
    .from("hosted_runs")
    .select(HOSTED_GRADE_COLUMNS)
    .eq("target", serverKey)
    .eq("target_kind", "registry_ref")
    .eq("status", "complete")
    .not("published_at", "is", null);
  if (version) query = query.eq("resolved_version", version);
  const { data, error } = await query
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

/**
 * Latest PUBLISHED grade for a remote https MCP endpoint (`target_kind='remote_url'`),
 * matched on the stored target URL. The graded URL may have been stored with or
 * without a trailing slash, so we match both forms. Remote endpoints are mutable
 * and unversioned — there is no `resolved_version` to pin.
 */
export async function fetchPublishedGradeRemote(
  db: SupabaseClient,
  urlKey: string,
): Promise<{ grade: LitmusGrade; detail: PolygraphDetail } | null> {
  const bare = urlKey.replace(/\/+$/, "");
  const variants = Array.from(new Set([bare, `${bare}/`]));
  const { data, error } = await db
    .from("hosted_runs")
    .select(HOSTED_GRADE_COLUMNS)
    .in("target", variants)
    .eq("target_kind", "remote_url")
    .eq("status", "complete")
    .not("published_at", "is", null)
    .order("published_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (error) {
    console.warn("[hostedGrades] remote grade lookup soft-failed:", error.message);
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
