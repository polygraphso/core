/**
 * Postgres LISTEN/NOTIFY emission for scoring-side events.
 *
 * Consumers listen via pg-listen or direct LISTEN sql on a long-lived
 * connection (Supabase Realtime is intentionally not used — contracts
 * specifies direct LISTEN/NOTIFY).
 *
 * Each helper here is a thin wrapper around the `polygraph_notify` RPC
 * defined in 20260518170000_polygraph_notify_function.sql. The RPC
 * allowlists channel names; passing an unknown channel raises at the DB
 * layer, which surfaces as an error from supabase-js.
 *
 * All helpers are best-effort: a NOTIFY failure logs but does not throw,
 * because dropping a notification shouldn't fail the broader scoring run.
 * If notifications start silently dropping, the symptom will be litmus /
 * alert workers not firing — surfaced via metrics, not by crashing the
 * scoring loop.
 */

import type { SupabaseClient } from "@supabase/supabase-js";
import type {
  AlertFiredPayload,
  GradeComputedPayload,
  VersionDetectedPayload,
} from "@polygraph/core";

export type NotifyChannel = "version_detected" | "grade_computed" | "alert_fired";

interface PayloadByChannel {
  version_detected: VersionDetectedPayload;
  grade_computed: GradeComputedPayload;
  alert_fired: AlertFiredPayload;
}

/**
 * Low-level emit. Logs and swallows errors so callers can fire-and-forget
 * without try/catch boilerplate at every call site.
 */
export async function emit<C extends NotifyChannel>(
  supabase: SupabaseClient,
  channel: C,
  payload: PayloadByChannel[C],
): Promise<void> {
  const { error } = await supabase.rpc("polygraph_notify", { channel, payload });
  if (error) {
    console.error(`[notify] ${channel} emit failed: ${error.message}`);
  }
}

export function notifyVersionDetected(
  supabase: SupabaseClient,
  payload: VersionDetectedPayload,
): Promise<void> {
  return emit(supabase, "version_detected", payload);
}

export function notifyGradeComputed(
  supabase: SupabaseClient,
  payload: GradeComputedPayload,
): Promise<void> {
  return emit(supabase, "grade_computed", payload);
}
