/**
 * Read + path helpers for the per-skill grade report (`/skill/<…>`), the static
 * counterpart to lib/hostedGrades + lib/badgeData for MCP servers. A skill is
 * graded by the static skill litmus (litmus-skill-v2): a deterministic scan of
 * its SKILL.md + bundle across S-01 (prompt-injection / context-poisoning),
 * S-03 (data-exfiltration instructions), and S-04 (dangerous bundled commands).
 *
 * Grades live in `hosted_runs` (target_kind='skill'), keyed by the canonical
 * `github/<owner>/<repo>#<subpath>` ref the runner stores. Like /base and /bankr,
 * the page reads grade-only rows directly — skill grades aren't published onchain,
 * so there is no `published_at` to gate on; the newest complete run wins.
 *
 * No `server-only` import on purpose: the loader takes the db as a parameter (the
 * page passes getSupabaseAdmin()), so the pure helpers stay unit-testable — same
 * shape as lib/rankings.
 */

import type { SupabaseClient } from "@supabase/supabase-js";

/** Static skill-safety grade. Skills resolve to A/B/D/F (no C — that band is unused). */
export type SkillLitmusGrade = "A" | "B" | "D" | "F";

export type SkillCategoryCode = "S-01" | "S-03" | "S-04";

/** The three skill checks, in display order, with their human labels. */
export const SKILL_CATEGORIES: Array<{ code: SkillCategoryCode; name: string }> = [
  { code: "S-01", name: "Prompt-injection / context-poisoning" },
  { code: "S-03", name: "Data-exfiltration instructions" },
  { code: "S-04", name: "Dangerous bundled commands" },
];

const SKILL_GRADES = new Set<string>(["A", "B", "D", "F"]);

/** One flagged location from the static scan (a matched pattern in the skill text/bundle). */
export interface SkillFinding {
  kind: string | null;
  severity: string | null;
  /** The matched snippet (public skill content). */
  match: string | null;
  /** Surrounding text, when the scan captured a context window. */
  context: string | null;
  /** The bundled file the finding came from, for S-04 (e.g. `scripts/setup.sh`). */
  file: string | null;
}

export interface SkillCategory {
  code: SkillCategoryCode;
  /** "pass" | "fail" | null (null = the bundle didn't record this check). */
  status: string | null;
  reason: string | null;
  findings: SkillFinding[];
}

export interface SkillDetail {
  grade: SkillLitmusGrade;
  categories: SkillCategory[];
  content_hash: string | null;
  methodology_version: string;
  computed_at: string | null;
  /** The github commit this grade was run against, and when it landed — the
   *  path-scoped commit stream the monitor watches. Null for grades run before
   *  the commit anchor landed (until backfilled). */
  commit_sha: string | null;
  commit_at: string | null;
}

interface EvidenceFinding {
  kind?: string;
  severity?: string;
  match?: string;
  context?: string;
  file?: string;
}
interface EvidenceCategory {
  code?: string;
  status?: string;
  reason?: string | null;
  findings?: EvidenceFinding[];
}
interface SkillEvidenceBundle {
  methodologyVersion?: string;
  categories?: EvidenceCategory[];
}

export interface SkillGradeRow {
  target: string;
  grade: string | null;
  content_hash: string | null;
  evidence: SkillEvidenceBundle | null;
  completed_at: string | null;
  commit_sha: string | null;
  commit_at: string | null;
}

/** The hosted_runs columns a skill report needs. */
export const SKILL_GRADE_COLUMNS = "target, grade, content_hash, evidence, completed_at, commit_sha, commit_at";

/**
 * Canonical skill target → URL-path-safe form for `/skill/<…>`. The `#` subpath
 * separator (`github/owner/repo#sub`) can't survive a path, so it becomes a `/`
 * segment; {@link decodeSkillRef} reverses it. A repo-level ref passes through.
 */
export function skillRefToPath(target: string): string {
  return target.replace("#", "/");
}

/**
 * Reverse of {@link skillRefToPath}: a `/skill/<…>` catch-all path → canonical
 * `github/owner/repo#subpath` target, or null if unparseable. A literal `#`
 * (already canonical) is accepted as-is. The first three segments are the github
 * repo; anything after is the skill subpath, rejoined under `#`.
 */
export function decodeSkillRef(raw: string | null | undefined): string | null {
  if (!raw) return null;
  const trimmed = raw.replace(/\/+$/, "");
  if (trimmed.length === 0 || trimmed.length > 512) return null;
  if (trimmed.includes("#")) return trimmed; // already canonical
  const segs = trimmed.split("/").filter(Boolean);
  if (segs[0] !== "github" || segs.length < 3) return null;
  if (segs.length === 3) return segs.join("/"); // repo-level skill (no subpath)
  return `${segs[0]}/${segs[1]}/${segs[2]}#${segs.slice(3).join("/")}`;
}

/** Canonical skill ref → its GitHub source URL, or null for a non-github ref. */
export function githubUrlForSkillRef(target: string): string | null {
  if (!target.startsWith("github/")) return null;
  const [base, subpath] = target.split("#");
  const segs = base.split("/").filter(Boolean); // [github, owner, repo]
  if (segs.length < 3) return null;
  const [, owner, repo] = segs;
  const url = `https://github.com/${owner}/${repo}`;
  return subpath ? `${url}/tree/main/${subpath}` : url;
}

/** Human display name for a skill ref — the subpath, else the repo name. */
export function skillDisplayName(target: string): string {
  const hashIdx = target.indexOf("#");
  if (hashIdx >= 0) return target.slice(hashIdx + 1);
  const segs = target.split("/").filter(Boolean);
  return segs[segs.length - 1] ?? target;
}

function normalizeFinding(f: EvidenceFinding): SkillFinding {
  return {
    kind: f.kind ?? null,
    severity: f.severity ?? null,
    match: f.match ?? null,
    context: f.context ?? null,
    file: f.file ?? null,
  };
}

/**
 * Build the grade + detail from a hosted_runs skill row. Always returns the three
 * canonical categories in order (a check the bundle omitted gets a null status),
 * so the report renders a stable breakdown. Null when the row has no valid skill grade.
 */
export function detailFromSkillRow(row: SkillGradeRow): { grade: SkillLitmusGrade; detail: SkillDetail } | null {
  const g = row.grade;
  if (!g || !SKILL_GRADES.has(g)) return null;
  const grade = g as SkillLitmusGrade;
  const bundle = row.evidence ?? null;
  const byCode = new Map<string, EvidenceCategory>();
  for (const c of bundle?.categories ?? []) {
    if (c.code) byCode.set(c.code, c);
  }
  const categories: SkillCategory[] = SKILL_CATEGORIES.map(({ code }) => {
    const c = byCode.get(code);
    return {
      code,
      status: c?.status ?? null,
      reason: c?.reason ?? null,
      findings: (c?.findings ?? []).map(normalizeFinding),
    };
  });
  return {
    grade,
    detail: {
      grade,
      categories,
      content_hash: row.content_hash ?? null,
      methodology_version: bundle?.methodologyVersion ?? "litmus-skill",
      computed_at: row.completed_at ?? null,
      commit_sha: row.commit_sha ?? null,
      commit_at: row.commit_at ?? null,
    },
  };
}

/** One published skill, flattened for the Skills tab of the grades index. */
export interface SkillIndexRow {
  /** Canonical `github/<owner>/<repo>#<subpath>` ref. */
  ref: string;
  /** Human display name (the subpath, else the repo). */
  displayName: string;
  /** URL-path-safe form for `/skill/<path>`. */
  path: string;
  grade: SkillLitmusGrade;
  s01: string | null;
  s03: string | null;
  s04: string | null;
}

/**
 * Every published skill grade as an index row, newest-published first, one row
 * per skill (newest published run wins). Gated on `published_at` so the Skills
 * tab shows the same intentionally-published set the homepage Checks section did
 * — not every internal run. Empty when Supabase is unconfigured.
 */
export async function fetchPublishedSkillGrades(
  db: SupabaseClient | null,
): Promise<SkillIndexRow[]> {
  if (!db) return [];
  const { data, error } = await db
    .from("hosted_runs")
    .select(SKILL_GRADE_COLUMNS)
    .eq("target_kind", "skill")
    .eq("status", "complete")
    .not("published_at", "is", null)
    .order("published_at", { ascending: false });
  if (error) {
    console.warn("[skillGrades] published skills read soft-failed:", error.message);
    return [];
  }
  const rows = (data ?? []) as SkillGradeRow[];
  const seen = new Set<string>();
  const out: SkillIndexRow[] = [];
  for (const row of rows) {
    if (seen.has(row.target)) continue; // newest published per skill wins
    const detail = detailFromSkillRow(row);
    if (!detail) continue;
    seen.add(row.target);
    const status = new Map(detail.detail.categories.map((c) => [c.code, c.status]));
    out.push({
      ref: row.target,
      displayName: skillDisplayName(row.target),
      path: skillRefToPath(row.target),
      grade: detail.grade,
      s01: status.get("S-01") ?? null,
      s03: status.get("S-03") ?? null,
      s04: status.get("S-04") ?? null,
    });
  }
  return out;
}

/**
 * Latest complete skill grade for a canonical target, or null. Reads grade-only
 * rows (no `published_at` gate — skill grades aren't minted), newest run first.
 * Null when Supabase is unconfigured, so the page degrades to its ungraded state.
 */
export async function loadSkillGrade(
  db: SupabaseClient | null,
  target: string,
): Promise<{ grade: SkillLitmusGrade; detail: SkillDetail } | null> {
  if (!db) return null;
  const { data, error } = await db
    .from("hosted_runs")
    .select(SKILL_GRADE_COLUMNS)
    .eq("target", target)
    .eq("target_kind", "skill")
    .eq("status", "complete")
    .order("completed_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (error) {
    console.warn("[skillGrades] skill grade lookup soft-failed:", error.message);
    return null;
  }
  if (!data) return null;
  return detailFromSkillRow(data as SkillGradeRow);
}
