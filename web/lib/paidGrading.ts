import "server-only";

/**
 * The paid grade's fulfillment loop: once a request's $1 is paid we kick off a
 * hosted grading run immediately (instead of waiting out the hourly cron), then
 * the status endpoint polls it and publishes the grade when it lands.
 *
 * `startGradeForRequest` is best-effort — a run that can't be enqueued (runner
 * unconfigured, a transient 5xx) leaves the request paid, so the hourly
 * fulfillment cron and the /admin drain remain the backstop; it never throws
 * into the payment path. `pollAndReconcile` is the state machine the status
 * endpoint runs on each poll: it reads the runner job, and on completion
 * auto-publishes the resulting hosted_runs row (a paid grade goes live with no
 * human in the loop) and closes the request.
 */

import { getSupabaseAdmin } from "@/lib/supabase";
import { refToPath } from "@/lib/serverRef";
import { skillRefToPath } from "@/lib/skillGrades";
import { settleAuthorizedFeePayment, voidAuthorizedFeePayment } from "@/lib/x402Fee";
import {
  hostedRunnerConfig,
  postGrade,
  getGradeStatus,
  runnerKindFor,
} from "@/lib/hostedRunner";
import { HOSTED_GRADING_DISABLED } from "@/lib/hostedGradingSunset";

/** The user-facing state the status endpoint returns and the UI polls on. */
export type GradeProgress =
  | { state: "unpaid" }
  | { state: "grading"; target: string }
  | { state: "graded"; target: string; grade: string; reportUrl: string }
  | { state: "failed"; target: string; reason: string };

interface RequestRow {
  id: string;
  target: string;
  target_kind: string;
  status: string;
  priority_paid_at: string | null;
  hosted_run_id: string | null;
  runner_job_id: string | null;
  note: string | null;
}

const REQUEST_COLUMNS =
  "id, target, target_kind, status, priority_paid_at, hosted_run_id, runner_job_id, note";

/**
 * Kick off a hosted grade for a just-paid request and record the runner job id.
 * Best-effort and idempotent: no-op if a job is already recorded, if the runner
 * is unconfigured, or on a runner error — the request stays paid either way.
 */
export async function startGradeForRequest(requestId: string): Promise<void> {
  if (HOSTED_GRADING_DISABLED) return;
  const db = getSupabaseAdmin();
  if (!db) return;
  const cfg = hostedRunnerConfig();
  if (!cfg) return; // no runner in this env — the cron backstop fulfills it

  const { data } = await db
    .from("grade_requests")
    .select("id, target, target_kind, runner_job_id")
    .eq("id", requestId)
    .maybeSingle();
  const row = data as Pick<RequestRow, "id" | "target" | "target_kind" | "runner_job_id"> | null;
  if (!row || row.runner_job_id) return; // gone, or already kicked off

  try {
    const { status, data: body } = await postGrade(cfg, {
      target: row.target,
      kind: runnerKindFor(row.target_kind),
      label: row.target,
    });
    const jobId = (body as { id?: string } | null)?.id;
    if (status >= 200 && status < 300 && jobId) {
      await db
        .from("grade_requests")
        .update({ runner_job_id: jobId, runner_started_at: new Date().toISOString() })
        .eq("id", requestId)
        .is("runner_job_id", null);
    } else {
      console.error("[paid-grading] runner did not accept the job", status, body);
    }
  } catch (e) {
    console.error("[paid-grading] enqueue failed", e);
  }
}

/** The /mcp or /skill report path for a completed target. */
function reportUrlFor(target: string, targetKind: string): string {
  // A skill ref carries a `#subpath`; skillRefToPath turns it into the
  // path-safe `/skill/owner/repo/subpath` form (a raw `#` would be read as a
  // URL fragment client-side and drop the subpath).
  return targetKind === "skill"
    ? `/skill/${skillRefToPath(target)}`
    : `/mcp/${refToPath(target)}`;
}

/**
 * Poll the request's runner job and reconcile. Returns the current progress for
 * the UI. On a completed run this publishes the hosted_runs row and marks the
 * request completed; on a runner error it declines the request with the reason.
 * Self-heals a missing job id (enqueue failed at payment time) by starting one.
 */
export async function pollAndReconcile(requestId: string): Promise<GradeProgress> {
  const db = getSupabaseAdmin();
  if (!db) return { state: "grading", target: "" };

  const { data } = await db
    .from("grade_requests")
    .select(REQUEST_COLUMNS)
    .eq("id", requestId)
    .maybeSingle();
  const row = data as RequestRow | null;
  if (!row) return { state: "failed", target: "", reason: "unknown request" };

  if (!row.priority_paid_at) return { state: "unpaid" };

  // Terminal states already recorded on the request.
  if (row.status === "completed" && row.hosted_run_id) {
    const { data: hr } = await db
      .from("hosted_runs")
      .select("grade, target, target_kind, published_at")
      .eq("id", row.hosted_run_id)
      .maybeSingle();
    const grade = (hr as { grade?: string } | null)?.grade ?? "";
    return {
      state: "graded",
      target: row.target,
      grade,
      reportUrl: reportUrlFor(row.target, row.target_kind),
    };
  }
  if (row.status === "declined") {
    return { state: "failed", target: row.target, reason: declineReason(row.note) };
  }

  const cfg = hostedRunnerConfig();
  if (!cfg) return { state: "grading", target: row.target };

  // No job yet (enqueue failed at payment) — start one now and report grading.
  if (!row.runner_job_id) {
    await startGradeForRequest(requestId);
    return { state: "grading", target: row.target };
  }

  // Poll the runner's in-memory job. Vocabulary: queued | running | done | error.
  let job: { status?: string; grade?: string; error?: string; hosted_run_id?: string } | null;
  try {
    const { data: body } = await getGradeStatus(cfg, row.runner_job_id);
    job = body as typeof job;
  } catch {
    return { state: "grading", target: row.target }; // transient — keep polling
  }

  if (!job || job.status === "queued" || job.status === "running") {
    return { state: "grading", target: row.target };
  }

  if (job.status === "error") {
    const reason = job.error?.trim() || "the harness couldn't grade this target";
    // A failed run never charges: void the x402 authorization (no-op for the
    // web rail, whose fee settled upfront and buys the run either way).
    await voidAuthorizedFeePayment(requestId, reason);
    await db
      .from("grade_requests")
      .update({
        status: "declined",
        fulfilled_at: new Date().toISOString(),
        note: appendNote(row.note, `auto-grade failed: ${reason}`),
      })
      .eq("id", requestId)
      .eq("status", "queued");
    return { state: "failed", target: row.target, reason: `${reason} — you were not charged` };
  }

  if (job.status === "done" && job.hosted_run_id) {
    // A grade landed. On the x402 rail the fee settles NOW, before the grade
    // is published — an authorization we can no longer collect must not buy a
    // grade. The web rail (settled upfront) reports no_authorization and
    // publishes as before.
    const settle = await settleAuthorizedFeePayment(requestId);
    if (settle.state === "retry") {
      // Transient facilitator trouble inside the authorization window — keep
      // the run unpublished and let the next poll (or the cron sweep) settle.
      return { state: "grading", target: row.target };
    }
    if (settle.state === "failed") {
      await db
        .from("grade_requests")
        .update({
          status: "declined",
          fulfilled_at: new Date().toISOString(),
          note: appendNote(row.note, `x402 settlement failed: ${settle.reason}`),
        })
        .eq("id", requestId)
        .in("status", ["queued", "in_progress"]);
      return {
        state: "failed",
        target: row.target,
        reason: `the grade completed but ${settle.reason} — you were not charged; request again to retry`,
      };
    }

    // Publish the grade-only row the runner wrote, then close the request.
    const nowIso = new Date().toISOString();
    const { data: hr } = await db
      .from("hosted_runs")
      .update({ published_at: nowIso })
      .eq("id", job.hosted_run_id)
      .eq("status", "complete")
      .is("published_at", null)
      .select("grade, target, target_kind")
      .maybeSingle();
    // (Already-published is fine — hr null just means it was live; read the grade.)
    let grade = (hr as { grade?: string } | null)?.grade;
    if (grade === undefined) {
      const { data: existing } = await db
        .from("hosted_runs")
        .select("grade")
        .eq("id", job.hosted_run_id)
        .maybeSingle();
      grade = (existing as { grade?: string } | null)?.grade ?? job.grade ?? "";
    }
    await db
      .from("grade_requests")
      .update({ status: "completed", fulfilled_at: nowIso, hosted_run_id: job.hosted_run_id })
      .eq("id", requestId)
      .in("status", ["queued", "in_progress"]);
    return {
      state: "graded",
      target: row.target,
      grade: grade || "",
      reportUrl: reportUrlFor(row.target, row.target_kind),
    };
  }

  return { state: "grading", target: row.target };
}

function appendNote(existing: string | null, add: string): string {
  return existing ? `${existing} | ${add}` : add;
}

// ── The signed-in user's requests (account page) ─────────────────────────────

export interface UserGradeRequest {
  id: string;
  target: string;
  /** paid & running | graded | awaiting payment | declined. */
  state: "grading" | "graded" | "awaiting_payment" | "declined";
  grade: string | null;
  /** Report link when graded, else the pay page (awaiting) / null. */
  href: string | null;
  requestedAt: string;
}

/**
 * The grade requests tied to this email — what the account page lists so a
 * payer can find a request again. Keyed by the email the request was made
 * with; anonymous requests under a different email don't appear.
 */
export async function listUserGradeRequests(email: string): Promise<UserGradeRequest[]> {
  const db = getSupabaseAdmin();
  if (!db) return [];
  const { data } = await db
    .from("grade_requests")
    .select("id, target, target_kind, status, priority_paid_at, hosted_run_id, requested_at")
    .eq("email", email)
    .order("requested_at", { ascending: false })
    .limit(50);
  const rows = (data ?? []) as Array<
    Pick<RequestRow, "id" | "target" | "target_kind" | "status" | "priority_paid_at" | "hosted_run_id"> & {
      requested_at: string;
    }
  >;

  const graded = rows.filter((r) => r.status === "completed" && r.hosted_run_id);
  const gradeById = new Map<string, string>();
  if (graded.length) {
    const { data: hr } = await db
      .from("hosted_runs")
      .select("id, grade")
      .in("id", graded.map((r) => r.hosted_run_id as string));
    for (const row of (hr ?? []) as Array<{ id: string; grade: string | null }>) {
      if (row.grade) gradeById.set(row.id, row.grade);
    }
  }

  return rows.map((r) => {
    if (r.status === "completed" && r.hosted_run_id) {
      return {
        id: r.id,
        target: r.target,
        state: "graded",
        grade: gradeById.get(r.hosted_run_id) ?? null,
        href: reportUrlFor(r.target, r.target_kind),
        requestedAt: r.requested_at,
      };
    }
    if (r.status === "declined") {
      return { id: r.id, target: r.target, state: "declined", grade: null, href: null, requestedAt: r.requested_at };
    }
    if (r.priority_paid_at) {
      return {
        id: r.id,
        target: r.target,
        state: "grading",
        grade: null,
        href: `/request/priority/${r.id}`,
        requestedAt: r.requested_at,
      };
    }
    return {
      id: r.id,
      target: r.target,
      state: "awaiting_payment",
      grade: null,
      href: `/request/priority/${r.id}`,
      requestedAt: r.requested_at,
    };
  });
}

/** Pull the human reason out of a decline note, else a generic line. */
function declineReason(note: string | null): string {
  if (!note) return "this target couldn't be graded";
  const m = note.match(/auto-grade failed: (.+?)(?: \| |$)/);
  return m ? m[1]! : "this target couldn't be graded";
}
