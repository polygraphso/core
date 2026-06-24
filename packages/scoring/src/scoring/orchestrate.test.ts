// packages/scoring/src/scoring/orchestrate.test.ts
import { describe, it, expect, vi } from "vitest";
import { tryAdapter } from "./orchestrate.js";

describe("tryAdapter", () => {
  it("returns the adapter's value when it resolves", async () => {
    const result = await tryAdapter("npm", "npm/some-pkg", () => Promise.resolve({ downloads: 42 }));
    expect(result).toEqual({ downloads: 42 });
  });

  it("returns null and logs a warning when the adapter throws", async () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    const result = await tryAdapter("glama", "npm/context7-mcp", () =>
      Promise.reject(new Error("This operation was aborted")),
    );
    expect(result).toBeNull();
    expect(warn).toHaveBeenCalledWith(
      expect.stringContaining("adapter glama failed for npm/context7-mcp"),
    );
    expect(warn).toHaveBeenCalledWith(expect.stringContaining("degraded to absent"));
    warn.mockRestore();
  });

  it("returns null on a 429-style error without propagating", async () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    const result = await tryAdapter("pypi", "pypi/mcp-server-fetch", () =>
      Promise.reject(new Error("HTTP 429: Too Many Requests")),
    );
    expect(result).toBeNull();
    expect(warn).toHaveBeenCalledWith(expect.stringContaining("HTTP 429"));
    warn.mockRestore();
  });

  it("passes through a null return from the adapter (404 / no-data case)", async () => {
    const result = await tryAdapter("depsdev", "npm/some-pkg", () => Promise.resolve(null));
    expect(result).toBeNull();
  });
});
