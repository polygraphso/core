import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { handleRequestGrade } from "./request.js";

describe("handleRequestGrade", () => {
  let fetchMock: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("queues the request and forwards the caller's agent id", async () => {
    fetchMock.mockResolvedValueOnce({
      ok: true,
      status: 200,
      json: async () => ({ status: "queued", created: true, demand: 1 }),
    } as Response);

    const result = await handleRequestGrade(
      { server_ref: "npm/foo-mcp" },
      "claude-ai/1.2.0",
    );

    expect(result.isError).toBeUndefined();
    expect(result.structuredContent).toMatchObject({ status: "queued", created: true });
    const [, init] = fetchMock.mock.calls[0]!;
    expect(JSON.parse((init as RequestInit).body as string)).toEqual({
      server_ref: "npm/foo-mcp",
      source: "mcp",
      agent_id: "claude-ai/1.2.0",
    });
  });

  it("works without a known agent id (omits it from the request)", async () => {
    fetchMock.mockResolvedValueOnce({
      ok: true,
      status: 200,
      json: async () => ({ status: "queued", created: false, demand: 2 }),
    } as Response);

    const result = await handleRequestGrade({ server_ref: "npm/foo-mcp" });

    expect(result.isError).toBeUndefined();
    const [, init] = fetchMock.mock.calls[0]!;
    expect(JSON.parse((init as RequestInit).body as string)).toEqual({
      server_ref: "npm/foo-mcp",
      source: "mcp",
    });
  });

  it("returns an MCP error result on network failure rather than throwing", async () => {
    fetchMock.mockRejectedValueOnce(new TypeError("offline"));
    const result = await handleRequestGrade({ server_ref: "npm/foo-mcp" });
    expect(result.isError).toBe(true);
    expect(result.content[0]!.text.toLowerCase()).toContain("couldn't reach polygraph.so");
  });

  it("surfaces the API's 400 message verbatim", async () => {
    fetchMock.mockResolvedValueOnce({
      ok: false,
      status: 400,
      json: async () => ({ error: "server_ref is required." }),
    } as Response);

    const result = await handleRequestGrade({ server_ref: "garbage" });
    expect(result.isError).toBe(true);
    expect(result.content[0]!.text).toContain("server_ref is required.");
  });
});
