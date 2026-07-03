import { describe, it, expect } from "vitest";

import { parseGradeTarget } from "./gradeTarget";

describe("parseGradeTarget", () => {
  it("normalizes a registry ref to its versionless server key", () => {
    expect(parseGradeTarget("npm/lodash")).toEqual({
      target: "npm/lodash",
      kind: "registry_ref",
    });
  });

  it("strips a pinned version from a scoped registry ref", () => {
    expect(
      parseGradeTarget("npm/@modelcontextprotocol/server-filesystem@1.2.3"),
    ).toEqual({
      target: "npm/@modelcontextprotocol/server-filesystem",
      kind: "registry_ref",
    });
  });

  it("accepts an https:// MCP URL as a remote target", () => {
    const result = parseGradeTarget("https://mcp.example.com/sse");
    expect(result).toEqual({
      target: "https://mcp.example.com/sse",
      kind: "remote_url",
    });
  });

  it("rejects a non-https URL", () => {
    const result = parseGradeTarget("http://mcp.example.com/sse");
    expect("error" in result).toBe(true);
  });

  it("rejects unparseable input with a helpful error", () => {
    const result = parseGradeTarget("not a real ref");
    expect(result).toHaveProperty("error");
  });
});
