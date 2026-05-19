import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { handleCheck } from "./check.js";

describe("handleCheck", () => {
  let fetchMock: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("returns a JSON content block with the tracked payload", async () => {
    fetchMock.mockResolvedValueOnce({
      ok: true,
      status: 200,
      json: async () => ({
        status: "tracked",
        adoption_tier: "top25",
        polygraph: null,
        notify_url: "https://polygraph.so/notify?for=npm/lodash",
      }),
    } as Response);

    const result = await handleCheck({ server_ref: "npm/lodash" });
    expect(result.isError).toBeUndefined();
    expect(result.content).toHaveLength(1);
    expect(result.content[0]!.type).toBe("text");
    const body = JSON.parse(result.content[0]!.text);
    expect(body.status).toBe("tracked");
    expect(body.adoption_tier).toBe("top25");
    expect(result.structuredContent).toEqual(body);
  });

  it("returns an MCP error result on network failure rather than throwing", async () => {
    fetchMock.mockRejectedValueOnce(new TypeError("offline"));
    const result = await handleCheck({ server_ref: "npm/lodash" });
    expect(result.isError).toBe(true);
    expect(result.content[0]!.text.toLowerCase()).toContain("couldn't reach polygraph.so");
  });

  it("surfaces the API's 400 message verbatim", async () => {
    fetchMock.mockResolvedValueOnce({
      ok: false,
      status: 400,
      json: async () => ({ error: 'Invalid server ref "garbage"' }),
    } as Response);

    const result = await handleCheck({ server_ref: "garbage" });
    expect(result.isError).toBe(true);
    expect(result.content[0]!.text).toContain('Invalid server ref "garbage"');
  });
});
