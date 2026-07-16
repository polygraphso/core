import { describe, it, expect, vi } from "vitest";

import { verifyRunnable } from "./verifyRunnable";

describe("verifyRunnable", () => {
  it("trusts an https:// remote target without probing a registry", async () => {
    const probe = vi.fn();
    const result = await verifyRunnable(
      { target: "https://mcp.example.com/sse", kind: "remote_url" },
      probe,
    );
    expect(result).toEqual({ ok: true, target: "https://mcp.example.com/sse" });
    expect(probe).not.toHaveBeenCalled();
  });

  it("accepts an npm ref that exists on the registry", async () => {
    const probe = vi.fn().mockResolvedValue(true);
    const result = await verifyRunnable(
      { target: "npm/@scope/server", kind: "registry_ref" },
      probe,
    );
    expect(result).toEqual({ ok: true, target: "npm/@scope/server" });
    expect(probe).toHaveBeenCalledWith("npm", "@scope/server");
  });

  it("rejects an npm ref that does not exist, naming the package", async () => {
    const probe = vi.fn().mockResolvedValue(false);
    const result = await verifyRunnable(
      { target: "npm/nope-not-real", kind: "registry_ref" },
      probe,
    );
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.reason).toContain("nope-not-real");
  });

  it("accepts a pypi ref that exists", async () => {
    const probe = vi.fn().mockResolvedValue(true);
    const result = await verifyRunnable(
      { target: "pypi/mcp-server-git", kind: "registry_ref" },
      probe,
    );
    expect(result).toEqual({ ok: true, target: "pypi/mcp-server-git" });
    expect(probe).toHaveBeenCalledWith("pypi", "mcp-server-git");
  });

  it("rejects a pypi ref that does not exist", async () => {
    const probe = vi.fn().mockResolvedValue(false);
    const result = await verifyRunnable(
      { target: "pypi/nope", kind: "registry_ref" },
      probe,
    );
    expect(result.ok).toBe(false);
  });

  it("accepts a github repo that exists AND is Node/Python-packaged", async () => {
    const probe = vi.fn().mockResolvedValue(true); // exists + gradeable
    const result = await verifyRunnable(
      { target: "github/owner/node-mcp", kind: "registry_ref" },
      probe,
    );
    expect(result).toEqual({ ok: true, target: "github/owner/node-mcp" });
    expect(probe).toHaveBeenCalledWith("github", "owner/node-mcp");
    expect(probe).toHaveBeenCalledWith("github-gradeable", "owner/node-mcp");
  });

  it("rejects a github repo that does not exist, naming it — without the gradeable probe", async () => {
    const probe = vi.fn().mockResolvedValue(false);
    const result = await verifyRunnable(
      { target: "github/owner/nope-not-real", kind: "registry_ref" },
      probe,
    );
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.reason).toContain("owner/nope-not-real");
    expect(probe).not.toHaveBeenCalledWith("github-gradeable", expect.anything());
  });

  it("rejects a github repo that exists but is not Node/Python (the Go-repo case)", async () => {
    // exists → true; gradeable → false (e.g. a go.mod-only repo).
    const probe = vi.fn(async (registry: string) => registry !== "github-gradeable");
    const result = await verifyRunnable(
      { target: "github/snyk/studio-mcp", kind: "registry_ref" },
      probe,
    );
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.reason).toContain("Node or Python");
      expect(result.reason).toContain("snyk/studio-mcp");
    }
  });

  it("trusts a github skill ref without probing a registry", async () => {
    const probe = vi.fn();
    const result = await verifyRunnable(
      { target: "github/polygraphso/litmus#plugins/polygraph/skills/polygraph", kind: "skill" },
      probe,
    );
    expect(result).toEqual({
      ok: true,
      target: "github/polygraphso/litmus#plugins/polygraph/skills/polygraph",
    });
    expect(probe).not.toHaveBeenCalled();
  });
});
