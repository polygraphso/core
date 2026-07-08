import { ServerRefParseError, parseServerRef, serverKey } from "@/lib/identity";
import { decodeSkillRef, githubUrlToSkillRef } from "@/lib/skillGrades";

/**
 * Parse a grade-queue target into its canonical form. Shared by the human
 * funnel (POST /api/grade-requests) and the anonymous CLI/MCP funnel
 * (POST /api/cli/grade-request) so both normalize identically.
 *
 * A registry ref (npm/… | pypi/… | github/owner/repo) collapses to its
 * versionless server key; a github skill (a `#`-scoped ref or a github.com
 * blob/tree URL to a SKILL.md) becomes its canonical `github/owner/repo#path`
 * skill ref; an https:// URL is kept as a remote MCP endpoint. Returns
 * `{ error }` with a user-facing message on anything else.
 */
export type ParsedGradeTarget =
  | { target: string; kind: "registry_ref" | "remote_url" | "skill" }
  | { error: string };

export function parseGradeTarget(raw: string): ParsedGradeTarget {
  // Skills first: a github.com blob/tree URL is *also* an https:// URL, so this
  // must precede the remote-endpoint branch — otherwise a skill URL is queued
  // as a remote MCP server and fails to grade. Mirrors the monitor funnel:
  // only a `#`-scoped ref is a skill; a bare github/owner/repo stays a server.
  const skillCandidate = raw.includes("#")
    ? decodeSkillRef(raw)
    : githubUrlToSkillRef(raw);
  if (skillCandidate && skillCandidate.startsWith("github/") && skillCandidate.includes("#")) {
    return { target: skillCandidate, kind: "skill" };
  }

  if (raw.startsWith("https://")) {
    try {
      const url = new URL(raw);
      if (url.protocol !== "https:") throw new Error("not https");
      return { target: url.toString(), kind: "remote_url" };
    } catch {
      return { error: "Enter a valid https:// MCP URL." };
    }
  }
  try {
    return { target: serverKey(parseServerRef(raw)), kind: "registry_ref" };
  } catch (err) {
    if (err instanceof ServerRefParseError) {
      return {
        error:
          "Enter a registry ref (npm/…, pypi/…, github/owner/repo) or an https:// MCP URL.",
      };
    }
    throw err;
  }
}
