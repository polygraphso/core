import "server-only";
import { getSupabaseAdmin } from "@/lib/supabase";
import { refToPath } from "@/lib/badgeData";
import { skillRefToPath } from "@/lib/skillGrades";

/**
 * A grade request enriched with what the requester paid (the $1 fee that gates
 * every request, recorded in grade_request_payments) and the result (the target's
 * published grade, if it's been graded). Powers both the user-facing "Requests"
 * tab and the admin queue. Requests tie to a user by email; the resulting grade
 * comes from the target's latest published hosted_run.
 */
export interface GradeRequestView {
  id: string;
  target: string;
  targetKind: string; // 'registry_ref' | 'remote_url'
  status: string; // 'queued' | 'in_progress' | 'completed' | 'declined'
  requestedAt: string;
  fulfilledAt: string | null;
  email: string | null;
  priorityPaidAt: string | null;
  priorityDeadlineAt: string | null;
  // The fee: whichever payment row is authoritative — the paid one, else newest.
  feeStatus: string | null; // 'paid' | 'pending' | 'expired' | null (never quoted)
  feeUsd: number | null;
  feePaidAt: string | null;
  // The result.
  grade: string | null;
  gradeVersion: string | null;
  reportHref: string | null; // /mcp report, only when a published grade exists
}

const SELECT =
  "id, target, target_kind, email, status, requested_at, fulfilled_at, priority_paid_at, priority_deadline_at";

interface RawRequest {
  id: string;
  target: string;
  target_kind: string;
  email: string | null;
  status: string;
  requested_at: string;
  fulfilled_at: string | null;
  priority_paid_at: string | null;
  priority_deadline_at: string | null;
}

interface PaymentRow {
  grade_request_id: string;
  usd_price: number | string;
  status: string;
  paid_at: string | null;
  created_at: string;
}

/** The authoritative fee for a request: the paid quote if any, else the newest. */
function pickFee(rows: PaymentRow[] | undefined): PaymentRow | null {
  if (!rows || rows.length === 0) return null;
  return (
    rows.find((p) => p.status === "paid") ??
    [...rows].sort((a, b) => (a.created_at < b.created_at ? 1 : -1))[0]
  );
}

async function buildViews(
  db: NonNullable<ReturnType<typeof getSupabaseAdmin>>,
  reqs: RawRequest[],
): Promise<GradeRequestView[]> {
  if (reqs.length === 0) return [];
  const ids = reqs.map((r) => r.id);
  const targets = [...new Set(reqs.map((r) => r.target))];

  const [payRes, gradeRes] = await Promise.all([
    db
      .from("grade_request_payments")
      .select("grade_request_id, usd_price, status, paid_at, created_at")
      .in("grade_request_id", ids),
    db
      .from("hosted_runs")
      .select("target, target_kind, grade, resolved_version")
      .in("target", targets)
      .eq("status", "complete")
      .not("published_at", "is", null)
      .order("published_at", { ascending: false }),
  ]);

  if (payRes.error) console.error("[grade-requests] payments fetch failed:", payRes.error.message);
  if (gradeRes.error) console.error("[grade-requests] grades fetch failed:", gradeRes.error.message);

  const paysByReq = new Map<string, PaymentRow[]>();
  for (const p of (payRes.data ?? []) as PaymentRow[]) {
    const arr = paysByReq.get(p.grade_request_id) ?? [];
    arr.push(p);
    paysByReq.set(p.grade_request_id, arr);
  }

  const gradeByTarget = new Map<string, { grade: string | null; version: string | null; kind: string | null }>();
  for (const row of (gradeRes.data ?? []) as { target: string; target_kind: string | null; grade: string | null; resolved_version: string | null }[]) {
    if (!gradeByTarget.has(row.target)) {
      gradeByTarget.set(row.target, { grade: row.grade, version: row.resolved_version, kind: row.target_kind });
    }
  }

  return reqs.map((r) => {
    const fee = pickFee(paysByReq.get(r.id));
    const g = gradeByTarget.get(r.target);
    return {
      id: r.id,
      target: r.target,
      targetKind: r.target_kind,
      status: r.status,
      requestedAt: r.requested_at,
      fulfilledAt: r.fulfilled_at,
      email: r.email,
      priorityPaidAt: r.priority_paid_at,
      priorityDeadlineAt: r.priority_deadline_at,
      feeStatus: fee?.status ?? null,
      feeUsd: fee ? Number(fee.usd_price) || 0 : null,
      feePaidAt: fee?.paid_at ?? null,
      grade: g?.grade ?? null,
      gradeVersion: g?.version ?? null,
      reportHref: g?.grade
        ? g.kind === "skill"
          ? `/skill/${skillRefToPath(r.target)}`
          : `/mcp/${refToPath(r.target)}`
        : null,
    };
  });
}

/** Every grade request this email submitted, newest first. */
export async function getUserGradeRequests(email: string): Promise<GradeRequestView[]> {
  const db = getSupabaseAdmin();
  if (!db || !email) return [];
  const { data, error } = await db
    .from("grade_requests")
    .select(SELECT)
    .eq("email", email)
    .order("requested_at", { ascending: false });
  if (error) {
    console.error("[grade-requests] user requests fetch failed:", error.message);
    return [];
  }
  return buildViews(db, (data ?? []) as RawRequest[]);
}

/** A page of all grade requests for the admin queue, newest first. */
export async function getAdminGradeRequests(
  page = 1,
  pageSize = 30,
): Promise<{ rows: GradeRequestView[]; total: number }> {
  const db = getSupabaseAdmin();
  if (!db) return { rows: [], total: 0 };
  const offset = (page - 1) * pageSize;
  const { data, error, count } = await db
    .from("grade_requests")
    .select(SELECT, { count: "exact" })
    .order("requested_at", { ascending: false })
    .range(offset, offset + pageSize - 1);
  if (error) {
    console.error("[grade-requests] admin list fetch failed:", error.message);
    return { rows: [], total: 0 };
  }
  return { rows: await buildViews(db, (data ?? []) as RawRequest[]), total: count ?? 0 };
}

export type RequestTone = "done" | "active" | "wait" | "dead";

/**
 * The requester-facing stage of a request. "Awaiting payment" is a paid-model
 * quirk: a queued row whose $1 fee hasn't landed is recorded demand, not a real
 * place in line, so it reads distinctly from a paid, in-queue request.
 */
export function requestStage(v: GradeRequestView): { label: string; tone: RequestTone } {
  if (v.status === "completed") return { label: "Graded", tone: "done" };
  if (v.status === "declined") return { label: "Declined", tone: "dead" };
  if (!v.priorityPaidAt) return { label: "Awaiting payment", tone: "wait" };
  if (v.status === "in_progress") return { label: "Grading", tone: "active" };
  return { label: "In queue", tone: "active" };
}
