/**
 * The DB seam for the alert engine. runAlerts depends on this interface, not on
 * supabase-js directly, so the engine is unit-testable with a fake store and the
 * raw queries live in one place (supabaseAlertStore).
 *
 * All access is service-role (RLS-bypassing); never reached from the browser.
 */

import type { SupabaseClient } from "@supabase/supabase-js";

/** An active subscription, as the engine needs it. */
export interface MonitorRecord {
  id: string;
  target: string;
  email: string | null;
  unsubscribe_token: string;
  last_notified_run_id: string | null;
  last_notified_grade: string | null;
  /** Alert threshold; null = every regrade. See gradeMeetsThreshold. */
  alert_min_grade: string | null;
}

/** The latest published grade for a target. */
export interface PublishedGrade {
  id: string;
  resolved_version: string | null;
  grade: string | null;
}

export interface ClaimDeliveryInput {
  monitor_id: string;
  hosted_run_id: string;
  target: string;
  version: string | null;
  grade: string | null;
  email: string;
}

export interface AlertStore {
  /** All non-unsubscribed monitors. */
  activeMonitors(): Promise<MonitorRecord[]>;
  /** Latest published (live) grade row for a target, or null if ungraded. */
  latestPublishedGrade(target: string): Promise<PublishedGrade | null>;
  /** Is there already a published grade at this exact (target, version)? */
  hasPublishedGradeForVersion(target: string, version: string): Promise<boolean>;
  /** Is a monitor-sourced regrade already queued/running for this target? */
  hasInFlightMonitorRegrade(target: string): Promise<boolean>;
  /** Enqueue a free regrade (a source='monitor' hosted_runs row). */
  enqueueMonitorRegrade(target: string): Promise<void>;
  /**
   * Claim a (monitor, run) delivery by inserting a pending alert_deliveries row.
   * Returns the new row id, or null if it already existed (the unique constraint
   * is the double-email defense).
   */
  claimDelivery(input: ClaimDeliveryInput): Promise<string | null>;
  /** Mark a claimed delivery sent or failed. */
  markDelivery(
    id: string,
    status: "sent" | "failed",
    detail: { resendMessageId?: string | null; error?: string | null },
  ): Promise<void>;
  /** Advance a monitor's watermark to the run it was just notified about. */
  advanceWatermark(
    monitorId: string,
    grade: PublishedGrade,
  ): Promise<void>;
  /**
   * Record a run as seen without notifying (a grade suppressed by the monitor's
   * threshold). Advances ONLY the dedup watermark (last_notified_run_id) so the
   * hourly cron won't reprocess it — the display fields (last_notified_grade/
   * version/at) stay truthful to real sends.
   */
  markSeen(monitorId: string, runId: string): Promise<void>;
}

/** supabase-js backed AlertStore. */
export function supabaseAlertStore(supabase: SupabaseClient): AlertStore {
  return {
    async activeMonitors() {
      const { data, error } = await supabase.rpc("active_monitors_with_email");
      if (error) throw new Error(`activeMonitors: ${error.message}`);
      return (data ?? []) as MonitorRecord[];
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
      if (error) throw new Error(`hasPublishedGradeForVersion(${target}@${version}): ${error.message}`);
      return data != null;
    },

    async hasInFlightMonitorRegrade(target) {
      const { data, error } = await supabase
        .from("hosted_runs")
        .select("id")
        .eq("target", target)
        .eq("source", "monitor")
        .in("status", ["queued", "running"])
        .limit(1)
        .maybeSingle();
      if (error) throw new Error(`hasInFlightMonitorRegrade(${target}): ${error.message}`);
      return data != null;
    },

    async enqueueMonitorRegrade(target) {
      const { error } = await supabase.from("hosted_runs").insert({
        target,
        target_kind: "registry_ref",
        source: "monitor",
        status: "queued",
        email: "monitor@polygraph.so",
      });
      if (error) throw new Error(`enqueueMonitorRegrade(${target}): ${error.message}`);
    },

    async claimDelivery(input) {
      const { data, error } = await supabase.rpc("claim_or_retry_delivery", {
        p_monitor_id: input.monitor_id,
        p_hosted_run_id: input.hosted_run_id,
        p_target: input.target,
        p_version: input.version,
        p_grade: input.grade,
        p_email: input.email,
      });
      if (error) throw new Error(`claimDelivery(${input.monitor_id}): ${error.message}`);
      return (data as string | null) ?? null;
    },

    async markDelivery(id, status, detail) {
      const { error } = await supabase
        .from("alert_deliveries")
        .update({
          status,
          resend_message_id: detail.resendMessageId ?? null,
          error: detail.error ?? null,
          sent_at: status === "sent" ? new Date().toISOString() : null,
        })
        .eq("id", id);
      if (error) throw new Error(`markDelivery(${id}): ${error.message}`);
    },

    async advanceWatermark(monitorId, grade) {
      const { error } = await supabase
        .from("monitors")
        .update({
          last_notified_run_id: grade.id,
          last_notified_version: grade.resolved_version,
          last_notified_grade: grade.grade,
          last_notified_at: new Date().toISOString(),
        })
        .eq("id", monitorId);
      if (error) throw new Error(`advanceWatermark(${monitorId}): ${error.message}`);
    },

    async markSeen(monitorId, runId) {
      // Only the dedup watermark — no last_notified_* display fields, since no
      // email was sent. The "Last alerted" line on the dashboard must not move.
      const { error } = await supabase
        .from("monitors")
        .update({ last_notified_run_id: runId })
        .eq("id", monitorId);
      if (error) throw new Error(`markSeen(${monitorId}): ${error.message}`);
    },
  };
}
