/**
 * POST /api/admin/rescore — trigger a full scoring run.
 *
 * Flow:
 *   1. Verify admin session.
 *   2. Bail if a scoring run is already in flight (queued/running) — the
 *      orchestrator isn't reentrant against the seed.
 *   3. Insert a runs row up-front with status='running', return 202 + run_id.
 *   4. Use `after()` to invoke scoreAllTrackedServers(supabase, { runId }).
 *      The orchestrator finalizes the row to completed/failed.
 *
 * The actual scoring takes ~5–10 minutes. `after()` runs until the route's
 * maxDuration. On Vercel free-tier (10s) this WILL be killed — orphan rows
 * stay at 'running'. Self-hosted (no timeout) works as expected.
 *
 * Improvement path if traffic patterns demand: move the orchestrator to a
 * separate worker (the existing scoring-package poll cron is the natural
 * place) and have this endpoint enqueue rather than execute.
 */

import { after, NextResponse } from "next/server";
import { hasValidAdminSession } from "@/lib/admin-auth";
import { getSupabase } from "@/lib/supabase-server";
import {
  finishOrchestratorRun,
  scoreAllTrackedServers,
  startOrchestratorRun,
} from "@polygraph/scoring";

export const dynamic = "force-dynamic";
// Best-effort: allow up to 15 minutes on platforms that honour this.
// (Vercel: hobby caps at 10s, Pro at 60s; self-hosted: uncapped.)
export const maxDuration = 900;

export async function POST() {
  if (!(await hasValidAdminSession())) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const supabase = getSupabase();

  // Guard against double-trigger. Cheap — kind+nullable version_id+status
  // is covered by runs_active_idx and runs_latest_orchestrator_idx.
  const { data: active, error: activeErr } = await supabase
    .from("runs")
    .select("id, status, started_at")
    .is("version_id", null)
    .eq("kind", "scoring")
    .in("status", ["queued", "running"])
    .limit(1);
  if (activeErr) {
    console.error("[admin/rescore] active-run check failed:", activeErr.message);
    return NextResponse.json(
      { error: "lookup failed", detail: activeErr.message },
      { status: 500 },
    );
  }
  if (active && active.length > 0) {
    return NextResponse.json(
      {
        error: "already_running",
        run_id: active[0].id,
        started_at: active[0].started_at,
      },
      { status: 409 },
    );
  }

  // Pre-create the runs row so the response carries a real id the
  // dashboard can poll on.
  let run_id: string;
  try {
    ({ run_id } = await startOrchestratorRun(supabase, "scoring"));
  } catch (err) {
    console.error(
      "[admin/rescore] startOrchestratorRun failed:",
      err instanceof Error ? err.message : String(err),
    );
    return NextResponse.json(
      { error: "could not start run" },
      { status: 500 },
    );
  }

  after(async () => {
    console.log(`[admin/rescore] orchestrator starting for run ${run_id}`);
    try {
      const result = await scoreAllTrackedServers(supabase, { runId: run_id });
      console.log(
        `[admin/rescore] run ${run_id} completed: rows_written=${result.rows_written}, skipped=${result.skipped.length}`,
      );
    } catch (err) {
      // scoreAllTrackedServers already finalizes the row to 'failed' before
      // re-throwing — just log here.
      console.error(
        `[admin/rescore] run ${run_id} failed:`,
        err instanceof Error ? err.message : String(err),
      );
      // Defensive: ensure the row is closed out even if the orchestrator's
      // finalize path missed it.
      try {
        await finishOrchestratorRun(supabase, run_id, {
          status: "failed",
          error: {
            message: err instanceof Error ? err.message : String(err),
          },
        });
      } catch {
        // already closed — fine
      }
    }
  });

  return NextResponse.json({ run_id, status: "running" }, { status: 202 });
}
