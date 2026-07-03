import { describe, it, expect } from "vitest";

import { likePattern, toResults, type CatalogRow } from "./catalogSearch";

describe("likePattern", () => {
  it("wraps a single word in wildcards", () => {
    expect(likePattern("git")).toBe("%git%");
  });

  it("joins multiple words with wildcards so order-insensitive terms match", () => {
    expect(likePattern("google drive")).toBe("%google%drive%");
  });

  it("strips PostgREST-reserved characters", () => {
    expect(likePattern("slack (mcp),*")).toBe("%slack%mcp%");
  });
});

describe("toResults", () => {
  const row = (over: Partial<CatalogRow>): CatalogRow => ({
    name: null,
    repository_url: null,
    grading_target: null,
    grading_kind: null,
    gradeable: null,
    ...over,
  });

  it("drops rows that have no runnable grading target", () => {
    const rows = [
      row({ name: "unresolved", grading_target: null }),
      row({ name: "ok", grading_target: "npm/ok", grading_kind: "npm", gradeable: true }),
    ];
    const results = toResults(rows, new Map());
    expect(results).toHaveLength(1);
    expect(results[0].target).toBe("npm/ok");
  });

  it("marks a result graded and attaches its grade when covered", () => {
    const rows = [row({ name: "ctx", grading_target: "npm/context7", grading_kind: "npm", gradeable: true })];
    const results = toResults(rows, new Map([["npm/context7", "A"]]));
    expect(results[0]).toMatchObject({ target: "npm/context7", graded: true, grade: "A", name: "ctx", kind: "npm" });
  });

  it("marks a result ungraded when not covered", () => {
    const rows = [row({ grading_target: "npm/fresh", grading_kind: "npm", gradeable: true })];
    const results = toResults(rows, new Map());
    expect(results[0]).toMatchObject({ graded: false, grade: null });
  });

  it("dedupes by grading target, keeping the first occurrence", () => {
    const rows = [
      row({ name: "first", grading_target: "npm/dup", grading_kind: "npm", gradeable: true }),
      row({ name: "second", grading_target: "npm/dup", grading_kind: "npm", gradeable: true }),
    ];
    const results = toResults(rows, new Map());
    expect(results).toHaveLength(1);
    expect(results[0].name).toBe("first");
  });
});
