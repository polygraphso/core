/**
 * Maps hosted_runs rows → the Run shape ChecksSoFarView renders.
 *
 * Bundle field names mirror polygraph-litmus EvidenceBundle (camelCase JSON).
 * web/ is a standalone deploy target — types are local, not @polygraph/core.
 */

export type LitmusGrade = "A" | "B" | "C" | "D" | "F";

export type Run = {
  id: string;
  label: string;
  kind: string;
  /** Coarse class for the browse filter: an MCP server or a skill. */
  category: "mcp" | "skill";
  grade: LitmusGrade;
  rows: Array<[string, string]>;
  rationale: string;
  /** The methodology version this grade was produced under (e.g. "litmus-v2"). */
  methodologyVersion: string;
};

export interface HostedRunRow {
  id: string;
  target: string;
  target_kind: "registry_ref" | "remote_url" | "skill";
  grade: LitmusGrade;
  rationale: string;
  /** Server rows carry an EvidenceBundle; skill rows a SkillEvidenceBundle. */
  evidence: StoredEvidence | SkillStoredEvidence;
  tool_defs_fingerprint?: string | null;
  c01?: string | null;
  c02?: string | null;
  c03?: string | null;
  /** Skill rows only: the whole-directory content hash + the advisory quality bundle. */
  content_hash?: string | null;
  quality_signal?: QualitySignal | null;
}

interface TargetDescriptor {
  kind: "stdio" | "http";
  command?: string | null;
  url?: string | null;
}

interface Finding {
  kind: string;
  severity: string;
}

interface CategoryResult {
  code: string;
  status: "pass" | "fail" | "skipped";
  reason?: string | null;
  probes: Array<{ findings: Finding[] }>;
}

interface EvidenceBundle {
  target: TargetDescriptor;
  toolDefsFingerprint: string;
  categories: CategoryResult[];
  /** The methodology version the grade was produced under (e.g. "litmus-v2"). */
  methodologyVersion: string;
}

type StoredEvidence = EvidenceBundle & { displayLabel?: string };

// ── Skill litmus (litmus-skill-v1) ───────────────────────────────────────────
// A skill's categories carry findings directly (no `probes`), and there is no
// live tool surface — the anchor is a whole-directory content hash.
interface SkillCategoryResult {
  code: string;
  status: "pass" | "fail" | "skipped";
  reason?: string | null;
  findings?: Finding[];
}
interface SkillEvidenceBundle {
  skillRef?: string;
  contentHash?: string;
  categories: SkillCategoryResult[];
  methodologyVersion: string;
}
type SkillStoredEvidence = SkillEvidenceBundle & { displayLabel?: string };

export interface QualitySignal {
  verdict?: string;
  judged?: { axes?: Array<{ axis: string; rating: string }> } | null;
}

const CATEGORY_LABELS: Record<string, string> = {
  "C-01": "C-01 tool-output injection",
  "C-02": "C-02 permission overreach",
  "C-03": "C-03 sensitive-data handling",
};

// Plain, human labels on the public card — the methodology IDs (S-01/S-03/S-04,
// with intentional gaps where S-02/S-05 are advisory-only) would read as "broken"
// next to a contiguous list. The codes live on the methodology page.
const SKILL_CATEGORY_LABELS: Record<string, string> = {
  "S-01": "prompt injection",
  "S-03": "exfil instructions",
  "S-04": "dangerous commands",
};

const FINDING_PHRASES: Record<string, string> = {
  "instruction-mimicry": "instruction mimicry in a tool description",
  canary: "planted canary surfaced in tool output",
  "invisible-unicode": "invisible unicode in tool surface",
  "markdown-trick": "markdown trick in tool surface",
  egress: "unexpected egress during sandbox run",
  // skill litmus (litmus-skill-v1)
  "exfil-instruction": "data-exfiltration instruction in the skill body",
  "dangerous-command": "dangerous command in a bundled script",
  "over-broad-trigger": "over-broad activation trigger",
};

function shortFingerprint(fp: string): string {
  return fp.length > 14 ? `${fp.slice(0, 6)}…${fp.slice(-4)}` : fp;
}

// Show the clean canonical ref (npm/…, pypi/…, or an https URL), never the raw
// launch command: a sandboxed run's `command` is the full `docker run …` invocation
// (egress-sniff image, mount paths, hardening flags) — internal noise, not something
// a reader runs. The ref comes from the row; `target.command` is never surfaced.
function targetLabel(target: TargetDescriptor | undefined, ref?: string): string {
  if (ref) return ref;
  if (!target) return "—";
  if (target.kind === "http" && target.url) return target.url;
  return target.kind;
}

function transportLabel(target: TargetDescriptor | undefined): string {
  if (!target) return "—";
  if (target.kind === "http") return "Streamable HTTP — connected like an agent";
  if (target.kind === "stdio") return "stdio — launched like an agent";
  return target.kind;
}

function failDetail(category: CategoryResult): string {
  if (category.reason) return category.reason;
  const finding = category.probes
    .flatMap((p) => p.findings)
    .find((f) => f.severity === "high") ?? category.probes.flatMap((p) => p.findings)[0];
  if (!finding) return "check failed";
  return FINDING_PHRASES[finding.kind] ?? finding.kind.replace(/-/g, " ");
}

function formatCategoryValue(category: CategoryResult | undefined): string {
  if (!category) return "—";
  if (category.status === "pass") return "pass";
  if (category.status === "skipped") {
    return category.reason ? `skipped — ${category.reason}` : "skipped";
  }
  return `fail — ${failDetail(category)}`;
}

export function bundleToRows(bundle: EvidenceBundle, ref?: string): Array<[string, string]> {
  const rows: Array<[string, string]> = [
    ["target", targetLabel(bundle.target, ref)],
    ["transport", transportLabel(bundle.target)],
  ];

  for (const code of ["C-01", "C-02", "C-03"]) {
    const category = bundle.categories.find((c) => c.code === code);
    rows.push([CATEGORY_LABELS[code] ?? code, formatCategoryValue(category)]);
  }

  rows.push(["fingerprint", shortFingerprint(bundle.toolDefsFingerprint)]);
  return rows;
}

function displayKind(targetKind: HostedRunRow["target_kind"]): string {
  return targetKind === "remote_url" ? "live server" : "registry package";
}

function displayLabel(row: HostedRunRow): string {
  if (row.evidence.displayLabel) return row.evidence.displayLabel;
  if (row.target_kind === "remote_url") {
    return `${row.target} — hosted MCP server`;
  }
  return `${row.target} — registry package`;
}

function evidenceBundle(row: HostedRunRow): EvidenceBundle {
  // Only called on the server branch (skill rows return early in rowToRun).
  const { displayLabel: _label, ...bundle } = row.evidence as StoredEvidence;
  return bundle;
}

function skillFailDetail(category: SkillCategoryResult): string {
  if (category.reason) return category.reason;
  const finding =
    category.findings?.find((f) => f.severity === "high") ?? category.findings?.[0];
  if (!finding) return "check failed";
  return FINDING_PHRASES[finding.kind] ?? finding.kind.replace(/-/g, " ");
}

function formatSkillCategory(category: SkillCategoryResult | undefined): string {
  if (!category) return "—";
  if (category.status === "pass") return "pass";
  if (category.status === "skipped") {
    return category.reason ? `skipped — ${category.reason}` : "skipped";
  }
  return `fail — ${skillFailDetail(category)}`;
}

function skillBundleToRows(
  bundle: SkillEvidenceBundle,
  quality: QualitySignal | null | undefined,
): Array<[string, string]> {
  const rows: Array<[string, string]> = [["skill", bundle.skillRef ?? "—"]];
  for (const code of ["S-01", "S-03", "S-04"]) {
    const category = bundle.categories.find((c) => c.code === code);
    rows.push([SKILL_CATEGORY_LABELS[code] ?? code, formatSkillCategory(category)]);
  }
  if (quality?.verdict) rows.push(["quality", quality.verdict]);
  if (bundle.contentHash) rows.push(["content hash", shortFingerprint(bundle.contentHash)]);
  return rows;
}

function skillRowToRun(row: HostedRunRow): Run {
  const { displayLabel: label, ...bundle } = row.evidence as SkillStoredEvidence;
  return {
    id: row.id,
    label: label ?? row.target,
    kind: "skill",
    category: "skill",
    grade: row.grade,
    rows: skillBundleToRows(bundle, row.quality_signal),
    rationale: row.rationale,
    methodologyVersion: bundle.methodologyVersion,
  };
}

export function rowToRun(row: HostedRunRow): Run {
  if (row.target_kind === "skill") return skillRowToRun(row);
  const bundle = evidenceBundle(row);
  return {
    id: row.id,
    label: displayLabel(row),
    kind: displayKind(row.target_kind),
    category: "mcp",
    grade: row.grade,
    rows: bundleToRows(bundle, row.target),
    rationale: row.rationale,
    methodologyVersion: bundle.methodologyVersion,
  };
}
