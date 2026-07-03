import { ServerRefParseError, parseServerRef, serverKey } from "@/lib/identity";

/**
 * Parse a grade-queue target into its canonical form. Shared by the human
 * funnel (POST /api/grade-requests) and the anonymous CLI/MCP funnel
 * (POST /api/cli/grade-request) so both normalize identically.
 *
 * A registry ref (npm/… | pypi/… | github/owner/repo) collapses to its
 * versionless server key; an https:// URL is kept as a remote MCP endpoint.
 * Returns `{ error }` with a user-facing message on anything else.
 */
export type ParsedGradeTarget =
  | { target: string; kind: "registry_ref" | "remote_url" }
  | { error: string };

export function parseGradeTarget(raw: string): ParsedGradeTarget {
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
