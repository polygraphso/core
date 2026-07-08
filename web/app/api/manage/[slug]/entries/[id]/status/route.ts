/**
 * GET /api/manage/[slug]/entries/[id]/status — poll a freshly added/regraded
 * entry's grade job. Returns the runner's job status; once it completes, the grade
 * is in hosted_runs and the dashboard's live join renders it. Records the latest
 * status on the row so a reload reflects it.
 */

import { guardManage } from "@/lib/manageApi";
import { getSupabaseAdmin } from "@/lib/supabase";
import { hostedRunnerConfig, getGradeStatus } from "@/lib/hostedRunner";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ slug: string; id: string }> },
) {
  const { slug, id } = await params;
  const guard = await guardManage(slug);
  if (guard instanceof Response) return guard;
  const { access } = guard;

  const db = getSupabaseAdmin();
  if (!db) return Response.json({ error: "Database not configured" }, { status: 503 });

  const { data: entry } = await db
    .from("ecosystem_entries")
    .select("id, last_grade_run_id")
    .eq("id", id)
    .eq("ecosystem_id", access.ecosystem.id)
    .maybeSingle();
  if (!entry) return Response.json({ error: "Not found" }, { status: 404 });

  const runId = (entry as { last_grade_run_id: string | null }).last_grade_run_id;
  if (!runId) return Response.json({ jobId: null, status: null });

  const cfg = hostedRunnerConfig();
  if (!cfg) return Response.json({ jobId: runId, status: "runner-unconfigured" });

  try {
    const { data } = await getGradeStatus(cfg, runId);
    const status = (data as { status?: string } | null)?.status ?? null;
    if (status) {
      await db.from("ecosystem_entries").update({ last_grade_status: status }).eq("id", id);
    }
    return Response.json({ jobId: runId, status, runner: data });
  } catch (e) {
    return Response.json(
      { jobId: runId, status: "error", error: e instanceof Error ? e.message : String(e) },
      { status: 502 },
    );
  }
}
