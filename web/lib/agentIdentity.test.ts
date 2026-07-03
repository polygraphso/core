import { describe, it, expect } from "vitest";

import { resolveAgentIdentity } from "./agentIdentity";

describe("resolveAgentIdentity", () => {
  it("uses a client-supplied agent_id, splitting name/version", () => {
    const a = resolveAgentIdentity({
      agentId: "claude-code/2.1.199",
      source: "mcp",
      userAgent: "node",
    });
    expect(a).toMatchObject({
      agentId: "claude-code/2.1.199",
      name: "claude-code",
      version: "2.1.199",
      source: "mcp",
    });
  });

  it("handles an agent_id without a version", () => {
    const a = resolveAgentIdentity({ agentId: "my-agent", source: "cli" });
    expect(a).toMatchObject({ name: "my-agent", version: null, source: "cli" });
  });

  it("keeps validated meta and drops junk fields", () => {
    const a = resolveAgentIdentity({
      agentId: "claude-code/2.1",
      source: "mcp",
      agentMeta: {
        title: "Claude Code",
        websiteUrl: "https://claude.com/claude-code",
        capabilities: ["sampling", "roots", 42, { evil: true }],
        extra: "dropped",
      },
    });
    expect(a.meta).toEqual({
      title: "Claude Code",
      websiteUrl: "https://claude.com/claude-code",
      capabilities: ["sampling", "roots"],
    });
  });

  it("caps oversized meta strings and capability lists", () => {
    const a = resolveAgentIdentity({
      agentId: "x/1",
      source: "mcp",
      agentMeta: {
        description: "d".repeat(1000),
        capabilities: Array.from({ length: 30 }, (_, i) => `cap-${i}`),
      },
    });
    expect((a.meta?.description ?? "").length).toBeLessThanOrEqual(300);
    expect(a.meta?.capabilities?.length).toBeLessThanOrEqual(10);
  });

  it("falls back to a normalized User-Agent for raw callers", () => {
    const a = resolveAgentIdentity({ userAgent: "curl/8.6.0" });
    expect(a).toMatchObject({
      agentId: "ua:curl/8.6",
      name: "ua:curl",
      version: "8.6",
      source: "raw",
    });
  });

  it("takes only the first UA product token", () => {
    const a = resolveAgentIdentity({
      userAgent: "Mozilla/5.0 (Macintosh; Intel Mac OS X) Chrome/126.0",
    });
    expect(a.agentId).toBe("ua:Mozilla/5.0");
  });

  it("handles a missing or empty User-Agent", () => {
    expect(resolveAgentIdentity({}).agentId).toBe("ua:unknown");
    expect(resolveAgentIdentity({ userAgent: "  " }).agentId).toBe("ua:unknown");
  });

  it("treats an invalid source with an agent_id as 'cli'", () => {
    const a = resolveAgentIdentity({ agentId: "tool/1.0", source: "hacker" });
    expect(a.source).toBe("cli");
  });

  it("caps a hostile oversized agent_id", () => {
    const a = resolveAgentIdentity({ agentId: "n".repeat(500) + "/1.0", source: "mcp" });
    expect(a.agentId.length).toBeLessThanOrEqual(200);
  });
});
