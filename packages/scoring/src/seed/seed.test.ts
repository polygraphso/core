import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { parse } from "yaml";
import { validateSeed } from "./seed.js";

describe("validateSeed", () => {
  it("accepts scoped npm, unscoped npm, and pypi entries", () => {
    const rows = validateSeed([
      { registry: "npm", owner: "@modelcontextprotocol", name: "server-filesystem" },
      { registry: "npm", name: "lodash" },
      { registry: "pypi", name: "mcp-server-git" },
    ]);
    expect(rows).toHaveLength(3);
    expect(rows[1]).toEqual({ registry: "npm", owner: null, name: "lodash" });
  });

  it("rejects unscoped github (owner required)", () => {
    expect(() => validateSeed([{ registry: "github", name: "foo" }])).toThrow(/github requires/);
  });

  it("rejects pypi with owner (flat namespace)", () => {
    expect(() => validateSeed([{ registry: "pypi", owner: "anyone", name: "foo" }])).toThrow(
      /pypi packages must not have an owner/,
    );
  });

  it("rejects unknown registry", () => {
    expect(() => validateSeed([{ registry: "cargo", name: "serde" }])).toThrow(/invalid registry/);
  });

  it("rejects duplicates", () => {
    expect(() =>
      validateSeed([
        { registry: "npm", owner: "@x", name: "y" },
        { registry: "npm", owner: "@x", name: "y" },
      ]),
    ).toThrow(/duplicate/);
  });

  it("rejects missing name", () => {
    expect(() => validateSeed([{ registry: "npm", owner: "@x", name: "" }])).toThrow(/name/);
  });
});

describe("servers.yaml", () => {
  const path = fileURLToPath(new URL("./servers.yaml", import.meta.url));
  const parsed = parse(readFileSync(path, "utf-8")) as { servers: unknown[] };

  it("parses and validates without errors", () => {
    expect(parsed.servers).toBeInstanceOf(Array);
    expect(validateSeed(parsed.servers as Parameters<typeof validateSeed>[0])).toHaveLength(
      parsed.servers.length,
    );
  });

  it("has at least the brief's floor of 30 entries", () => {
    expect(parsed.servers.length).toBeGreaterThanOrEqual(30);
  });
});
