import { describe, it, expect } from "vitest";
import { looksLikeMcpPackage } from "@/lib/mcpHeuristic";

describe("looksLikeMcpPackage", () => {
  it("accepts a package whose name carries an mcp/server token", () => {
    expect(looksLikeMcpPackage("npm/tavily-mcp")).toBe(true);
    expect(looksLikeMcpPackage("pypi/mcp-server-git")).toBe(true);
    expect(looksLikeMcpPackage("npm/some-mcp-server")).toBe(true);
  });

  it("reads the token from any scope or name segment", () => {
    expect(looksLikeMcpPackage("npm/@upstash/context7-mcp")).toBe(true);
    expect(looksLikeMcpPackage("npm/@modelcontextprotocol/server-git")).toBe(true);
  });

  it("rejects a real-but-not-MCP package (npm/context)", () => {
    expect(looksLikeMcpPackage("npm/context")).toBe(false);
    expect(looksLikeMcpPackage("npm/react")).toBe(false);
    expect(looksLikeMcpPackage("npm/@scope/utils")).toBe(false);
  });

  it("rejects a nonexistent / nonsense ref (npm/benfica)", () => {
    expect(looksLikeMcpPackage("npm/benfica")).toBe(false);
  });

  it("does not false-positive on a substring (observer contains 'server')", () => {
    expect(looksLikeMcpPackage("npm/observer")).toBe(false);
    expect(looksLikeMcpPackage("npm/mcpr")).toBe(false);
  });
});
