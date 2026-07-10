import "server-only";

/**
 * Shared guts for the /api/manage/[slug] routes: the auth/role guard every route
 * runs first, the immediate-grade fire-and-record, and the per-ecosystem grade
 * budget. Keeping these here means each route file is just its own validation +
 * one DB write.
 */

import { getSession, type PolygraphSession } from "@/lib/session";
import { getSupabaseAdmin } from "@/lib/supabase";
import {
  getEcosystemRole,
  canManageEcosystem,
  type EcosystemAccess,
} from "@/lib/ecosystemAccess";
import { getPaymentGate } from "@/lib/ecosystemPayments";
import { hostedRunnerConfig, postGrade, runnerKindFor } from "@/lib/hostedRunner";
import type { EcosystemEntryKind } from "@/lib/ecosystemTypes";

export interface Guarded {
  session: PolygraphSession;
  access: EcosystemAccess;
}

/**
 * Resolve the caller's access to `slug`, or return the Response to send. Routes do
 * `const g = await guardManage(slug); if (g instanceof Response) return g;`.
 * `requireManage` additionally demands admin/app-admin (members → 403).
 *
 * Monitoring is paid: every manage route is 402-gated on the ecosystem's payment
 * (a live POLYGRAPH stream, or comped) unless it opts out with
 * `requirePaid: false` — which only the payment routes themselves do.
 */
export async function guardManage(
  slug: string,
  opts: { requireManage?: boolean; requirePaid?: boolean } = {},
): Promise<Guarded | Response> {
  const session = await getSession();
  if (!session) return Response.json({ error: "Unauthorized" }, { status: 401 });
  const access = await getEcosystemRole(session, slug);
  if (!access) return Response.json({ error: "Forbidden" }, { status: 403 });
  if (opts.requireManage && !canManageEcosystem(access.role)) {
    return Response.json({ error: "Admins only" }, { status: 403 });
  }
  // App admins bypass the payment gate — the operator works on ecosystems
  // before (and regardless of) payment.
  if (opts.requirePaid !== false && access.role !== "app-admin") {
    const gate = await getPaymentGate(access.ecosystem);
    if (gate.status !== "active") {
      return Response.json({ error: "Payment required" }, { status: 402 });
    }
  }
  return { session, access };
}

const GRADE_BUDGET_PER_DAY = 50;

/**
 * Guard the runner's grade budget: at most GRADE_BUDGET_PER_DAY entries added per
 * ecosystem per rolling 24h (each add fires one grade). Returns true when the cap
 * is already hit, so the add route can 429 rather than spend the runner.
 */
export async function gradeBudgetExceeded(ecosystemId: string): Promise<boolean> {
  const db = getSupabaseAdmin();
  if (!db) return false;
  const since = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
  const { count } = await db
    .from("ecosystem_entries")
    .select("id", { count: "exact", head: true })
    .eq("ecosystem_id", ecosystemId)
    .gte("added_at", since);
  return (count ?? 0) >= GRADE_BUDGET_PER_DAY;
}

export interface GradeFire {
  jobId: string | null;
  status: string | null;
  note?: string;
}

/**
 * Fire an immediate grade for an entry via the hosted runner and record the job id
 * + status on the row. Never throws — the entry stands even when the runner is
 * unconfigured or errors, so the grade simply stays pending (a later regrade or the
 * hourly fulfilment loop can pick it up). Reuses the exact runner path the admin
 * regrade route uses.
 */
export async function fireGradeForEntry(entry: {
  id: string;
  target: string | null;
  target_kind: EcosystemEntryKind;
}): Promise<GradeFire> {
  const db = getSupabaseAdmin();
  if (!entry.target) return { jobId: null, status: null, note: "no-target" };
  const cfg = hostedRunnerConfig();
  if (!cfg) return { jobId: null, status: null, note: "runner-unconfigured" };

  try {
    const { status, data } = await postGrade(cfg, {
      target: entry.target,
      kind: runnerKindFor(entry.target_kind),
      label: entry.target,
    });
    const payload = (data ?? {}) as { id?: string; status?: string };
    const jobId = payload.id ?? null;
    const jobStatus = payload.status ?? (status === 202 ? "queued" : `error-${status}`);
    if (db) {
      await db
        .from("ecosystem_entries")
        .update({ last_grade_run_id: jobId, last_grade_status: jobStatus })
        .eq("id", entry.id);
    }
    return { jobId, status: jobStatus };
  } catch (e) {
    return { jobId: null, status: "error", note: e instanceof Error ? e.message : String(e) };
  }
}
