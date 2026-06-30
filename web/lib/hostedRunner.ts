/**
 * Thin client for polygraph's hosted grading runner — the token-gated
 * `POST /grade` service on hosted.polygraph.so. The admin re-grade flow proxies
 * through here so the runner bearer token (HOSTED_RUNNER_TOKEN) stays
 * server-side and never reaches the browser. The request builders are pure, so
 * the bearer/url/body wiring is unit-tested without a live runner.
 */

export type RunnerKind = "server" | "skill";

export interface RunnerConfig {
  url: string;
  token: string;
}

/** Map a hosted_runs `target_kind` to the runner's `POST /grade` `kind`. The
 *  admin table speaks the DB vocabulary (registry_ref/skill); the runner speaks
 *  server/skill. */
export function runnerKindFor(targetKind: string): RunnerKind {
  return targetKind === "skill" ? "skill" : "server";
}

/** Runner config from the environment, or null when unconfigured (the route maps
 *  null → 503 rather than throwing). */
export function hostedRunnerConfig(): RunnerConfig | null {
  const url = process.env.HOSTED_RUNNER_URL;
  const token = process.env.HOSTED_RUNNER_TOKEN;
  if (!url || !token) return null;
  return { url, token };
}

interface BuiltRequest {
  url: string;
  init: { method: string; headers: Record<string, string>; body?: string };
}

const base = (url: string) => url.replace(/\/+$/, "");

/** POST /grade — enqueue a fresh grade for a target. */
export function buildGradeRequest(
  cfg: RunnerConfig,
  body: { target: string; kind: RunnerKind; label?: string },
): BuiltRequest {
  const payload: Record<string, string> = { target: body.target, kind: body.kind };
  if (body.label) payload.label = body.label;
  return {
    url: `${base(cfg.url)}/grade`,
    init: {
      method: "POST",
      headers: { authorization: `Bearer ${cfg.token}`, "content-type": "application/json" },
      body: JSON.stringify(payload),
    },
  };
}

/** GET /grade/:id — poll a queued grade's status. */
export function buildStatusRequest(cfg: RunnerConfig, id: string): BuiltRequest {
  return {
    url: `${base(cfg.url)}/grade/${encodeURIComponent(id)}`,
    init: {
      method: "GET",
      headers: { authorization: `Bearer ${cfg.token}` },
    },
  };
}

/** Fire a re-grade; resolves the runner's 202 body ({ id, status, status_url }). */
export async function postGrade(
  cfg: RunnerConfig,
  body: { target: string; kind: RunnerKind; label?: string },
): Promise<{ status: number; data: unknown }> {
  const { url, init } = buildGradeRequest(cfg, body);
  const res = await fetch(url, init);
  return { status: res.status, data: await res.json().catch(() => null) };
}

/** Poll a grade job's status (the runner's GET /grade/:id). */
export async function getGradeStatus(
  cfg: RunnerConfig,
  id: string,
): Promise<{ status: number; data: unknown }> {
  const { url, init } = buildStatusRequest(cfg, id);
  const res = await fetch(url, init);
  return { status: res.status, data: await res.json().catch(() => null) };
}
