import "server-only";

/**
 * Shared data layer for the (unlisted) skill-ecosystem indices — /uniswap, /clawhub,
 * /skills-sh. Generalizes what lib/bankrIndex does for one repo: each ecosystem
 * curates a list of skill members (SkillMeta) and this joins them to their LIVE
 * `litmus-skill-v2` grades from `hosted_runs`, so a page never hardcodes a letter and
 * always tracks the grader.
 *
 * Unlike the Bankr library (one repo, `github/BankrBot/skills#<slug>`), a marketplace's
 * skills can each live in their OWN GitHub repo. So membership is keyed on the explicit
 * canonical `target` per member (not a shared repo prefix): the join is one
 * `.in("target", …)` query, which works for a single-repo cohort and a many-repo
 * marketplace alike. Grades are read regardless of `published_at` (skill grades aren't
 * minted), newest complete run per target wins — the same grade-only read /bankr uses.
 */

import { getSupabaseAdmin } from "@/lib/supabase";

/** Static skill-safety grade (litmus-skill-v2): skills resolve to A/B/D/F (no C). */
export type SkillGrade = "A" | "B" | "D" | "F";

/** Curated metadata for one skill member. The grade is NOT stored here — it is read
 *  live from hosted_runs per request (see {@link loadSkillCohort}). */
export interface SkillMeta {
  /** Display name (the skill slug, or `<repo>` / `<repo>/<sub>` for a stand-alone repo). */
  name: string;
  /** Canonical hosted_runs target / `/skill` report ref
   *  (`github/<owner>/<repo>` or `github/<owner>/<repo>#<subpath>`). */
  target: string;
  /** Display cohort key (matched against the page's cohortOrder/cohortLabel). */
  cohort: string;
  /** Curation flag — surfaces a ★ next to the name. */
  featured?: boolean;
  /** Optional one-line editorial note (e.g. the known-bad-skill caveat). */
  note?: string;
}

/** A member joined to its LIVE litmus-skill-v2 grade (null until graded). */
export interface GradedSkill extends SkillMeta {
  grade: SkillGrade | null;
  s01: "pass" | "fail" | null;
  s03: "pass" | "fail" | null;
  s04: "pass" | "fail" | null;
  hash: string | null;
  /** When this skill was last graded (hosted_runs.completed_at, ISO); null until graded.
   *  Powers the "last refreshed" date on the /ecosystems hub. */
  completedAt: string | null;
}

type SkillLive = {
  grade: SkillGrade;
  s01: "pass" | "fail";
  s03: "pass" | "fail";
  s04: "pass" | "fail";
  hash: string;
  completedAt: string | null;
};

const SKILL_GRADES = new Set(["A", "B", "D", "F"]);

/**
 * One query → latest litmus-skill-v2 grade for each of `targets`, keyed by the
 * canonical ref the runner stores. Newest complete row per target wins; S-01/S-03/S-04
 * come from the evidence bundle (skill rows leave c01–c03 null). Mirrors bankrIndex's
 * fetchSkillGradeMap but bounded to an explicit target set rather than a repo prefix.
 */
async function fetchSkillGradeMap(
  db: ReturnType<typeof getSupabaseAdmin>,
  targets: string[],
): Promise<Map<string, SkillLive>> {
  const map = new Map<string, SkillLive>();
  if (!db || targets.length === 0) return map;
  const { data, error } = await db
    .from("hosted_runs")
    .select("target, grade, content_hash, evidence, completed_at")
    .eq("target_kind", "skill")
    .in("target", targets)
    .eq("status", "complete")
    .order("completed_at", { ascending: false });
  if (error || !data) return map;
  for (const row of data as Array<{
    target: string;
    grade: string | null;
    content_hash: string | null;
    evidence: { categories?: Array<{ code?: string; status?: string }> } | null;
    completed_at: string | null;
  }>) {
    if (map.has(row.target)) continue; // ordered desc → first (newest) wins
    if (!row.grade || !SKILL_GRADES.has(row.grade)) continue;
    const cats = row.evidence?.categories ?? [];
    const st = (code: string): "pass" | "fail" =>
      cats.find((c) => c.code === code)?.status === "fail" ? "fail" : "pass";
    map.set(row.target, {
      grade: row.grade as SkillGrade,
      s01: st("S-01"),
      s03: st("S-03"),
      s04: st("S-04"),
      hash: row.content_hash ? row.content_hash.slice(0, 12) : "",
      completedAt: row.completed_at ?? null,
    });
  }
  return map;
}

/** Join a curated member list to its LIVE grades. Ungraded members → grade null (the
 *  page renders them as a pending "—" row), so a page can ship before every member is
 *  graded — the same as /base's pending rows. */
export async function loadSkillCohort(metas: SkillMeta[]): Promise<GradedSkill[]> {
  const map = await fetchSkillGradeMap(
    getSupabaseAdmin(),
    metas.map((m) => m.target),
  );
  return metas.map((m) => {
    const g = map.get(m.target);
    return {
      ...m,
      grade: g?.grade ?? null,
      s01: g?.s01 ?? null,
      s03: g?.s03 ?? null,
      s04: g?.s04 ?? null,
      hash: g?.hash ?? null,
      completedAt: g?.completedAt ?? null,
    };
  });
}
