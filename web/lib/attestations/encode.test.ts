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
