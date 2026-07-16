/**
 * Confirm a parsed grade target is actually *runnable* before we queue it — the
 * gate that runs at request intake, so an ungradeable target is rejected before
 * a payment is ever taken for it.
 *
 * The request funnel lets a human type a free-form ref. `parseGradeTarget`
 * proves it's well-formed; this proves the harness could actually grade it:
 *   - https:// remote     → trusted (a live endpoint, graded up to B)
 *   - skill               → trusted (a github skill ref the runner clones + scans)
 *   - npm/… , pypi/…      → must exist on the registry (probe injected)
 *   - github/owner/repo   → the repo must exist AND be Node- or Python-packaged
 *                           (package.json / pyproject.toml / setup.py at root) —
 *                           litmus v1 clones + builds + runs those only; a Go or
 *                           Rust repo would fail on the box, so we don't take
 *                           money for it
 *   - anything else       → not a runnable package
 *
 * The probe is injected so the branching logic stays unit-testable without
 * network. `checkRegistryExists` is the production implementation.
 */

const REGISTRY_TIMEOUT_MS = 4000;

export type RunnableCheck =
  | { ok: true; target: string }
  | { ok: false; reason: string };

/**
 * A registry membership question, injected so the logic is testable offline.
 * `"github-gradeable"` asks the extra question a github repo needs: does its
 * root carry a Node or Python manifest the harness can build?
 */
export type RegistryProbe = (
  registry: "npm" | "pypi" | "github" | "github-gradeable",
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
    if (!(await probe("github", repo))) {
      return { ok: false, reason: `No GitHub repository "${repo}" — check the spelling.` };
    }
    if (!(await probe("github-gradeable", repo))) {
      return {
        ok: false,
        reason:
          `"${repo}" isn't a Node or Python package (no package.json, pyproject.toml, or setup.py at its root). ` +
          `litmus v1 grades Node and Python servers — request it as its npm/PyPI package, or its https:// endpoint, instead.`,
      };
    }
    return { ok: true, target: parsed.target };
  }

  return {
    ok: false,
    reason:
      "We can only queue an npm/…, pypi/…, github/owner/repo, or https:// target — that ref isn't a runnable package.",
  };
}

/** Node/Python manifests the harness builds from; presence at repo root = gradeable. */
const GRADEABLE_MANIFESTS = new Set(["package.json", "pyproject.toml", "setup.py"]);

/**
 * Production probe. For npm/pypi/github it answers existence off the public
 * registry (only a definitive 404 → false; any other outcome — 5xx, rate-limit,
 * network error, timeout — fails *open* so a blip never rejects a valid
 * request). For `"github-gradeable"` it reads the repo's root listing and
 * answers whether a Node/Python manifest is there; it fails *open* too, so a
 * GitHub API hiccup lets the request through to the box rather than wrongly
 * blocking a real Node/Python repo (the box is the final arbiter).
 */
export const checkRegistryExists: RegistryProbe = async (registry, pkg) => {
  if (registry === "github-gradeable") {
    try {
      const res = await fetch(`https://api.github.com/repos/${pkg}/contents/`, {
        method: "GET",
        signal: AbortSignal.timeout(REGISTRY_TIMEOUT_MS),
        headers: { accept: "application/json" },
      });
      if (!res.ok) return true; // rate-limited / error → don't block
      const entries = (await res.json()) as Array<{ name?: string }>;
      if (!Array.isArray(entries)) return true;
      return entries.some((e) => e.name && GRADEABLE_MANIFESTS.has(e.name));
    } catch {
      return true; // couldn't check — the box will catch a truly ungradeable repo
    }
  }

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
