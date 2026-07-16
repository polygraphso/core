/**
 * Confirm a parsed grade target is actually *runnable* before we queue it.
 *
 * The request funnel lets a human type a free-form ref. `parseGradeTarget`
 * proves it's well-formed; this proves the harness could actually grade it:
 *   - https:// remote     → trusted (a live endpoint, graded up to B)
 *   - skill               → trusted (a github skill ref the runner clones + scans)
 *   - npm/… , pypi/…      → must exist on the registry (probe injected)
 *   - github/owner/repo   → the repo must exist (the harness clones, builds,
 *                           and runs github servers)
 *   - anything else       → not a runnable package
 *
 * The registry probe is injected so the branching logic stays unit-testable
 * without network. `checkRegistryExists` is the production implementation.
 */

const REGISTRY_TIMEOUT_MS = 4000;

export type RunnableCheck =
  | { ok: true; target: string }
  | { ok: false; reason: string };

/** Does `pkg` exist on `registry`? Injected so the logic is testable offline. */
export type RegistryProbe = (
  registry: "npm" | "pypi" | "github",
  pkg: string,
) => Promise<boolean>;

export async function verifyRunnable(
  parsed: { target: string; kind: "registry_ref" | "remote_url" | "skill" },
  probe: RegistryProbe,
): Promise<RunnableCheck> {
  // A remote endpoint or a github skill ref is trusted as-is: neither has a
  // registry to existence-check, and a bad URL/repo just fails the run later.
  if (parsed.kind === "remote_url" || parsed.kind === "skill") {
    return { ok: true, target: parsed.target };
  }

  if (parsed.target.startsWith("npm/")) {
    const pkg = parsed.target.slice("npm/".length);
    return (await probe("npm", pkg))
      ? { ok: true, target: parsed.target }
      : { ok: false, reason: `No npm package named "${pkg}" — check the spelling.` };
  }

  if (parsed.target.startsWith("pypi/")) {
    const pkg = parsed.target.slice("pypi/".length);
    return (await probe("pypi", pkg))
      ? { ok: true, target: parsed.target }
      : { ok: false, reason: `No PyPI package named "${pkg}" — check the spelling.` };
  }

  if (parsed.target.startsWith("github/")) {
    const repo = parsed.target.slice("github/".length);
    return (await probe("github", repo))
      ? { ok: true, target: parsed.target }
      : { ok: false, reason: `No GitHub repository "${repo}" — check the spelling.` };
  }

  return {
    ok: false,
    reason:
      "We can only queue an npm/…, pypi/…, github/owner/repo, or https:// target — that ref isn't a runnable package.",
  };
}

/**
 * Production registry probe: a GET against the public registry. We only report
 * "does not exist" on a definitive 404 — a 2xx means it exists, and any other
 * outcome (5xx, rate-limit, network error, timeout) fails *open* so a registry
 * blip never rejects an otherwise-valid request.
 */
export const checkRegistryExists: RegistryProbe = async (registry, pkg) => {
  const url =
    registry === "npm"
      ? `https://registry.npmjs.org/${pkg.replace("/", "%2F")}`
      : registry === "pypi"
        ? `https://pypi.org/pypi/${encodeURIComponent(pkg)}/json`
        : // github: pkg is "owner/repo"; the repos API 404s definitively, and
          // an unauthenticated rate-limit answer is a 403 — which fails open.
          `https://api.github.com/repos/${pkg}`;
  try {
    const res = await fetch(url, {
      method: "GET",
      signal: AbortSignal.timeout(REGISTRY_TIMEOUT_MS),
      headers: { accept: "application/json" },
    });
    return res.status !== 404; // exists unless the registry positively says otherwise
  } catch {
    return true; // couldn't check — don't block on our own connectivity
  }
};
