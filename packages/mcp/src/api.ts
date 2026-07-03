/**
 * HTTP client for the polygraph.so public CLI API.
 *
 * Override priority:
 *   1. `POLYGRAPH_API_URL` — full base URL, e.g. http://localhost:3000
 *   2. Default — https://polygraph.so
 *
 * Endpoints (already shipped; see web/app/api/cli/):
 *   POST /api/cli/check          → { server_ref } → graded | not_available
 *   GET  /api/cli/list           → { servers, total }
 *   POST /api/cli/grade-request  → { server_ref, source, agent_id? } → queued
 *
 * Network failures throw `PolygraphApiError` with a stable `kind` so the
 * tool handler can map it to a clean MCP error rather than a transport crash.
 */

const DEFAULT_BASE = "https://polygraph.so";

export type ApiErrorKind = "network" | "http" | "malformed";

export class PolygraphApiError extends Error {
  readonly kind: ApiErrorKind;
  readonly status?: number;

  constructor(kind: ApiErrorKind, message: string, status?: number) {
    super(message);
    this.name = "PolygraphApiError";
    this.kind = kind;
    if (status !== undefined) this.status = status;
  }
}

export function apiBaseUrl(): string {
  const override = process.env.POLYGRAPH_API_URL;
  if (!override || override.length === 0) return DEFAULT_BASE;
  return override.replace(/\/+$/, "");
}

export interface CheckResponseGraded {
  status: "graded";
  // The published grade. polygraph_detail carries the per-check results,
  // fingerprint, and methodology version; passed through verbatim.
  polygraph: "A" | "B" | "C" | "D" | "F";
  polygraph_detail?: unknown;
  notify_url: string;
}

export interface CheckResponseNotAvailable {
  status: "not_available";
  notify_url: string;
  // Present on current servers; optional so an older deployment still parses.
  message?: string;
  self_grade?: string;
}

export type CheckResponse = CheckResponseGraded | CheckResponseNotAvailable;

export interface ListEntry {
  server_ref: string;
  polygraph: "A" | "B" | "C" | "D" | "F";
}

export interface ListResponse {
  servers: ListEntry[];
  total: number;
}

export interface GradeRequestResponse {
  status: "queued";
  // false when this target was already queued (idempotent re-request).
  created: boolean;
  // How many requests stand behind this target — the demand signal.
  demand: number;
}

async function readJson<T>(res: Response): Promise<T> {
  try {
    return (await res.json()) as T;
  } catch {
    throw new PolygraphApiError("malformed", "polygraph.so returned a non-JSON response.");
  }
}

export async function postCheck(serverRef: string): Promise<CheckResponse> {
  const url = `${apiBaseUrl()}/api/cli/check`;
  let res: Response;
  try {
    res = await fetch(url, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ server_ref: serverRef }),
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    throw new PolygraphApiError("network", `couldn't reach polygraph.so (${msg}).`);
  }

  // 400 from the API means the ref was rejected — propagate the server's
  // message so the agent can see why and retry with a correct ref.
  if (res.status === 400) {
    let body: { error?: string };
    try {
      body = (await res.json()) as { error?: string };
    } catch {
      body = {};
    }
    throw new PolygraphApiError(
      "http",
      body.error ?? "polygraph.so rejected the server_ref as malformed.",
      400,
    );
  }

  if (!res.ok) {
    throw new PolygraphApiError(
      "http",
      `polygraph.so returned ${res.status}.`,
      res.status,
    );
  }

  return readJson<CheckResponse>(res);
}

export async function postGradeRequest(
  serverRef: string,
  agentId?: string,
): Promise<GradeRequestResponse> {
  const url = `${apiBaseUrl()}/api/cli/grade-request`;
  const body: { server_ref: string; source: "mcp"; agent_id?: string } = {
    server_ref: serverRef,
    source: "mcp",
  };
  if (agentId) body.agent_id = agentId;

  let res: Response;
  try {
    res = await fetch(url, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(body),
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    throw new PolygraphApiError("network", `couldn't reach polygraph.so (${msg}).`);
  }

  // 400 → the ref was rejected; propagate the server's message.
  if (res.status === 400) {
    let errBody: { error?: string };
    try {
      errBody = (await res.json()) as { error?: string };
    } catch {
      errBody = {};
    }
    throw new PolygraphApiError(
      "http",
      errBody.error ?? "polygraph.so rejected the server_ref as malformed.",
      400,
    );
  }

  if (!res.ok) {
    throw new PolygraphApiError(
      "http",
      `polygraph.so returned ${res.status}.`,
      res.status,
    );
  }

  return readJson<GradeRequestResponse>(res);
}

export async function getList(): Promise<ListResponse> {
  const url = `${apiBaseUrl()}/api/cli/list`;
  let res: Response;
  try {
    res = await fetch(url, { method: "GET" });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    throw new PolygraphApiError("network", `couldn't reach polygraph.so (${msg}).`);
  }

  if (!res.ok) {
    throw new PolygraphApiError(
      "http",
      `polygraph.so returned ${res.status}.`,
      res.status,
    );
  }

  return readJson<ListResponse>(res);
}
