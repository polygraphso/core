import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { fetchWithRetry } from "./fetch.js";

describe("fetchWithRetry — 429 wait floor", () => {
  beforeEach(() => {
    vi.spyOn(console, "log").mockImplementation(() => {});
    vi.spyOn(console, "error").mockImplementation(() => {});
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("enforces the exponential-backoff floor when Retry-After is 0", async () => {
    // npm's downloads API was observed returning `Retry-After: 0` while
    // actively rate-limiting, which previously caused retry storms (3
    // attempts within ~250ms that all 429'd). The wait must be floored
    // at the exponential backoff so the retry actually does something.
    let attempts = 0;
    const startTimes: number[] = [];
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => {
        startTimes.push(Date.now());
        attempts++;
        if (attempts < 3) {
          return new Response("rate limited", {
            status: 429,
            headers: { "retry-after": "0" },
          });
        }
        return new Response(JSON.stringify({ ok: true }), { status: 200 });
      }),
    );

    const res = await fetchWithRetry("https://example.com", { label: "test" });
    expect(res.ok).toBe(true);
    expect(attempts).toBe(3);
    // First attempt → 429, wait at least 2^1 * 1000 = 2000ms.
    // Second attempt → 429, wait at least 2^2 * 1000 = 4000ms.
    expect(startTimes[1]! - startTimes[0]!).toBeGreaterThanOrEqual(1900); // tolerate ~100ms slop
    expect(startTimes[2]! - startTimes[1]!).toBeGreaterThanOrEqual(3900);
  }, 15_000); // generous timeout; default 5s would race the 4s backoff

  it("uses the larger of Retry-After and the backoff floor", async () => {
    let attempts = 0;
    const startTimes: number[] = [];
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => {
        startTimes.push(Date.now());
        attempts++;
        if (attempts === 1) {
          return new Response("rate limited", {
            status: 429,
            headers: { "retry-after": "5" }, // 5s > backoff floor (2s)
          });
        }
        return new Response(JSON.stringify({ ok: true }), { status: 200 });
      }),
    );

    await fetchWithRetry("https://example.com", { label: "test" });
    // Honored Retry-After: 5s, not the 2s floor.
    expect(startTimes[1]! - startTimes[0]!).toBeGreaterThanOrEqual(4900);
  }, 15_000);
});
