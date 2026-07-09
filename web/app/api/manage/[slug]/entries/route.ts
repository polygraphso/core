/**
 * POST /api/manage/[slug]/entries — add an MCP server or skill to an ecosystem
 * and grade it immediately.
 *
 * Body: { target: string, kind: "mcp" | "skill", cohort?: string }
 *
 * Any member (not just admins) may add. The target is canonicalized + validated
 * (parseEcosystemTarget), inserted, then fired at the hosted runner right away —
 * the grade lands in hosted_runs and the dashboard polls .../entries/[id]/status
 * until it appears. Duplicates (same target in this ecosystem) 409. A per-ecosystem
 * daily cap protects the runner's grade budget.
 */

import { guardManage, gradeBudgetExceeded, fireGradeForEntry } from "@/lib/manageApi";
import { getSupabaseAdmin } from "@/lib/supabase";
import { parseEcosystemTarget, type EcosystemTargetKindInput } from "@/lib/ecosystemTarget";
import type { EcosystemEntryRow } from "@/lib/ecosystemTypes";

const ENTRY_COLUMNS =
  "id, ecosystem_id, target, target_kind, cohort, visible, featured, position, metadata, last_grade_run_id, last_grade_status, added_by, added_at";

export async function POST(request: Request, { params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const guard = await guardManage(slug);
  if (guard instanceof Response) return guard;
  const { session, access } = guard;

  let body: { target?: unknown; kind?: unknown; cohort?: unknown };
  try {
    body = (await request.json()) as typeof body;
  } catch {
    return Response.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const kind = body.kind === "skill" ? "skill" : "mcp";
  const parsed = parseEcosystemTarget(
    typeof body.target === "string" ? body.target : "",
    kind as EcosystemTargetKindInput,
  );
  if ("error" in parsed) return Response.json({ error: parsed.error }, { status: 400 });

  const cohort =
    typeof body.cohort === "string" && body.cohort.trim().length > 0
      ? body.cohort.trim().slice(0, 120)
      : null;

  const db = getSupabaseAdmin();
  if (!db) return Response.json({ error: "Database not configured" }, { status: 503 });

  if (await gradeBudgetExceeded(access.ecosystem.id)) {
    return Response.json(
      { error: "Daily grading limit reached for this ecosystem. Try again tomorrow." },
      { status: 429 },
    );
  }

  const { data, error } = await db
    .from("ecosystem_entries")
    .insert({
      ecosystem_id: access.ecosystem.id,
      target: parsed.target,
      target_kind: parsed.targetKind,
      cohort,
      metadata: { name: parsed.displayName },
      added_by: session.userId,
    })
    .select(ENTRY_COLUMNS)
    .single();

  if (error) {
    // 23505 = unique_violation (this target is already tracked here).
    if ((error as { code?: string }).code === "23505") {
      return Response.json({ error: "That target is already in this ecosystem." }, { status: 409 });
    }
    console.error("[manage/entries] insert failed:", error.message);
    return Response.json({ error: "Couldn't add the entry." }, { status: 500 });
  }

  const entry = data as EcosystemEntryRow;
  const grade = await fireGradeForEntry(entry);
  return Response.json({ ok: true, entry, grade }, { status: 201 });
}
