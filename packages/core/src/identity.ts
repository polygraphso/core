/**
 * Server-identity helpers for refs of the form `{registry}/{owner}/{name}@{version}`.
 *
 * Examples:
 *   npm/@modelcontextprotocol/server-filesystem@0.4.2
 *   github/anthropic/mcp-server-foo@v0.1.3
 *   pypi/some-org/some-mcp@1.2.0
 *
 * npm scopes are preserved (the `@` in `@modelcontextprotocol` belongs to the
 * scope, not the version delimiter).
 */

import type { Registry } from "./types.js";

export interface ParsedServerRef {
  registry: Registry;
  owner: string;
  name: string;
  version: string | null;
}

const REGISTRIES = new Set<Registry>(["npm", "pypi", "github"]);

export class ServerRefParseError extends Error {
  constructor(ref: string, reason: string) {
    super(`Invalid server ref "${ref}": ${reason}`);
    this.name = "ServerRefParseError";
  }
}

/**
 * Parse a server ref. Version is optional; if present it must follow the final `@`.
 * The owner segment may itself start with `@` (npm scope).
 */
export function parseServerRef(ref: string): ParsedServerRef {
  const firstSlash = ref.indexOf("/");
  if (firstSlash === -1) {
    throw new ServerRefParseError(ref, "expected `{registry}/...`");
  }
  const registry = ref.slice(0, firstSlash);
  if (!REGISTRIES.has(registry as Registry)) {
    throw new ServerRefParseError(
      ref,
      `unknown registry "${registry}" (expected one of: ${[...REGISTRIES].join(", ")})`,
    );
  }
  const rest = ref.slice(firstSlash + 1);

  // Strip the version suffix if present. Search from the right, but skip the
  // leading `@` of an npm scope (position 0).
  const versionAt = rest.lastIndexOf("@");
  let pathPart: string;
  let version: string | null;
  if (versionAt > 0) {
    pathPart = rest.slice(0, versionAt);
    version = rest.slice(versionAt + 1);
    if (version.length === 0) {
      throw new ServerRefParseError(ref, "empty version after `@`");
    }
  } else {
    pathPart = rest;
    version = null;
  }

  const lastSlash = pathPart.lastIndexOf("/");
  if (lastSlash === -1) {
    throw new ServerRefParseError(ref, "expected `{registry}/{owner}/{name}`");
  }
  const owner = pathPart.slice(0, lastSlash);
  const name = pathPart.slice(lastSlash + 1);
  if (!owner || !name) {
    throw new ServerRefParseError(ref, "empty owner or name segment");
  }

  return { registry: registry as Registry, owner, name, version };
}

export function formatServerRef(parts: ParsedServerRef): string {
  const base = `${parts.registry}/${parts.owner}/${parts.name}`;
  return parts.version ? `${base}@${parts.version}` : base;
}

/** Identity of a server without a version pin. */
export function serverKey(parts: Pick<ParsedServerRef, "registry" | "owner" | "name">): string {
  return `${parts.registry}/${parts.owner}/${parts.name}`;
}
