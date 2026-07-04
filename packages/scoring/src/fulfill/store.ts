/**
 * The DB seam for the grade-request fulfillment engine. runFulfillment depends
 * on this interface, not on supabase-js directly (same pattern as the alert
 * engine's AlertStore), so the engine is unit-testable with a fake store.
 *
 * All access is service-role (RLS-bypassing); never reached from the browser.
 */

import type { SupabaseClient } from "@supabase/supabase-js";

/** A grade_requests row, as the engine needs it. */
export interface GradeRequestRecord {
  id: string;
  target: string;
  target_kind: "registry_ref" | "remote_url";
  email: string | null;
  /** The hosted_runs row this request rides on; null until enqueued. */
  hosted_run_id: string | null;
}

/** The linked hosted_runs row during reconciliation. */
export interface HostedRunRecord {
  id: string;
  status: string; // 'queued' | 'running' | 'complete' | 'failed'
  grade: string | null;
  resolved_version: string | null;
  published_at: string | null;
  failure_reason: string | null;
}

export interface PublishedGrade {
  id: string;
  resolved_version: string | null;
  grade: string | null;
}

/** The latest terminal run for a target — input to the recent-failure gate. */
export interface LatestRunOutcome {
  status: string; // 'complete' | 'failed'
  completed_at: string | null;
  failure_reason: string | null;
}

export interface FulfillStore {
  /** Oldest queued requests, up to `limit`. */
  queuedRequests(limit: number): Promise<GradeRequestRecord[]>;
  /** Requests waiting on a grading run. */
  inProgressRequests(): Promise<GradeRequestRecord[]>;
  /** The hosted run a request is linked to. */
  runById(id: string): Promise<HostedRunRecord | null>;
  /** Latest published (live) grade row for a target, or null if ungraded. */
  latestPublishedGrade(target: string): Promise<PublishedGrade | null>;
  /** Latest terminal (complete/failed) run for a target, or null if never run. */
  latestRunOutcome(target: string): Promise<LatestRunOutcome | null>;
  /** Is there already a published grade at this exact (target, version)? */
  hasPublishedGradeForVersion(target: string, version: string): Promise<boolean>;
  /** Id of an already queued/running free regrade for this target, if any —
   *  lets a request ride an in-flight run instead of enqueueing a duplicate. */
  inFlightRegradeId(target: string): Promise<string | null>;
  /** Enqueue a free auto-published grading run; returns the new run's id. */
  enqueueRegrade(target: string, kind: "registry_ref" | "remote_url"): Promise<string>;
  markInProgress(requestId: string, hostedRunId: string): Promise<void>;
  completeRequest(requestId: string): Promise<void>;
  declineRequest(requestId: string): Promise<void>;
}

/** supabase-js backed FulfillStore. */
export function supabaseFulfillStore(supabase: SupabaseClient): FulfillStore {
  return {
    async queuedRequests(limit) {
      const { data, error } = await supabase
        .from("grade_requests")
        .select("id, target, target_kind, email, hosted_run_id")
        .eq("status", "queued")
        .order("requested_at", { ascending: true })
        .limit(limit);
      if (error) throw new Error(`queuedRequests: ${error.message}`);
      return (data ?? []) as GradeRequestRecord[];
    },

    async inProgressRequests() {
      const { data, error } = await supabase
        .from("grade_requests")
        .select("id, target, target_kind, email, hosted_run_id")
        .eq("status", "in_progress");
      if (error) throw new Error(`inProgressRequests: ${error.message}`);
      return (data ?? []) as GradeRequestRecord[];
    },

    async runById(id) {
      const { data, error } = await supabase
        .from("hosted_runs")
        .select("id, status, grade, resolved_version, published_at, failure_reason")
        .eq("id", id)
        .maybeSingle();
      if (error) throw new Error(`runById(${id}): ${error.message}`);
      return (data as HostedRunRecord | null) ?? null;
    },

    async latestPublishedGrade(target) {
      const { data, error } = await supabase
        .from("hosted_runs")
        .select("id, resolved_version, grade")
        .eq("target", target)
        .eq("status", "complete")
        .not("published_at", "is", null)
        .order("published_at", { ascending: false })
        .limit(1)
        .maybeSingle();
      if (error) throw new Error(`latestPublishedGrade(${target}): ${error.message}`);
      return (data as PublishedGrade | null) ?? null;
    },

    async latestRunOutcome(target) {
      const { data, error } = await supabase
        .from("hosted_runs")
        .select("status, completed_at, failure_reason")
        .eq("target", target)
        .in("status", ["complete", "failed"])
        .order("completed_at", { ascending: false, nullsFirst: false })
        .limit(1)
        .maybeSingle();
      if (error) throw new Error(`latestRunOutcome(${target}): ${error.message}`);
      return (data as LatestRunOutcome | null) ?? null;
    },

    async hasPublishedGradeForVersion(target, version) {
      const { data, error } = await supabase
        .from("hosted_runs")
        .select("id")
        .eq("target", target)
        .eq("resolved_version", version)
        .eq("status", "complete")
        .not("published_at", "is", null)
        .limit(1)
        .maybeSingle();
      if (error) {
        throw new Error(`hasPublishedGradeForVersion(${target}@${version}): ${error.message}`);
      }
      return data != null;
    },

    async inFlightRegradeId(target) {
      // source='monitor' is the free auto-publish lane (see the hosted_runs
      // source migration) — shared with the alert engine, so either producer's
      // in-flight run satisfies a request for the same target.
      const { data, error } = await supabase
        .from("hosted_runs")
        .select("id")
        .eq("target", target)
        .eq("source", "monitor")
        .in("status", ["queued", "running"])
        .limit(1)
        .maybeSingle();
      if (error) throw new Error(`inFlightRegradeId(${target}): ${error.message}`);
      return (data as { id: string } | null)?.id ?? null;
    },

    async enqueueRegrade(target, kind) {
      // source='monitor' = the worker's free auto-publish lane (claimable
      // without payment; grade + published_at stamped on completion). The
      // request@ sentinel email keeps run rows distinguishable from the alert
      // engine's monitor@ rows; requester provenance lives on grade_requests.
      const { data, error } = await supabase
        .from("hosted_runs")
        .insert({
          target,
          target_kind: kind,
          source: "monitor",
          status: "queued",
          email: "request@polygraph.so",
        })
        .select("id")
        .single();
      if (error) throw new Error(`enqueueRegrade(${target}): ${error.message}`);
      return (data as { id: string }).id;
    },

    async markInProgress(requestId, hostedRunId) {
      const { error } = await supabase
        .from("grade_requests")
        .update({ status: "in_progress", hosted_run_id: hostedRunId })
        .eq("id", requestId);
      if (error) throw new Error(`markInProgress(${requestId}): ${error.message}`);
    },

    async completeRequest(requestId) {
      const { error } = await supabase
        .from("grade_requests")
        .update({ status: "completed", fulfilled_at: new Date().toISOString() })
        .eq("id", requestId);
      if (error) throw new Error(`completeRequest(${requestId}): ${error.message}`);
    },

    async declineRequest(requestId) {
      const { error } = await supabase
        .from("grade_requests")
        .update({ status: "declined" })
        .eq("id", requestId);
      if (error) throw new Error(`declineRequest(${requestId}): ${error.message}`);
    },
  };
}
