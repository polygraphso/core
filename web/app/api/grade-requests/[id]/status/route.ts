/**
 * GET /api/grade-requests/[id]/status — the live progress of a paid grade.
 *
 * Public: the request uuid is the capability, same as the pay routes. Each call
 * polls the request's hosted-runner job and reconciles (publishing the grade
 * and closing the request when the run completes, declining it on a runner
 * error). The checkout page polls this after payment; returns
 * { state: unpaid | grading | graded | failed, ... }.
 */

import { enforceRateLimit } from "@/lib/rateLimit";
import { pollAndReconcile } from "@/lib/paidGrading";

export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!/^[0-9a-f-]{36}$/.test(id)) {
    return Response.json({ error: "bad request id" }, { status: 400 });
  }
  const limited = await enforceRateLimit(request, "grade-status", {
    max: 60,
    windowSeconds: 60,
  });
  if (limited) return limited;

  const progress = await pollAndReconcile(id);
  return Response.json(progress);
}
