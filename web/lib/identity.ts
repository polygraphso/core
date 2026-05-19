/**
 * Slim parser for registry-prefixed server refs.
 *
 * Vendored from @polygraph/core. web/ is a standalone Vercel deploy target
 * (see web/pnpm-lock.yaml — separate from the root workspace lockfile),
 * so we can't depend on workspace packages from here. Source of truth for
 * the format is packages/core/src/identity.ts.
 */

export type Registry = "npm" | "pypi" | "github";

export type AdoptionTier = "top10" | "top25" | "top50" | "top100";

const REGISTRIES = new Set<Registry>(["npm", "pypi", "github"]);

export interface ParsedServerRef {
  registry: Registry;
  /** Null for unscoped npm and for all pypi refs; required for github. */
  owner: string | null;
  name: string;
  version: string | null;
}

export class ServerRefParseError extends Error {
  constructor(ref: string, reason: string) {
    super(`Invalid server ref "${ref}": ${reason}`);
    this.name = "ServerRefParseError";
  }
}

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
  let owner: string | null;
  let name: string;
  if (lastSlash === -1) {
    if (registry === "github") {
      throw new ServerRefParseError(ref, "github requires `{owner}/{repo}`");
    }
    owner = null;
    name = pathPart;
    if (!name) {
      throw new ServerRefParseError(ref, "empty name segment");
    }
  } else {
    owner = pathPart.slice(0, lastSlash);
    name = pathPart.slice(lastSlash + 1);
    if (!owner || !name) {
      throw new ServerRefParseError(ref, "empty owner or name segment");
    }
  }

  return { registry: registry as Registry, owner, name, version };
}

/** Identity of a server without a version pin. */
export function serverKey(parts: Pick<ParsedServerRef, "registry" | "owner" | "name">): string {
  return parts.owner
    ? `${parts.registry}/${parts.owner}/${parts.name}`
    : `${parts.registry}/${parts.name}`;
}
