/**
 * Well-known registry page URLs → grade-target refs. People paste the page
 * they're looking at (npmjs.com/package/…, github.com/owner/repo,
 * pypi.org/project/…) rather than a registry ref; those name a package we can
 * run in the full sandbox, so treating them as remote MCP endpoints (with the
 * remote B-cap) is wrong. Pure and client-safe: the request form uses it for
 * the live hint and the combobox normalizer, parseGradeTarget for the server
 * truth. Returns null for anything that isn't a recognized registry page URL.
 */
export function registryUrlToRef(raw: string): string | null {
  let url: URL;
  try {
    url = new URL(raw.trim());
  } catch {
    return null;
  }
  if (url.protocol !== "https:") return null;
  const host = url.hostname.toLowerCase().replace(/^www\./, "");
  const parts = url.pathname.split("/").filter(Boolean).map(decodeURIComponent);

  if (host === "npmjs.com" || host === "npmjs.org") {
    // /package/<name> | /package/@scope/<name>, optionally …/v/<version>
    if (parts[0] !== "package" || parts.length < 2) return null;
    const nameParts = parts.slice(1);
    const vIdx = nameParts.indexOf("v");
    const name = (vIdx === -1 ? nameParts : nameParts.slice(0, vIdx)).join("/");
    const version = vIdx !== -1 ? nameParts[vIdx + 1] : undefined;
    if (!name) return null;
    return version ? `npm/${name}@${version}` : `npm/${name}`;
  }

  if (host === "pypi.org") {
    // /project/<name>/, optionally /<version>/
    if (parts[0] !== "project" || !parts[1]) return null;
    return parts[2] ? `pypi/${parts[1]}@${parts[2]}` : `pypi/${parts[1]}`;
  }

  if (host === "github.com") {
    // Bare repo only: /owner/repo(.git). Deeper paths are either skills
    // (SKILL.md URLs, handled before this in parseGradeTarget) or too
    // ambiguous to guess a ref from.
    if (parts.length !== 2) return null;
    const [owner, rawRepo] = parts;
    const repo = rawRepo?.replace(/\.git$/, "") ?? "";
    if (!owner || !repo) return null;
    return `github/${owner}/${repo}`;
  }

  return null;
}
