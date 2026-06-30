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
import { buildServerFields, encodeServerFields } from "./encode";
import { SERVER_SCHEMA } from "./schema";
import type { HostedGradeRow } from "@/lib/hostedGrades";

const FINGERPRINT = "0x" + "ab".repeat(32);

const ROW: HostedGradeRow & { id: number } = {
  id: 7,
  target: "npm/some-mcp",
  target_kind: "registry_ref",
  grade: "B",
  rationale: "ok",
  evidence: {
    resolvedVersion: "2.1.0",
    methodologyVersion: "litmus-v1",
    toolDefsFingerprint: FINGERPRINT,
    categories: [
      { code: "C-01", status: "pass" },
      { code: "C-02", status: "skipped" },
      { code: "C-03", status: "pass" },
      // No C-04 in this v1 bundle ⇒ skipped sentinel (2).
    ],
  },
  tool_defs_fingerprint: FINGERPRINT,
  content_hash: null,
  c01: null,
  c02: null,
  c03: null,
  // First-class column added on main (#56); null here exercises the
  // bundle (`evidence.resolvedVersion`) fallback that detailFromRow applies.
  resolved_version: null,
  published_at: "2026-01-02T00:00:00.000Z",
};

describe("buildServerFields", () => {
  it("maps a hosted_runs row into reconciled server attestation fields", () => {
    const f = buildServerFields(ROW)!;
    expect(f.serverRef).toBe("npm/some-mcp");
    expect(f.resolvedVersion).toBe("2.1.0");
    expect(f.overallGrade).toBe("B");
    expect(f.methodologyVersion).toBe("litmus-v1");
    expect(f.toolDefsFingerprint).toBe(FINGERPRINT);
    expect(f.gradeC01).toBe(0); // pass
    expect(f.gradeC02).toBe(2); // skipped
    expect(f.gradeC03).toBe(0); // pass
    expect(f.gradeC04).toBe(2); // absent ⇒ skipped sentinel
    expect(f.evidenceURI).toBe("https://polygraph.so/grade/npm/some-mcp?v=2.1.0");
    expect(f.evidenceHash).toMatch(/^0x[0-9a-f]{64}$/);
    expect(f.ranAt).toBe(BigInt(Date.parse("2026-01-02T00:00:00.000Z") / 1000));
  });

  it("returns null when the row has no valid grade", () => {
    expect(buildServerFields({ ...ROW, grade: null })).toBeNull();
  });

  it("uses empty string + no ?v for an unresolved version", () => {
    const f = buildServerFields({ ...ROW, evidence: { ...ROW.evidence, resolvedVersion: null } })!;
    expect(f.resolvedVersion).toBe("");
    expect(f.evidenceURI).toBe("https://polygraph.so/grade/npm/some-mcp");
  });

  it("falls back to the zero hash when no tool fingerprint is present", () => {
    const f = buildServerFields({
      ...ROW,
      tool_defs_fingerprint: null,
      evidence: { ...ROW.evidence, toolDefsFingerprint: undefined },
    })!;
    expect(f.toolDefsFingerprint).toBe("0x" + "00".repeat(32));
  });
});

describe("encodeServerFields", () => {
  it("produces EAS data that round-trips through the schema decoder", () => {
    const f = buildServerFields(ROW)!;
    const encoded = encodeServerFields(f);
    const decoded = new SchemaEncoder(SERVER_SCHEMA).decodeData(encoded);
    const byName = Object.fromEntries(decoded.map((d) => [d.name, d.value.value]));
    expect(byName.serverRef).toBe("npm/some-mcp");
    expect(byName.overallGrade).toBe("B");
    expect(String(byName.gradeC02)).toBe("2");
    expect(String(byName.gradeC04)).toBe("2");
    expect(String(byName.ranAt)).toBe(String(f.ranAt));
    expect(String(byName.toolDefsFingerprint).toLowerCase()).toBe(FINGERPRINT);
  });
});

import { buildSkillFields, encodeSkillFields, skillEvidenceURI } from "./encode";
import { SKILL_SCHEMA } from "./schema";

const CONTENT_HASH = "0x" + "cd".repeat(32);

const SKILL_ROW: HostedGradeRow & { id: number } = {
  id: 9,
  target: "github/anthropic/skills#pdf",
  target_kind: "skill",
  grade: "D",
  rationale: "dangerous bundled command",
  evidence: {
    methodologyVersion: "litmus-skill-v1",
    categories: [
      { code: "S-01", status: "pass" },
      { code: "S-03", status: "pass" },
      { code: "S-04", status: "fail" },
    ],
  },
  tool_defs_fingerprint: null,
  content_hash: CONTENT_HASH,
  c01: null,
  c02: null,
  c03: null,
  resolved_version: "a1b2c3d", // commit sha the grade ran against
  published_at: "2026-01-02T00:00:00.000Z",
};

describe("skillEvidenceURI", () => {
  it("turns the #subpath into a path segment so the URL resolves", () => {
    expect(skillEvidenceURI("github/anthropic/skills#pdf")).toBe(
      "https://polygraph.so/skill/github/anthropic/skills/pdf",
    );
  });
});

describe("buildSkillFields", () => {
  it("maps a skill row into skill attestation fields", () => {
    const f = buildSkillFields(SKILL_ROW)!;
    expect(f.skillRef).toBe("github/anthropic/skills#pdf");
    expect(f.contentHash).toBe(CONTENT_HASH);
    expect(f.gradeS01).toBe(0); // pass
    expect(f.gradeS03).toBe(0); // pass
    expect(f.gradeS04).toBe(1); // fail
    expect(f.overallGrade).toBe("D");
    expect(f.evidenceURI).toBe("https://polygraph.so/skill/github/anthropic/skills/pdf");
    expect(f.resolvedRef).toBe("a1b2c3d");
    expect(f.ranAt).toBe(BigInt(Date.parse("2026-01-02T00:00:00.000Z") / 1000));
  });

  it("returns null without a content hash (the skill trust anchor)", () => {
    expect(buildSkillFields({ ...SKILL_ROW, content_hash: null })).toBeNull();
  });

  it("returns null without a grade", () => {
    expect(buildSkillFields({ ...SKILL_ROW, grade: null })).toBeNull();
  });
});

describe("encodeSkillFields", () => {
  it("produces EAS data that round-trips through the skill schema decoder", () => {
    const f = buildSkillFields(SKILL_ROW)!;
    const decoded = new SchemaEncoder(SKILL_SCHEMA).decodeData(encodeSkillFields(f));
    const byName = Object.fromEntries(decoded.map((d) => [d.name, d.value.value]));
    expect(byName.skillRef).toBe("github/anthropic/skills#pdf");
    expect(byName.overallGrade).toBe("D");
    expect(String(byName.gradeS04)).toBe("1");
    expect(String(byName.contentHash).toLowerCase()).toBe(CONTENT_HASH);
    expect(String(byName.resolvedRef)).toBe("a1b2c3d");
  });
});
