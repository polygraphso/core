/**
 * POST /api/admin/regrade  — trigger a fresh hosted grade for a target.
 * GET  /api/admin/regrade?id=…  — poll the job's status.
 *
 * A server-side proxy to the runner's token-gated POST /grade on
 * hosted.polygraph.so: the HOSTED_RUNNER_TOKEN stays here and never reaches the
 * browser. Gated by proxy.ts (the /api/admin/* signed-session matcher), so an
 * unauthenticated caller can't spend the runner's grade budget. The grade is
 * decoupled — POST returns the runner's 202 + job id, the client polls GET.
 */
import { hostedRunnerConfig, postGrade, getGradeStatus, type RunnerKind } from "@/lib/hostedRunner";
import { hostedGradingGoneResponse, HOSTED_GRADING_DISABLED } from "@/lib/hostedGradingSunset";

export async function POST(request: Request) {
  if (HOSTED_GRADING_DISABLED) return hostedGradingGoneResponse();

  let body: { target?: unknown; kind?: unknown };
  try {
    body = (await request.json()) as { target?: unknown; kind?: unknown };
  } catch {
    return Response.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const target = typeof body.target === "string" ? body.target.trim() : "";
  const kind = body.kind;
  if (!target) return Response.json({ error: "target is required" }, { status: 400 });
  if (kind !== "server" && kind !== "skill") {
    return Response.json({ error: 'kind must be "server" or "skill"' }, { status: 400 });
  }

  const cfg = hostedRunnerConfig();
  if (!cfg) return Response.json({ error: "Hosted runner not configured" }, { status: 503 });

  try {
    const { status, data } = await postGrade(cfg, { target, kind: kind as RunnerKind, label: target });
    return Response.json(data ?? { error: "no response from runner" }, { status });
  } catch (e) {
    return Response.json({ error: e instanceof Error ? e.message : String(e) }, { status: 502 });
  }
}

export async function GET(request: Request) {
  if (HOSTED_GRADING_DISABLED) return hostedGradingGoneResponse();

  const id = new URL(request.url).searchParams.get("id");
  if (!id) return Response.json({ error: "id is required" }, { status: 400 });

  const cfg = hostedRunnerConfig();
  if (!cfg) return Response.json({ error: "Hosted runner not configured" }, { status: 503 });

  try {
    const { status, data } = await getGradeStatus(cfg, id);
    return Response.json(data ?? { error: "no response from runner" }, { status });
  } catch (e) {
    return Response.json({ error: e instanceof Error ? e.message : String(e) }, { status: 502 });
  }
}
