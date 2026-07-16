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

  it("classifies a github blob SKILL.md URL as a skill, canonicalized", () => {
    // The exact form that was queued as a remote server and failed to grade.
    expect(
      parseGradeTarget(
        "https://github.com/polygraphso/litmus/blob/main/plugins/polygraph/skills/polygraph/SKILL.md",
      ),
    ).toEqual({
      target: "github/polygraphso/litmus#plugins/polygraph/skills/polygraph",
      kind: "skill",
    });
  });

  it("classifies a github tree URL (skill folder) as a skill", () => {
    expect(
      parseGradeTarget("https://github.com/anthropics/skills/tree/main/pdf"),
    ).toEqual({ target: "github/anthropics/skills#pdf", kind: "skill" });
  });

  it("classifies an already-canonical github skill ref as a skill", () => {
    expect(parseGradeTarget("github/anthropics/skills#pdf")).toEqual({
      target: "github/anthropics/skills#pdf",
      kind: "skill",
    });
  });

  it("keeps a bare github/owner/repo a registry_ref (a server, not a skill)", () => {
    // No subpath → ambiguous with a github MCP server; the server reading wins,
    // matching the monitor funnel. Only a `#`-scoped ref is a skill.
    expect(parseGradeTarget("github/owner/repo")).toEqual({
      target: "github/owner/repo",
      kind: "registry_ref",
    });
  });

  // Registry PAGE URLs name a package — graded as that package (full sandbox),
  // never as a remote endpoint (which would wrongly cap at B).
  it("collapses an npmjs.com package URL to its npm ref", () => {
    expect(parseGradeTarget("https://www.npmjs.com/package/oathe-mcp")).toEqual({
      target: "npm/oathe-mcp",
      kind: "registry_ref",
    });
  });

  it("collapses a scoped npmjs.com package URL with a version to the versionless key", () => {
    expect(
      parseGradeTarget("https://www.npmjs.com/package/@scope/some-mcp/v/1.2.3"),
    ).toEqual({ target: "npm/@scope/some-mcp", kind: "registry_ref" });
  });

  it("collapses a pypi.org project URL to its pypi ref", () => {
    expect(parseGradeTarget("https://pypi.org/project/mcp-server-git/")).toEqual({
      target: "pypi/mcp-server-git",
      kind: "registry_ref",
    });
  });

  it("collapses a bare github.com repo URL to its github ref", () => {
    expect(parseGradeTarget("https://github.com/owner/repo")).toEqual({
      target: "github/owner/repo",
      kind: "registry_ref",
    });
    expect(parseGradeTarget("https://github.com/owner/repo.git")).toEqual({
      target: "github/owner/repo",
      kind: "registry_ref",
    });
  });

  it("still treats a non-registry https URL as a remote endpoint", () => {
    expect(parseGradeTarget("https://mcp.example.com/mcp")).toEqual({
      target: "https://mcp.example.com/mcp",
      kind: "remote_url",
    });
  });
});
