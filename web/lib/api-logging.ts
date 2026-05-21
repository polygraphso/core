/**
 * withApiLogging(route, handler) — thin wrapper around an App Router
 * handler that records {route, method, status, latency_ms, user_agent}
 * into `api_logs` after the response is sent.
 *
 * Uses `next/server`'s `after()` so the DB insert never blocks the response.
 * If the insert fails, we log to the server console — losing a log row is
 * acceptable; failing a real CLI request because of it is not.
 *
 * Why per-route wrappers and not the proxy file:
 *   - Next 16 deprecated `middleware.ts` to `proxy.ts` and the framework
 *     guidance is to avoid it.
 *   - Proxy runs BEFORE the route, so it can't see the response status
 *     or compute true latency without re-wrapping the response stream.
 *   - The brief explicitly allows per-route wrappers as a fallback.
 *
 * No request bodies, no full user agents (truncated to 256 chars), no PII.
 */

import { after } from "next/server";
import { getSupabase } from "./supabase-server";

const UA_MAX = 256;

type HandlerArgs<TCtx> = TCtx extends undefined
  ? [Request]
  : [Request, TCtx];

type Handler<TCtx = undefined> = (
  ...args: HandlerArgs<TCtx>
) => Promise<Response> | Response;

interface LogRow {
  route: string;
  method: string;
  status: number;
  latency_ms: number;
  user_agent: string | null;
}

function truncateUA(ua: string | null): string | null {
  if (!ua) return null;
  return ua.length > UA_MAX ? ua.slice(0, UA_MAX) : ua;
}

async function writeLog(row: LogRow): Promise<void> {
  try {
    const supabase = getSupabase();
    const { error } = await supabase.from("api_logs").insert(row);
    if (error) {
      console.warn(`[api-logging] insert ${row.route}: ${error.message}`);
    }
  } catch (err) {
    console.warn(
      `[api-logging] insert ${row.route}: ${err instanceof Error ? err.message : String(err)}`,
    );
  }
}

export function withApiLogging<TCtx = undefined>(
  route: string,
  handler: Handler<TCtx>,
): Handler<TCtx> {
  return (async (...args: HandlerArgs<TCtx>) => {
    const [request] = args;
    const start = Date.now();
    const method = request.method;
    const user_agent = truncateUA(request.headers.get("user-agent"));

    let response: Response;
    let status: number;
    try {
      response = await handler(...args);
      status = response.status;
    } catch (err) {
      status = 500;
      after(() =>
        writeLog({
          route,
          method,
          status,
          latency_ms: Date.now() - start,
          user_agent,
        }),
      );
      throw err;
    }

    after(() =>
      writeLog({
        route,
        method,
        status,
        latency_ms: Date.now() - start,
        user_agent,
      }),
    );
    return response;
  }) as Handler<TCtx>;
}
