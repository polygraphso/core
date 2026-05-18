import { describe, it, expect } from "vitest";
import { parseServerRef, formatServerRef, serverKey, ServerRefParseError } from "./identity.js";

describe("parseServerRef", () => {
  it("parses a scoped npm ref with version", () => {
    expect(parseServerRef("npm/@modelcontextprotocol/server-filesystem@0.4.2")).toEqual({
      registry: "npm",
      owner: "@modelcontextprotocol",
      name: "server-filesystem",
      version: "0.4.2",
    });
  });

  it("parses a scoped npm ref without version", () => {
    expect(parseServerRef("npm/@modelcontextprotocol/server-filesystem")).toEqual({
      registry: "npm",
      owner: "@modelcontextprotocol",
      name: "server-filesystem",
      version: null,
    });
  });

  it("parses an unscoped npm ref with version", () => {
    expect(parseServerRef("npm/lodash@4.17.21")).toEqual({
      registry: "npm",
      owner: null,
      name: "lodash",
      version: "4.17.21",
    });
  });

  it("parses an unscoped npm ref without version", () => {
    expect(parseServerRef("npm/lodash")).toEqual({
      registry: "npm",
      owner: null,
      name: "lodash",
      version: null,
    });
  });

  it("parses a github ref", () => {
    expect(parseServerRef("github/anthropic/mcp-server-foo@v0.1.3")).toEqual({
      registry: "github",
      owner: "anthropic",
      name: "mcp-server-foo",
      version: "v0.1.3",
    });
  });

  it("parses a pypi ref with version", () => {
    expect(parseServerRef("pypi/some-org/some-mcp@1.2.0")).toEqual({
      registry: "pypi",
      owner: "some-org",
      name: "some-mcp",
      version: "1.2.0",
    });
  });

  it("parses a pypi ref without version", () => {
    expect(parseServerRef("pypi/some-org/some-mcp")).toEqual({
      registry: "pypi",
      owner: "some-org",
      name: "some-mcp",
      version: null,
    });
  });

  it("rejects pypi without owner", () => {
    expect(() => parseServerRef("pypi/some-pkg@1.0.0")).toThrow(ServerRefParseError);
  });

  it("rejects github without owner", () => {
    expect(() => parseServerRef("github/some-repo")).toThrow(ServerRefParseError);
  });

  it("rejects an empty version after @", () => {
    expect(() => parseServerRef("npm/lodash@")).toThrow(ServerRefParseError);
  });

  it("rejects an unknown registry", () => {
    expect(() => parseServerRef("cargo/some/crate@1.0.0")).toThrow(ServerRefParseError);
  });

  it("rejects a ref with no slash", () => {
    expect(() => parseServerRef("lodash")).toThrow(ServerRefParseError);
  });
});

describe("formatServerRef", () => {
  it("round-trips a scoped npm ref", () => {
    const ref = "npm/@modelcontextprotocol/server-filesystem@0.4.2";
    expect(formatServerRef(parseServerRef(ref))).toBe(ref);
  });

  it("round-trips an unscoped npm ref", () => {
    const ref = "npm/lodash@4.17.21";
    expect(formatServerRef(parseServerRef(ref))).toBe(ref);
  });

  it("round-trips an unscoped npm ref without version", () => {
    const ref = "npm/lodash";
    expect(formatServerRef(parseServerRef(ref))).toBe(ref);
  });

  it("round-trips a github ref", () => {
    const ref = "github/anthropic/mcp-server-foo@v0.1.3";
    expect(formatServerRef(parseServerRef(ref))).toBe(ref);
  });

  it("round-trips a pypi ref", () => {
    const ref = "pypi/some-org/some-mcp@1.2.0";
    expect(formatServerRef(parseServerRef(ref))).toBe(ref);
  });
});

describe("serverKey", () => {
  it("returns the registry/owner/name triple for scoped npm", () => {
    expect(serverKey({ registry: "npm", owner: "@modelcontextprotocol", name: "server-filesystem" }))
      .toBe("npm/@modelcontextprotocol/server-filesystem");
  });

  it("omits the slash for unscoped npm", () => {
    expect(serverKey({ registry: "npm", owner: null, name: "lodash" })).toBe("npm/lodash");
  });

  it("returns the registry/owner/name triple for github", () => {
    expect(serverKey({ registry: "github", owner: "anthropic", name: "mcp-server-foo" }))
      .toBe("github/anthropic/mcp-server-foo");
  });
});
