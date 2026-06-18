import "server-only";
import { getSupabaseAdmin } from "@/lib/supabase";

/**
 * Abuse controls for the anonymous API routes. Backed by the `rate_limit_hit`
 * RPC (a fixed-window counter in the shared DB) because the web layer is
 * serverless — an in-process counter wouldn't survive across instances.
 *
 * Fail-open by design: the limiter is a guardrail, not auth. If the DB is
 * unreachable the route's own RPC will fail anyway, so a limiter outage must not
 * be a second way to take the route down.
 */

export interface RateLimitRule {
  /** Max requests allowed per window for one bucket. */
  max: number;
  /** Window length in seconds. */
  windowSeconds: number;
}

/** Best-effort client IP from the proxy chain (first XFF hop, else x-real-ip). */
export function clientIp(request: Request): string {
  const xff = request.headers.get("x-forwarded-for");
  if (xff) {
    const first = xff.split(",")[0]?.trim();
    if (first) return first;
  }
  return request.headers.get("x-real-ip")?.trim() || "unknown";
}

/**
 * Record one hit for `bucket` and report whether the call is within the limit.
 * `bucket` should namespace the route and the subject, e.g. `notify:1.2.3.4`.
 * Returns true when ALLOWED, false when the limit is exceeded.
 */
export async function rateLimitOk(bucket: string, rule: RateLimitRule): Promise<boolean> {
  const db = getSupabaseAdmin();
  if (!db) return true; // unconfigured locally → don't block
  const { data, error } = await db.rpc("rate_limit_hit", {
    p_bucket: bucket,
    p_max: rule.max,
    p_window_seconds: rule.windowSeconds,
  });
  if (error) {
    console.error("[rateLimit] rate_limit_hit failed:", error.message);
    return true; // fail open — see module note
  }
  return data === true;
}

/**
 * Enforce a per-route, per-IP limit. Returns a 429 `Response` to return
 * directly when the caller is over the limit, or null to proceed. Emits a
 * structured `[rateLimit] blocked` line on rejection so write-volume spikes are
 * alertable from logs.
 */
export async function enforceRateLimit(
  request: Request,
  route: string,
  rule: RateLimitRule,
): Promise<Response | null> {
  const ip = clientIp(request);
  const ok = await rateLimitOk(`${route}:${ip}`, rule);
  if (ok) return null;
  console.warn(`[rateLimit] blocked route=${route} ip=${ip} limit=${rule.max}/${rule.windowSeconds}s`);
  return Response.json(
    { ok: false, message: "Too many requests. Please slow down and try again shortly." },
    { status: 429, headers: { "Retry-After": String(rule.windowSeconds) } },
  );
}

/**
 * Honeypot check for email-capture forms. A hidden field real users never fill;
 * a bot that fills every input trips it. We treat a tripped honeypot as a silent
 * success — return true and let the caller respond 200 WITHOUT writing, so the
 * bot gets no signal that it was caught. `value` is the submitted honeypot field.
 */
export function honeypotTripped(value: unknown): boolean {
  return typeof value === "string" && value.trim().length > 0;
}
