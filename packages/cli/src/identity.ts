/**
 * Slim parser for registry-prefixed server refs.
 *
 * Vendored from @polygraph/core so the published `polygraph` package has
 * zero runtime dependencies. Kept narrower than the core helper: the CLI
 * only needs to reject obviously-malformed input and recover the canonical
 * registry/owner/name segments to send to the API.
 */

export type Registry = "npm" | "pypi" | "github";

const REGISTRIES = new Set<Registry>(["npm", "pypi", "github"]);

export interface ParsedRef {
  registry: Registry;
  owner: string | null;
  name: string;
  /** Version pinned after the final `@`, if any (null = bare ref). */
  version: string | null;
}

export class RefParseError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "RefParseError";
  }
}

export function parseRef(ref: string): ParsedRef {
  const firstSlash = ref.indexOf("/");
  if (firstSlash === -1) {
    throw new RefParseError("expected `<registry>/<path>`");
  }
  const registry = ref.slice(0, firstSlash);
  if (!REGISTRIES.has(registry as Registry)) {
    throw new RefParseError(
      `unknown registry "${registry}" (expected one of: ${[...REGISTRIES].join(", ")})`,
    );
  }
  const rest = ref.slice(firstSlash + 1);

  // Split off an optional version suffix (after the final `@`, but not the
  // leading `@` of an npm scope at position 0).
  const versionAt = rest.lastIndexOf("@");
  const pathPart = versionAt > 0 ? rest.slice(0, versionAt) : rest;
  const version = versionAt > 0 ? rest.slice(versionAt + 1) || null : null;

  const lastSlash = pathPart.lastIndexOf("/");
  let owner: string | null;
  let name: string;
  if (lastSlash === -1) {
    if (registry === "github") {
      throw new RefParseError("github requires `<owner>/<repo>`");
    }
    owner = null;
    name = pathPart;
  } else {
    owner = pathPart.slice(0, lastSlash);
    name = pathPart.slice(lastSlash + 1);
  }
  if (!name) throw new RefParseError("empty name segment");
  if (lastSlash !== -1 && !owner) throw new RefParseError("empty owner segment");

  return { registry: registry as Registry, owner, name, version };
}

/** Versionless canonical key — what the API and `notify_url` use. */
export function canonicalRef(parts: ParsedRef): string {
  return parts.owner
    ? `${parts.registry}/${parts.owner}/${parts.name}`
    : `${parts.registry}/${parts.name}`;
}
