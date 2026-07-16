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

  it("accepts a github repo that exists (the harness clones and runs it)", async () => {
    const probe = vi.fn().mockResolvedValue(true);
    const result = await verifyRunnable(
      { target: "github/snyk/studio-mcp", kind: "registry_ref" },
      probe,
    );
    expect(result).toEqual({ ok: true, target: "github/snyk/studio-mcp" });
    expect(probe).toHaveBeenCalledWith("github", "snyk/studio-mcp");
  });

  it("rejects a github repo that does not exist, naming it", async () => {
    const probe = vi.fn().mockResolvedValue(false);
    const result = await verifyRunnable(
      { target: "github/owner/nope-not-real", kind: "registry_ref" },
      probe,
    );
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.reason).toContain("owner/nope-not-real");
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
