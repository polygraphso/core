import { keccak256, toUtf8Bytes } from "ethers";

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
    return `[${value.map(canonicalize).join(",")}]`;
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
import { detailFromRow, type HostedGradeRow } from "@/lib/hostedGrades";
import { GRADE_SCHEMA } from "./schema";

export interface GradeAttestationFields {
  server: string;
  version: string;
  grade: string;
  methodologyVersion: string;
  toolDefsFingerprint: string;
  evidenceHash: string;
  evidenceURI: string;
  issuedAt: bigint;
}

/**
 * Build attestation fields from a published hosted_runs row. Returns null if
 * the row carries no valid grade. Value resolution (bundle-vs-column fallback)
 * is delegated to detailFromRow so attested values equal site/CLI values.
 */
export function buildFields(row: HostedGradeRow): GradeAttestationFields | null {
  const resolved = detailFromRow(row);
  if (!resolved) return null;
  const { detail } = resolved;
  const issuedAt = row.published_at
    ? BigInt(Math.floor(Date.parse(row.published_at) / 1000))
    : BigInt(0);
  return {
    server: row.target,
    version: detail.resolved_version ?? "",
    grade: detail.grade,
    methodologyVersion: detail.methodology_version,
    toolDefsFingerprint: detail.tool_defs_fingerprint ?? "",
    evidenceHash: evidenceHash(row.evidence ?? {}),
    evidenceURI: evidenceURI(row.target, detail.resolved_version),
    issuedAt,
  };
}

/** ABI-encode the fields for an EAS attestation, per GRADE_SCHEMA. */
export function encodeFields(f: GradeAttestationFields): string {
  const encoder = new SchemaEncoder(GRADE_SCHEMA);
  return encoder.encodeData([
    { name: "server", value: f.server, type: "string" },
    { name: "version", value: f.version, type: "string" },
    { name: "grade", value: f.grade, type: "string" },
    { name: "methodologyVersion", value: f.methodologyVersion, type: "string" },
    { name: "toolDefsFingerprint", value: f.toolDefsFingerprint, type: "string" },
    { name: "evidenceHash", value: f.evidenceHash, type: "bytes32" },
    { name: "evidenceURI", value: f.evidenceURI, type: "string" },
    { name: "issuedAt", value: f.issuedAt, type: "uint64" },
  ]);
}
