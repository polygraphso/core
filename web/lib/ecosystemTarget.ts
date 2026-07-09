/**
 * Parse an add-entry input into the canonical hosted_runs target + kind an
 * ecosystem stores. Pure (no DB, no server-only), so the dashboard's add form and
 * the /api/manage add route validate identically and it is unit-tested directly.
 *
 * An MCP input reuses parseGradeTarget (npm/pypi/github ref → versionless key, or
 * an https:// endpoint). A skill input reuses the skill normalizers (a GitHub
 * SKILL.md URL, a /skill path, or an already-canonical github/owner/repo#sub).
 */

import { parseGradeTarget } from "@/lib/gradeTarget";
import { normalizeSkillInput, decodeSkillRef, skillDisplayName } from "@/lib/skillGrades";
import type { EcosystemEntryKind } from "@/lib/ecosystemTypes";

/** What the add form offers: an MCP server or a skill. */
export type EcosystemTargetKindInput = "mcp" | "skill";

export type ParsedEcosystemTarget =
  | { target: string; targetKind: EcosystemEntryKind; displayName: string }
  | { error: string };

const MAX_LEN = 512;

export function parseEcosystemTarget(
  raw: string,
  kind: EcosystemTargetKindInput,
): ParsedEcosystemTarget {
  const input = (raw ?? "").trim();
  if (!input) return { error: "Enter a server ref or skill." };
  if (input.length > MAX_LEN) return { error: `That's too long (${MAX_LEN}-char max).` };

  if (kind === "skill") {
    const canonical = decodeSkillRef(normalizeSkillInput(input));
    if (!canonical) {
      return { error: "Enter a skill as github/owner/repo#path or a GitHub SKILL.md URL." };
    }
    return { target: canonical, targetKind: "skill", displayName: skillDisplayName(canonical) };
  }

  const parsed = parseGradeTarget(input);
  if ("error" in parsed) return { error: parsed.error };
  return { target: parsed.target, targetKind: parsed.kind, displayName: parsed.target };
}
