import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { fetchSmithery } from "./smithery.js";

function jsonResponse(body: unknown): Response {
  return new Response(JSON.stringify(body), {
    status: 200,
    headers: { "content-type": "application/json" },
  });
}

describe("fetchSmithery", () => {
  beforeEach(() => {
    vi.spyOn(console, "log").mockImplementation(() => {});
    vi.spyOn(console, "error").mockImplementation(() => {});
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("hits the search endpoint and returns the exact-match entry's useCount", async () => {
    const fetchMock = vi.fn(async (_url: string, _init?: RequestInit) =>
      jsonResponse({
        servers: [
          {
            qualifiedName: "notion",
            useCount: 3221,
            verified: true,
            isDeployed: true,
            createdAt: "2025-08-25T16:33:17Z",
          },
          // Non-matching results that share substring should be ignored.
          { qualifiedName: "node2flow/notion", useCount: 99, verified: false },
        ],
      }),
    );
    vi.stubGlobal("fetch", fetchMock);

    const result = await fetchSmithery("notion");
    expect(result).toEqual({
      qualified_name: "notion",
      use_count: 3221,
      verified: true,
      is_deployed: true,
      smithery_created_at: "2025-08-25T16:33:17Z",
    });

    const call = fetchMock.mock.calls[0];
    expect(String(call?.[0])).toContain("/servers?q=notion");
    const headers = (call?.[1] as RequestInit | undefined)?.headers as
      | Record<string, string>
      | undefined;
    expect(headers?.["User-Agent"]).toMatch(/Mozilla\/5\.0/);
  });

  it("returns null when no result's qualifiedName matches exactly (no fuzzy fallback)", async () => {
    // Search may return near-misses for unrelated queries; we must reject
    // them. Silent false positives are unacceptable for trust-grading data.
    vi.stubGlobal(
      "fetch",
      vi.fn(async () =>
        jsonResponse({
          servers: [
            { qualifiedName: "node2flow/slack", useCount: 99 },
            { qualifiedName: "some-other/slack-tool", useCount: 5 },
          ],
        }),
      ),
    );
    expect(await fetchSmithery("slack")).toBeNull();
  });

  it("returns null when the search response is empty", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => jsonResponse({ servers: [] })));
    expect(await fetchSmithery("@nobody/missing-server")).toBeNull();
  });

  it("URL-encodes the query for qualifiedNames containing scopes", async () => {
    const fetchMock = vi.fn(async (_url: string, _init?: RequestInit) =>
      jsonResponse({
        servers: [
          {
            qualifiedName: "upstash/context7-mcp",
            useCount: 11084,
            verified: true,
          },
        ],
      }),
    );
    vi.stubGlobal("fetch", fetchMock);

    const result = await fetchSmithery("upstash/context7-mcp");
    expect(result?.use_count).toBe(11084);
    // Slash gets percent-encoded; the substring after q= should be the
    // encoded form.
    expect(String(fetchMock.mock.calls[0]?.[0])).toContain("q=upstash%2Fcontext7-mcp");
  });
});
