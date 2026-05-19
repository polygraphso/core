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

  it("returns parsed adapter data for a registered server", async () => {
    const fetchMock = vi.fn(async (_url: string, _init?: RequestInit) =>
      jsonResponse({
        qualifiedName: "@modelcontextprotocol/server-filesystem",
        useCount: 4321,
        verified: true,
        isDeployed: true,
        createdAt: "2026-01-15T00:00:00Z",
      }),
    );
    vi.stubGlobal("fetch", fetchMock);

    const result = await fetchSmithery("@modelcontextprotocol/server-filesystem");
    expect(result).toEqual({
      qualified_name: "@modelcontextprotocol/server-filesystem",
      use_count: 4321,
      verified: true,
      is_deployed: true,
      smithery_created_at: "2026-01-15T00:00:00Z",
    });

    // Sanity check the browser-style headers (Smithery blocks bots).
    const call = fetchMock.mock.calls[0];
    const headers = (call?.[1] as RequestInit | undefined)?.headers as
      | Record<string, string>
      | undefined;
    expect(headers?.["User-Agent"]).toMatch(/Mozilla\/5\.0/);
  });

  it("returns null when the server isn't on Smithery", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => new Response("Not Found", { status: 404 })),
    );
    expect(await fetchSmithery("@nobody/missing-server")).toBeNull();
  });
});
