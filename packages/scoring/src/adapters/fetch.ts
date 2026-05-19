/**
 * Fetch helper with retry, timeout, and 429 backoff. Lifted from
 * agentic-talent-app/web/src/lib/pipeline/fetch-utils.ts, the-graph-specific
 * URL redaction removed (we don't use that gateway).
 *
 * Adapters use this for every HTTP call so retry/backoff/timeout semantics
 * are uniform. Pass `passThroughStatuses: [404]` when 404 means "no data"
 * rather than an error worth retrying — saves ~6 seconds of exponential
 * backoff per missing package.
 */

export interface FetchOptions extends RequestInit {
  timeoutMs?: number;
  retries?: number;
  label?: string;
  passThroughStatuses?: number[];
}

const DEFAULT_TIMEOUT_MS = 10_000;
const DEFAULT_RETRIES = 3;

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export async function fetchWithRetry(
  url: string,
  options: FetchOptions = {},
): Promise<Response> {
  const {
    timeoutMs = DEFAULT_TIMEOUT_MS,
    retries = DEFAULT_RETRIES,
    label = "fetch",
    passThroughStatuses = [],
    ...fetchOptions
  } = options;

  const start = Date.now();

  for (let attempt = 1; attempt <= retries; attempt++) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);

    try {
      const res = await fetch(url, { ...fetchOptions, signal: controller.signal });
      clearTimeout(timer);

      const elapsed = Date.now() - start;

      if (res.ok) {
        console.log(`[${label}] ${url} OK (${elapsed}ms${attempt > 1 ? `, attempt ${attempt}` : ""})`);
        return res;
      }

      if (passThroughStatuses.includes(res.status)) {
        console.log(`[${label}] ${url} ${res.status} pass-through (${elapsed}ms)`);
        return res;
      }

      if (res.status === 429 && attempt < retries) {
        // npm's downloads API returns `Retry-After: 0` even when it's
        // actively rate-limiting (observed in the 14:50 scoring-run log).
        // Taking that literally led to retry storms — 3 attempts within
        // ~250ms that all 429'd. Floor the wait at the exponential
        // backoff so the retry actually does something.
        const retryAfter = res.headers.get("retry-after");
        const retryAfterMs = retryAfter ? Math.max(0, Number(retryAfter)) * 1000 : 0;
        const backoffMs = 2 ** attempt * 1000; // 2s, 4s, 8s...
        const waitMs = Math.max(retryAfterMs, backoffMs);
        console.log(`[${label}] ${url} RETRY (429, waiting ${waitMs}ms)`);
        await sleep(waitMs);
        continue;
      }

      console.error(`[${label}] ${url} ERROR ${res.status} (${elapsed}ms)`);
      throw new Error(`HTTP ${res.status}: ${res.statusText}`);
    } catch (err) {
      clearTimeout(timer);
      if (attempt === retries) throw err;

      const waitMs = 2 ** attempt * 1000;
      const isAbort = err instanceof Error && err.name === "AbortError";
      console.log(`[${label}] ${url} ${isAbort ? "TIMEOUT" : "RETRY"} (attempt ${attempt}, waiting ${waitMs}ms)`);
      await sleep(waitMs);
    }
  }

  throw new Error(`[${label}] All ${retries} attempts failed for ${url}`);
}

/** Courtesy delay between successive requests to the same API. */
export function rateLimitDelay(ms: number): Promise<void> {
  return sleep(ms);
}
