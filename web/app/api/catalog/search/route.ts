/**
 * GET /api/catalog/search?q=&kind=&gradeableOnly= — typeahead over the
 * discovery catalog.
 *
 * Returns runnable MCP candidates from `catalog_servers` (those resolved to a
 * grading target), each marked with whether we've already graded it and, if so,
 * its letter grade. Powers the search/create combobox on the request-a-grade
 * and add-a-monitor forms. Read-only; service-role, never exposed to the client.
 *
 *   kind          — optional comma list of grading kinds to keep (npm|pypi|url)
 *   gradeableOnly — "1"/"true" restricts to resolved (gradeable) rows
 */

import { NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabase";
import { likePattern, toResults, type CatalogRow } from "@/lib/catalogSearch";

export const runtime = "nodejs";

const CANDIDATE_LIMIT = 40; // over-fetch before dedupe/cap
const RESULT_CAP = 8;
const ALLOWED_KINDS = new Set(["npm", "pypi", "url"]);

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const q = (searchParams.get("q") ?? "").trim();
  if (q.length < 2) return NextResponse.json({ results: [] });

  const kinds = (searchParams.get("kind") ?? "")
    .split(",")
    .map((k) => k.trim())
    .filter((k) => ALLOWED_KINDS.has(k));
  const gradeableOnly = /^(1|true)$/i.test(searchParams.get("gradeableOnly") ?? "");

  const db = getSupabaseAdmin();
  if (!db) return NextResponse.json({ results: [] });

  const like = likePattern(q);
  let query = db
    .from("catalog_servers")
    .select("name, repository_url, grading_target, grading_kind, gradeable")
    .or(`name.ilike.${like},repository_url.ilike.${like},grading_target.ilike.${like}`)
    .order("gradeable", { ascending: false, nullsFirst: false })
    .order("last_seen_at", { ascending: false })
    .limit(CANDIDATE_LIMIT);
  if (gradeableOnly) query = query.eq("gradeable", true);
  if (kinds.length > 0) query = query.in("grading_kind", kinds);

  const { data } = await query;
  const rows = (data ?? []) as CatalogRow[];

  // Coverage: which of these targets already have a published grade, and what.
  const targets = [...new Set(rows.map((r) => r.grading_target).filter((t): t is string => !!t))];
  const grades = new Map<string, string | null>();
  if (targets.length > 0) {
    const { data: runs } = await db
      .from("hosted_runs")
      .select("target, grade")
      .eq("status", "complete")
      .not("published_at", "is", null)
      .in("target", targets)
      .order("published_at", { ascending: false });
    for (const run of (runs ?? []) as { target: string; grade: string | null }[]) {
      if (!grades.has(run.target)) grades.set(run.target, run.grade); // first = latest
    }
  }

  return NextResponse.json({ results: toResults(rows, grades).slice(0, RESULT_CAP) });
}
