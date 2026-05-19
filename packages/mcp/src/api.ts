/**
 * HTTP client for the polygraph.so public CLI API.
 *
 * Override priority:
 *   1. `POLYGRAPH_API_URL` — full base URL, e.g. http://localhost:3000
 *   2. Default — https://polygraph.so
 *
 * Endpoints (already shipped; see web/app/api/cli/):
 *   POST /api/cli/check  → { server_ref } → tracked | not_available
 *   GET  /api/cli/list   → { servers, total }
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

export interface CheckResponseTracked {
  status: "tracked";
  adoption_tier: "top10" | "top25" | "top50" | "top100" | null;
  polygraph: unknown;
  notify_url: string;
}

export interface CheckResponseNotAvailable {
  status: "not_available";
  notify_url: string;
}

export type CheckResponse = CheckResponseTracked | CheckResponseNotAvailable;

export interface ListEntry {
  server_ref: string;
  adoption_tier: "top10" | "top25" | "top50" | "top100" | null;
  polygraph: null | "pending" | "A" | "B" | "C" | "D" | "F";
}

export interface ListResponse {
  servers: ListEntry[];
  total: number;
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
