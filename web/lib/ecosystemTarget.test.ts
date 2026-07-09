import { describe, it, expect } from "vitest";
import { parseEcosystemTarget } from "./ecosystemTarget";

describe("parseEcosystemTarget — MCP", () => {
  it("collapses a scoped npm ref to its versionless key", () => {
    const r = parseEcosystemTarget("npm/@printr/mcp@1.2.3", "mcp");
    expect(r).toEqual({ target: "npm/@printr/mcp", targetKind: "registry_ref", displayName: "npm/@printr/mcp" });
  });

  it("keeps an https endpoint as a remote_url", () => {
    const r = parseEcosystemTarget("https://mcp.flaunch.gg/", "mcp");
    expect(r).toMatchObject({ target: "https://mcp.flaunch.gg/", targetKind: "remote_url" });
  });

  it("accepts a github repo ref as a registry_ref", () => {
    const r = parseEcosystemTarget("github/KyberNetwork/kyberswap-mcp", "mcp");
    expect(r).toMatchObject({ target: "github/KyberNetwork/kyberswap-mcp", targetKind: "registry_ref" });
  });

  it("rejects a non-ref string with a user-facing message", () => {
    const r = parseEcosystemTarget("just some text", "mcp");
    expect(r).toHaveProperty("error");
  });
});

describe("parseEcosystemTarget — skill", () => {
  it("canonicalizes a GitHub SKILL.md URL to a #subpath ref", () => {
    const r = parseEcosystemTarget(
      "https://github.com/Uniswap/uniswap-ai/blob/main/packages/plugins/v4-hook-generator/SKILL.md",
      "skill",
    );
    expect(r).toEqual({
      target: "github/Uniswap/uniswap-ai#packages/plugins/v4-hook-generator",
      targetKind: "skill",
      displayName: "packages/plugins/v4-hook-generator",
    });
  });

  it("passes through an already-canonical ref", () => {
    const r = parseEcosystemTarget("github/BankrBot/skills#bankr-twitter-agent", "skill");
    expect(r).toMatchObject({ target: "github/BankrBot/skills#bankr-twitter-agent", targetKind: "skill" });
  });

  it("accepts a repo-level skill ref (no subpath)", () => {
    const r = parseEcosystemTarget("github/owner/repo", "skill");
    expect(r).toMatchObject({ target: "github/owner/repo", targetKind: "skill", displayName: "repo" });
  });

  it("rejects a non-github skill input", () => {
    const r = parseEcosystemTarget("npm/not-a-skill", "skill");
    expect(r).toHaveProperty("error");
  });
});

describe("parseEcosystemTarget — guards", () => {
  it("rejects empty input", () => {
    expect(parseEcosystemTarget("   ", "mcp")).toHaveProperty("error");
  });

  it("rejects over-long input", () => {
    expect(parseEcosystemTarget("x".repeat(513), "mcp")).toHaveProperty("error");
  });
});
