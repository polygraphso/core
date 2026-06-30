import { keccak256, toUtf8Bytes, ZeroHash } from "ethers";

/**
 * Deterministic JSON serialization: object keys sorted, undefined values
 * dropped, arrays preserved in order. Two structurally-equal objects always
 * produce the same string, so keccak256 over it is a stable content hash.
 */
export function canonicalize(value: unknown): string {
  if (value === null || typeof value !== "object") {
    return JSON.stringify(value);
  }
  if (Array.isArray(value)) {
    // Match JSON.stringify: undefined array elements serialize to null
    // (rather than collapsing), so array arity is preserved in the hash.
    return `[${value.map((v) => (v === undefined ? "null" : canonicalize(v))).join(",")}]`;
  }
  const obj = value as Record<string, unknown>;
  const entries = Object.keys(obj)
    .sort()
    .filter((k) => obj[k] !== undefined)
    .map((k) => `${JSON.stringify(k)}:${canonicalize(obj[k])}`);
  return `{${entries.join(",")}}`;
}

/** keccak256 of the canonical serialization of the evidence bundle. */
export function evidenceHash(evidence: unknown): string {
  return keccak256(toUtf8Bytes(canonicalize(evidence ?? {})));
}

/** Canonical public site origin used for evidence URIs. */
const SITE_URL = "https://polygraph.so";

/**
 * Version-pinned public evidence page URL for a grade. The server key forms
 * the path (slashes preserved); the resolved version is a query param so the
 * URL is immutable for the attested grade. Null version → no `?v`.
 */
export function evidenceURI(serverKey: string, version: string | null): string {
  const base = `${SITE_URL}/grade/${serverKey}`;
  return version ? `${base}?v=${encodeURIComponent(version)}` : base;
}

import { SchemaEncoder } from "@ethereum-attestation-service/eas-sdk";
import { detailFromRow, type HostedGradeRow, type PolygraphDetail } from "@/lib/hostedGrades";
import { skillRefToPath } from "@/lib/skillGrades";
import { SERVER_SCHEMA, SKILL_SCHEMA } from "./schema";

/** Public skill evidence page URL. The skill target's `#subpath` separator
 *  becomes a path segment (skillRefToPath) so it survives the URL path. */
export function skillEvidenceURI(skillRef: string): string {
  return `${SITE_URL}/skill/${skillRefToPath(skillRef)}`;
}

/** Fields of the reconciled SERVER schema (npm + https targets). Mirrors litmus
 *  `LitmusAttestationFields`; the field order matches SERVER_SCHEMA exactly. */
export interface ServerAttestationFields {
  serverRef: string;
  toolDefsFingerprint: string;
  gradeC01: number;
  gradeC02: number;
  gradeC03: number;
  gradeC04: number;
  overallGrade: string;
  evidenceHash: string;
  evidenceURI: string;
  methodologyVersion: string;
  ranAt: bigint;
  resolvedVersion: string;
}

const STATUS_UINT8: Record<string, number> = { pass: 0, fail: 1, skipped: 2 };

/** Map a category's verdict to its on-chain uint8 (pass=0, fail=1, else=2).
 *  Prefers the bundle's raw category status; falls back to the flat c01..c04
 *  display string (taking its leading word, e.g. "skipped — reason" → "skipped").
 *  Absent / "partial" / unknown ⇒ the skipped sentinel (2): never "pass". */
function categoryUint8(detail: PolygraphDetail, code: string): number {
  const flat: Record<string, string | null> = {
    "C-01": detail.c01,
    "C-02": detail.c02,
    "C-03": detail.c03,
    "C-04": detail.c04,
  };
  const raw = detail.categories.find((c) => c.code === code)?.status ?? flat[code] ?? "";
  const word = raw.split(" ")[0];
  return STATUS_UINT8[word] ?? 2;
}

/** Run timestamp (unix seconds) the grade was produced at: the evidence bundle's
 *  `ranAt` (what litmus signs), falling back to `published_at` then 0. */
function ranAtSeconds(row: HostedGradeRow): bigint {
  const bundleRanAt = (row.evidence as { ranAt?: string } | null)?.ranAt;
  const iso = bundleRanAt ?? row.published_at;
  return iso ? BigInt(Math.floor(Date.parse(iso) / 1000)) : BigInt(0);
}

/**
 * Build SERVER attestation fields from a published hosted_runs row. Returns null
 * if the row carries no valid grade. Scalar resolution (bundle-vs-column
 * fallback) is delegated to detailFromRow so attested values equal site/CLI
 * values; per-category verdicts (incl. C-04) come from the bundle.
 */
export function buildServerFields(row: HostedGradeRow): ServerAttestationFields | null {
  const resolved = detailFromRow(row);
  if (!resolved) return null;
  const { detail } = resolved;
  return {
    serverRef: row.target,
    // bytes32: a sha256 tool-surface fingerprint ("0x"+64hex), or zero when absent.
    toolDefsFingerprint: detail.tool_defs_fingerprint ?? ZeroHash,
    gradeC01: categoryUint8(detail, "C-01"),
    gradeC02: categoryUint8(detail, "C-02"),
    gradeC03: categoryUint8(detail, "C-03"),
    gradeC04: categoryUint8(detail, "C-04"),
    overallGrade: detail.grade,
    evidenceHash: evidenceHash(row.evidence ?? {}),
    evidenceURI: evidenceURI(row.target, detail.resolved_version),
    methodologyVersion: detail.methodology_version,
    ranAt: ranAtSeconds(row),
    resolvedVersion: detail.resolved_version ?? "",
  };
}

/** ABI-encode the SERVER fields for an EAS attestation, per SERVER_SCHEMA. */
export function encodeServerFields(f: ServerAttestationFields): string {
  const encoder = new SchemaEncoder(SERVER_SCHEMA);
  return encoder.encodeData([
    { name: "serverRef", value: f.serverRef, type: "string" },
    { name: "toolDefsFingerprint", value: f.toolDefsFingerprint, type: "bytes32" },
    { name: "gradeC01", value: f.gradeC01, type: "uint8" },
    { name: "gradeC02", value: f.gradeC02, type: "uint8" },
    { name: "gradeC03", value: f.gradeC03, type: "uint8" },
    { name: "gradeC04", value: f.gradeC04, type: "uint8" },
    { name: "overallGrade", value: f.overallGrade, type: "string" },
    { name: "evidenceHash", value: f.evidenceHash, type: "bytes32" },
    { name: "evidenceURI", value: f.evidenceURI, type: "string" },
    { name: "methodologyVersion", value: f.methodologyVersion, type: "string" },
    { name: "ranAt", value: f.ranAt, type: "uint64" },
    { name: "resolvedVersion", value: f.resolvedVersion, type: "string" },
  ]);
}

/** Fields of the SKILL schema (Claude/Agent skills). Mirrors litmus
 *  `SkillAttestationFields`; field order matches SKILL_SCHEMA exactly. */
export interface SkillAttestationFields {
  skillRef: string;
  contentHash: string;
  gradeS01: number;
  gradeS03: number;
  gradeS04: number;
  overallGrade: string;
  evidenceHash: string;
  evidenceURI: string;
  methodologyVersion: string;
  ranAt: bigint;
  resolvedRef: string;
}

/** uint8 for a category read straight from the bundle (skills have no flat
 *  c01..c04 columns). Absent / "partial" / unknown ⇒ skipped sentinel (2). */
function bundleCategoryUint8(evidence: HostedGradeRow["evidence"], code: string): number {
  const raw = evidence?.categories?.find((c) => c.code === code)?.status ?? "";
  return STATUS_UINT8[raw.split(" ")[0]] ?? 2;
}

/**
 * Build SKILL attestation fields from a published skill hosted_runs row. Returns
 * null if the row has no valid grade or no content hash (the skill trust anchor —
 * a skill attestation without it is unverifiable).
 */
export function buildSkillFields(row: HostedGradeRow): SkillAttestationFields | null {
  if (!row.grade || !row.content_hash) return null;
  const bundle = row.evidence;
  return {
    skillRef: row.target,
    contentHash: row.content_hash,
    gradeS01: bundleCategoryUint8(bundle, "S-01"),
    gradeS03: bundleCategoryUint8(bundle, "S-03"),
    gradeS04: bundleCategoryUint8(bundle, "S-04"),
    overallGrade: row.grade,
    evidenceHash: evidenceHash(bundle ?? {}),
    evidenceURI: skillEvidenceURI(row.target),
    methodologyVersion: bundle?.methodologyVersion ?? "litmus-skill",
    ranAt: ranAtSeconds(row),
    resolvedRef: row.resolved_version ?? "",
  };
}

/** ABI-encode the SKILL fields for an EAS attestation, per SKILL_SCHEMA. */
export function encodeSkillFields(f: SkillAttestationFields): string {
  const encoder = new SchemaEncoder(SKILL_SCHEMA);
  return encoder.encodeData([
    { name: "skillRef", value: f.skillRef, type: "string" },
    { name: "contentHash", value: f.contentHash, type: "bytes32" },
    { name: "gradeS01", value: f.gradeS01, type: "uint8" },
    { name: "gradeS03", value: f.gradeS03, type: "uint8" },
    { name: "gradeS04", value: f.gradeS04, type: "uint8" },
    { name: "overallGrade", value: f.overallGrade, type: "string" },
    { name: "evidenceHash", value: f.evidenceHash, type: "bytes32" },
    { name: "evidenceURI", value: f.evidenceURI, type: "string" },
    { name: "methodologyVersion", value: f.methodologyVersion, type: "string" },
    { name: "ranAt", value: f.ranAt, type: "uint64" },
    { name: "resolvedRef", value: f.resolvedRef, type: "string" },
  ]);
}
