import { describe, it, expect } from "vitest";

import { isRemoteKey, refToPath } from "./serverRef";

describe("isRemoteKey", () => {
  it("is true for https/http endpoint keys", () => {
    expect(isRemoteKey("https://mcp.example.com")).toBe(true);
    expect(isRemoteKey("http://mcp.example.com")).toBe(true);
  });

  it("is false for registry keys", () => {
    expect(isRemoteKey("npm/@scope/server")).toBe(false);
    expect(isRemoteKey("pypi/mcp-server-git")).toBe(false);
  });
});

describe("refToPath", () => {
  it("passes a registry key through unchanged", () => {
    expect(refToPath("npm/@scope/server")).toBe("npm/@scope/server");
  });

  it("collapses a remote URL's :// so it survives the catch-all path", () => {
    expect(refToPath("https://mcp.example.com")).toBe("https/mcp.example.com");
    expect(refToPath("http://mcp.example.com/sse")).toBe("http/mcp.example.com/sse");
  });
});
