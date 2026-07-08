/**
 * GET /api/skills/search?q= — typeahead over GRADED skills.
 *
 * Skills aren't in the discovery catalog (that's MCP servers), so this searches
 * `hosted_runs` (target_kind='skill') directly and returns matches in the same
 * shape as /api/catalog/search, so the add-a-monitor combobox can reuse it.
 * Read-only; service-role, never exposed to the client.
 */

import { NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabase";
import { likePattern } from "@/lib/catalogSearch";
import { skillDisplayName } from "@/lib/skillGrades";

export const runtime = "nodejs";

const CANDIDATE_LIMIT = 60; // over-fetch before dedupe/cap
const RESULT_CAP = 8;

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const q = (searchParams.get("q") ?? "").trim();
  if (q.length < 2) return NextResponse.json({ results: [] });

  const db = getSupabaseAdmin();
  if (!db) return NextResponse.json({ results: [] });

  // Skills aren't published-gated (the newest complete run is the live grade), so
  // match on target and keep the newest complete run per target.
  const { data } = await db
    .from("hosted_runs")
    .select("target, grade")
    .eq("target_kind", "skill")
    .eq("status", "complete")
    .ilike("target", likePattern(q))
    .order("completed_at", { ascending: false })
    .limit(CANDIDATE_LIMIT);

  const rows = (data ?? []) as { target: string; grade: string | null }[];
  const seen = new Set<string>();
  const results: Array<{
    target: string;
    name: string | null;
    kind: string;
    gradeable: boolean;
    graded: boolean;
    grade: string | null;
  }> = [];
  for (const r of rows) {
    if (seen.has(r.target)) continue; // first row per target = newest complete
    seen.add(r.target);
    results.push({
      target: r.target,
      name: skillDisplayName(r.target),
      kind: "skill",
      gradeable: true,
      graded: r.grade != null,
      grade: r.grade,
    });
    if (results.length >= RESULT_CAP) break;
  }

  return NextResponse.json({ results });
}
