/**
 * POST /api/manage/[slug]/entries/[id]/regrade — re-fire the hosted grade for an
 * entry (e.g. after the author pushed a fix). Reuses the same immediate-grade path
 * as adding, and is subject to the same per-ecosystem daily budget.
 */

import { guardManage, gradeBudgetExceeded, fireGradeForEntry } from "@/lib/manageApi";
import { getSupabaseAdmin } from "@/lib/supabase";
import type { EcosystemEntryRow } from "@/lib/ecosystemTypes";

export async function POST(
  _request: Request,
  { params }: { params: Promise<{ slug: string; id: string }> },
) {
  const { slug, id } = await params;
  const guard = await guardManage(slug);
  if (guard instanceof Response) return guard;
  const { access } = guard;

  const db = getSupabaseAdmin();
  if (!db) return Response.json({ error: "Database not configured" }, { status: 503 });

  const { data } = await db
    .from("ecosystem_entries")
    .select("id, target, target_kind")
    .eq("id", id)
    .eq("ecosystem_id", access.ecosystem.id)
    .maybeSingle();
  if (!data) return Response.json({ error: "Not found" }, { status: 404 });

  const entry = data as Pick<EcosystemEntryRow, "id" | "target" | "target_kind">;
  if (!entry.target) return Response.json({ error: "This entry has no gradeable target." }, { status: 400 });

  if (await gradeBudgetExceeded(access.ecosystem.id)) {
    return Response.json(
      { error: "Daily grading limit reached for this ecosystem. Try again tomorrow." },
      { status: 429 },
    );
  }

  const grade = await fireGradeForEntry(entry);
  return Response.json({ ok: true, grade });
}
