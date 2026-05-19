import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { handleList } from "./list.js";

describe("handleList", () => {
  let fetchMock: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("returns the server list as a JSON content block", async () => {
    fetchMock.mockResolvedValueOnce({
      ok: true,
      status: 200,
      json: async () => ({
        servers: [
          {
            server_ref: "npm/@modelcontextprotocol/server-filesystem",
            adoption_tier: "top10",
            polygraph: null,
          },
        ],
        total: 1,
      }),
    } as Response);

    const result = await handleList();
    expect(result.isError).toBeUndefined();
    const body = JSON.parse(result.content[0]!.text);
    expect(body.total).toBe(1);
    expect(body.servers[0].server_ref).toBe(
      "npm/@modelcontextprotocol/server-filesystem",
    );
  });

  it("returns an MCP error result when polygraph.so is unreachable", async () => {
    fetchMock.mockRejectedValueOnce(new TypeError("offline"));
    const result = await handleList();
    expect(result.isError).toBe(true);
  });
});
