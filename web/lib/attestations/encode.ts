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
