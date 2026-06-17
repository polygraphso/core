import { describe, it, expect } from "vitest";
import { canonicalize, evidenceHash } from "./encode";

describe("canonicalize", () => {
  it("sorts object keys deterministically regardless of input order", () => {
    expect(canonicalize({ b: 1, a: 2 })).toBe(canonicalize({ a: 2, b: 1 }));
  });

  it("recurses into nested objects and arrays", () => {
    const out = canonicalize({ z: [{ y: 1, x: 2 }], a: "v" });
    expect(out).toBe('{"a":"v","z":[{"x":2,"y":1}]}');
  });

  it("omits undefined-valued keys", () => {
    expect(canonicalize({ a: 1, b: undefined })).toBe('{"a":1}');
  });

  it("preserves array arity by serializing undefined elements as null", () => {
    expect(canonicalize([1, undefined, 2])).toBe("[1,null,2]");
  });
});

describe("evidenceHash", () => {
  it("is stable for key-reordered equivalents", () => {
    expect(evidenceHash({ a: 1, b: 2 })).toBe(evidenceHash({ b: 2, a: 1 }));
  });

  it("is a 0x-prefixed 32-byte keccak hash", () => {
    const h = evidenceHash({ a: 1 });
    expect(h).toMatch(/^0x[0-9a-f]{64}$/);
  });

  it("changes when content changes", () => {
    expect(evidenceHash({ a: 1 })).not.toBe(evidenceHash({ a: 2 }));
  });
});

import { evidenceURI } from "./encode";

describe("evidenceURI", () => {
  it("builds a version-pinned URL", () => {
    expect(evidenceURI("npm/@scope/pkg", "1.2.3")).toBe(
      "https://polygraph.so/grade/npm/@scope/pkg?v=1.2.3",
    );
  });

  it("omits ?v when there is no resolved version", () => {
    expect(evidenceURI("github/owner/repo", null)).toBe(
      "https://polygraph.so/grade/github/owner/repo",
    );
  });

  it("encodes special characters in the version", () => {
    expect(evidenceURI("pypi/pkg", "1.0+local")).toBe(
      "https://polygraph.so/grade/pypi/pkg?v=1.0%2Blocal",
    );
  });
});

import { SchemaEncoder } from "@ethereum-attestation-service/eas-sdk";
import { buildFields, encodeFields } from "./encode";
import { GRADE_SCHEMA } from "./schema";
import type { HostedGradeRow } from "@/lib/hostedGrades";

const ROW: HostedGradeRow & { id: number } = {
  id: 7,
  target: "npm/some-mcp",
  target_kind: "registry_ref",
  grade: "B",
  rationale: "ok",
  evidence: {
    resolvedVersion: "2.1.0",
    methodologyVersion: "litmus-v1",
    toolDefsFingerprint: "fp123",
    categories: [],
  },
  tool_defs_fingerprint: "fp123",
  c01: null,
  c02: null,
  c03: null,
  published_at: "2026-01-02T00:00:00.000Z",
};

describe("buildFields", () => {
  it("maps a hosted_runs row into attestation fields", () => {
    const f = buildFields(ROW)!;
    expect(f.server).toBe("npm/some-mcp");
    expect(f.version).toBe("2.1.0");
    expect(f.grade).toBe("B");
    expect(f.methodologyVersion).toBe("litmus-v1");
    expect(f.toolDefsFingerprint).toBe("fp123");
    expect(f.evidenceURI).toBe("https://polygraph.so/grade/npm/some-mcp?v=2.1.0");
    expect(f.evidenceHash).toMatch(/^0x[0-9a-f]{64}$/);
    expect(f.issuedAt).toBe(BigInt(Date.parse("2026-01-02T00:00:00.000Z") / 1000));
  });

  it("returns null when the row has no valid grade", () => {
    expect(buildFields({ ...ROW, grade: null })).toBeNull();
  });

  it("uses empty string for an unresolved version", () => {
    const f = buildFields({ ...ROW, evidence: { ...ROW.evidence, resolvedVersion: null } })!;
    expect(f.version).toBe("");
    expect(f.evidenceURI).toBe("https://polygraph.so/grade/npm/some-mcp");
  });
});

describe("encodeFields", () => {
  it("produces EAS data that round-trips through the schema decoder", () => {
    const f = buildFields(ROW)!;
    const encoded = encodeFields(f);
    const decoded = new SchemaEncoder(GRADE_SCHEMA).decodeData(encoded);
    const byName = Object.fromEntries(decoded.map((d) => [d.name, d.value.value]));
    expect(byName.server).toBe("npm/some-mcp");
    expect(byName.grade).toBe("B");
    expect(String(byName.issuedAt)).toBe(String(f.issuedAt));
  });
});
