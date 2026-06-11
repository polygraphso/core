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
  grade: LitmusGrade;
  rows: Array<[string, string]>;
  rationale: string;
};

export interface HostedRunRow {
  id: string;
  target: string;
  target_kind: "registry_ref" | "remote_url";
  grade: LitmusGrade;
  rationale: string;
  evidence: StoredEvidence;
  tool_defs_fingerprint?: string | null;
  c01?: string | null;
  c02?: string | null;
  c03?: string | null;
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
}

type StoredEvidence = EvidenceBundle & { displayLabel?: string };

const CATEGORY_LABELS: Record<string, string> = {
  "C-01": "C-01 tool-output injection",
  "C-02": "C-02 permission overreach",
  "C-03": "C-03 sensitive-data handling",
};

const FINDING_PHRASES: Record<string, string> = {
  "instruction-mimicry": "instruction mimicry in a tool description",
  canary: "planted canary surfaced in tool output",
  "invisible-unicode": "invisible unicode in tool surface",
  "markdown-trick": "markdown trick in tool surface",
  egress: "unexpected egress during sandbox run",
};

function shortFingerprint(fp: string): string {
  return fp.length > 14 ? `${fp.slice(0, 6)}…${fp.slice(-4)}` : fp;
}

function targetLabel(target: TargetDescriptor): string {
  if (target.kind === "http" && target.url) return target.url;
  if (target.kind === "stdio" && target.command) return target.command;
  return target.kind;
}

function transportLabel(target: TargetDescriptor): string {
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

export function bundleToRows(bundle: EvidenceBundle): Array<[string, string]> {
  const rows: Array<[string, string]> = [
    ["target", targetLabel(bundle.target)],
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
  const { displayLabel: _label, ...bundle } = row.evidence;
  return bundle;
}

export function rowToRun(row: HostedRunRow): Run {
  const bundle = evidenceBundle(row);
  return {
    id: row.id,
    label: displayLabel(row),
    kind: displayKind(row.target_kind),
    grade: row.grade,
    rows: bundleToRows(bundle),
    rationale: row.rationale,
  };
}
