import { describe, it, expect, vi } from "vitest";
import { gateKnownMcp } from "@/lib/knownMcp";

const reg = (target: string) => ({ target, kind: "registry_ref" as const });

describe("gateKnownMcp", () => {
  it("passes a remote https endpoint without consulting the catalog", async () => {
    const isCataloged = vi.fn(async () => false);
    const r = await gateKnownMcp({ target: "https://mcp.example.com/mcp", kind: "remote_url" }, isCataloged);
    expect(r.ok).toBe(true);
    expect(isCataloged).not.toHaveBeenCalled();
  });

  it("passes an mcp/server-named package on the heuristic alone (no catalog hit needed)", async () => {
    const isCataloged = vi.fn(async () => false);
    const r = await gateKnownMcp(reg("npm/tavily-mcp"), isCataloged);
    expect(r.ok).toBe(true);
    expect(isCataloged).not.toHaveBeenCalled();
  });

  it("passes a plainly-named package only when it is a known catalog server", async () => {
    const isCataloged = vi.fn(async (ref: string) => ref === "npm/tavily");
    const r = await gateKnownMcp(reg("npm/tavily"), isCataloged);
    expect(r.ok).toBe(true);
    expect(isCataloged).toHaveBeenCalledWith("npm/tavily");
  });

  it("rejects a plainly-named package that is neither mcp-named nor catalogued", async () => {
    const isCataloged = vi.fn(async () => false);
    const r = await gateKnownMcp(reg("npm/context"), isCataloged);
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.reason).toMatch(/MCP server/i);
  });

  it("passes a github skill ref without consulting the catalog", async () => {
    const isCataloged = vi.fn(async () => false);
    const r = await gateKnownMcp(
      { target: "github/anthropics/skills#pdf", kind: "skill" },
      isCataloged,
    );
    expect(r.ok).toBe(true);
    expect(isCataloged).not.toHaveBeenCalled();
  });
});
