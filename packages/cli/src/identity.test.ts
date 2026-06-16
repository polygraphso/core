import { describe, expect, it } from "vitest";

import { RefParseError, canonicalRef, parseRef } from "./identity.js";

describe("parseRef", () => {
  it("parses scoped npm with version", () => {
    expect(parseRef("npm/@modelcontextprotocol/server-filesystem@0.4.2")).toEqual({
      registry: "npm",
      owner: "@modelcontextprotocol",
      name: "server-filesystem",
      version: "0.4.2",
    });
  });

  it("parses unscoped npm without version", () => {
    expect(parseRef("npm/lodash")).toEqual({
      registry: "npm",
      owner: null,
      name: "lodash",
      version: null,
    });
  });

  it("parses pypi flat names", () => {
    expect(parseRef("pypi/mcp-server-git@1.0.0")).toEqual({
      registry: "pypi",
      owner: null,
      name: "mcp-server-git",
      version: "1.0.0",
    });
  });

  it("parses github owner/repo", () => {
    expect(parseRef("github/anthropic/mcp-server-foo@v0.1.3")).toEqual({
      registry: "github",
      owner: "anthropic",
      name: "mcp-server-foo",
      version: "v0.1.3",
    });
  });

  it("rejects unprefixed input", () => {
    expect(() => parseRef("lodash")).toThrow(RefParseError);
  });

  it("rejects unknown registry", () => {
    expect(() => parseRef("crates/serde")).toThrow(/unknown registry/);
  });

  it("rejects github without owner", () => {
    expect(() => parseRef("github/just-a-repo")).toThrow(/owner/);
  });
});

describe("canonicalRef", () => {
  it("includes the npm scope as owner", () => {
    expect(
      canonicalRef({ registry: "npm", owner: "@modelcontextprotocol", name: "server-filesystem" }),
    ).toBe("npm/@modelcontextprotocol/server-filesystem");
  });

  it("omits owner for unscoped npm", () => {
    expect(canonicalRef({ registry: "npm", owner: null, name: "lodash" })).toBe("npm/lodash");
  });

  it("omits owner for pypi", () => {
    expect(canonicalRef({ registry: "pypi", owner: null, name: "mcp-server-git" })).toBe(
      "pypi/mcp-server-git",
    );
  });
});
