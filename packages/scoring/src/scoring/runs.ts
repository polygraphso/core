/**
 * Orchestrator-level `runs` row helpers.
 *
 * A scoring orchestrator pass covers every tracked server, so there's no
 * single version_id to attach — it writes one row with version_id=NULL
 * and kind='scoring'. The /admin dashboard reads the most recent such row
 * to show "Idle / Running / Failed (timestamp)".
 *
 * Per-version runs (litmus probes, individual rescore requests) can still
 * use the same table with a version_id set — these helpers only handle the
 * orchestrator-level case.
 */

import type { SupabaseClient } from "@supabase/supabase-js";
import type { RunKind } from "@polygraph/core";

/**
 * Thrown when the unique-index on (kind) WHERE version_id IS NULL AND
 * status IN ('queued','running') rejects the insert — i.e. another
 * orchestrator-level run of the same kind is already in flight.
 */
export class OrchestratorRunAlreadyActiveError extends Error {
  readonly kind: RunKind;
  constructor(kind: RunKind) {
    super(`An orchestrator run of kind '${kind}' is already queued or running.`);
    this.name = "OrchestratorRunAlreadyActiveError";
    this.kind = kind;
  }
}

export async function startOrchestratorRun(
  supabase: SupabaseClient,
  kind: RunKind,
): Promise<{ run_id: string }> {
  const { data, error } = await supabase
    .from("runs")
    .insert({
      version_id: null,
      kind,
      status: "running",
      started_at: new Date().toISOString(),
    })
    .select("id")
    .single();
  if (error) {
    // Postgres unique-violation — partial unique index runs_one_active_orchestrator_idx.
    if (error.code === "23505") {
      throw new OrchestratorRunAlreadyActiveError(kind);
    }
    throw new Error(`startOrchestratorRun: ${error.message}`);
  }
  return { run_id: data.id as string };
}

export async function finishOrchestratorRun(
  supabase: SupabaseClient,
  run_id: string,
  outcome:
    | { status: "completed" }
    | { status: "failed"; error: { message: string; stack?: string } },
): Promise<void> {
  const update: Record<string, unknown> = {
    status: outcome.status,
    finished_at: new Date().toISOString(),
  };
  if (outcome.status === "failed") update.error = outcome.error;
  const { error } = await supabase
    .from("runs")
    .update(update)
    .eq("id", run_id);
  // Don't throw — the orchestrator already did its work; failing to update
  // the run row is a metadata problem, not a data-integrity one. Log loud.
  if (error) {
    console.error(`[runs] finishOrchestratorRun(${run_id}): ${error.message}`);
  }
}
