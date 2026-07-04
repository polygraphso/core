/**
 * Recent-failure gate for the grade-request funnel. The intake gates check
 * that a target EXISTS and looks like an MCP server; they can't know whether
 * it LAUNCHES from its published form (a client-side proxy that needs a URL
 * argument exists on npm but exits immediately when run bare). The harness's
 * own history is the ground truth: if the latest run for a target FAILED
 * recently, requesting it again would just burn a grading slot on a known
 * outcome — reject at ask time with an explanation instead.
 *
 * Time-boxed: failures older than the cooldown don't block, so a package that
 * ships a fix gets retried. A newer successful run always supersedes.
 */

import type { SupabaseClient } from "@supabase/supabase-js";

const COOLDOWN_DAYS = 14;

export interface LatestRunOutcome {
  status: string; // 'complete' | 'failed'
  completed_at: string | null;
  failure_reason: string | null;
}

export type GradeabilityVerdict = { blocked: false } | { blocked: true; reason: string };

/** Pure decision: does the latest run outcome block a new request right now? */
export function isBlockedByRecentFailure(
  latest: LatestRunOutcome | null,
  now: Date = new Date(),
  cooldownDays: number = COOLDOWN_DAYS,
): GradeabilityVerdict {
  if (!latest || latest.status !== "failed") return { blocked: false };
  if (!latest.completed_at) return { blocked: false }; // can't age it — fail open
  const ageMs = now.getTime() - new Date(latest.completed_at).getTime();
  if (ageMs > cooldownDays * 24 * 60 * 60 * 1000) return { blocked: false };
  return {
    blocked: true,
    reason:
      `We recently tried to grade this server and the run couldn't complete — ` +
      `it doesn't launch from its published form (commonly: it needs credentials ` +
      `or arguments to start). If you can point us at a runnable form or an ` +
      `https:// endpoint, request that instead; otherwise it becomes requestable ` +
      `again after a couple of weeks.`,
  };
}

/** Latest terminal run for a target — the input to the pure decision. */
export async function fetchLatestRunOutcome(
  supabase: SupabaseClient,
  target: string,
): Promise<LatestRunOutcome | null> {
  const { data, error } = await supabase
    .from("hosted_runs")
    .select("status, completed_at, failure_reason")
    .eq("target", target)
    .in("status", ["complete", "failed"])
    .order("completed_at", { ascending: false, nullsFirst: false })
    .limit(1)
    .maybeSingle();
  if (error) {
    // The gate is a guardrail, not auth — never block a request on a lookup
    // failure (same fail-open posture as the rate limiter).
    console.error(`[gradeability] fetchLatestRunOutcome(${target}) failed:`, error.message);
    return null;
  }
  return (data as LatestRunOutcome | null) ?? null;
}
