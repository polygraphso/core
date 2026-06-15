/**
 * GET /api/cli/list — graded-server discovery.
 *
 * Anonymous; service-role DB access on the server side only. Returns every
 * server with a published polygraph grade (hosted_runs, status='complete',
 * published_at set) — the same source the website reads. Sorted by grade
 * (A first), then by server_ref.
 *
 * Grade-only: this is the published-grades list, not a catalog of tracked
 * servers. Adoption tier is no longer part of this surface.
 */

import { getSupabaseAdmin } from "@/lib/supabase";
import { fetchPublishedGradeMap, type LitmusGrade } from "@/lib/hostedGrades";

interface ListEntry {
  server_ref: string;
  polygraph: LitmusGrade;
}

interface ListResponse {
  servers: ListEntry[];
  total: number;
}

const GRADE_RANK: Record<LitmusGrade, number> = {
  A: 0,
  B: 1,
  C: 2,
  D: 3,
  F: 4,
};

export async function GET() {
  const supabase = getSupabaseAdmin();
  if (!supabase) {
    console.error("[cli/list] Supabase is not configured");
    return Response.json({ error: "Lookup failed." }, { status: 500 });
  }

  // Every published grade, keyed by server_ref (the versionless target).
  const gradeByRef = await fetchPublishedGradeMap(supabase);

  const entries: ListEntry[] = [...gradeByRef.entries()].map(
    ([server_ref, polygraph]) => ({ server_ref, polygraph }),
  );

  entries.sort((a, b) => {
    const r = GRADE_RANK[a.polygraph] - GRADE_RANK[b.polygraph];
    if (r !== 0) return r;
    return a.server_ref.localeCompare(b.server_ref);
  });

  const body: ListResponse = { servers: entries, total: entries.length };
  return Response.json(body);
}
