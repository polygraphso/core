import { describe, it, expect } from "vitest";
import type { EcosystemEntryVM } from "@/lib/ecosystemTypes";
import {
  entryType,
  isFiltering,
  filterEntries,
  pageItems,
  ENTRIES_PAGE_SIZE,
  type EntryFilters,
} from "./manageEntries";

/** Minimal VM factory — only the fields the filters read matter. */
function vm(p: Partial<EcosystemEntryVM> & { id: string }): EcosystemEntryVM {
  return {
    target: null,
    targetKind: "registry_ref",
    name: "",
    cohort: null,
    visible: true,
    featured: false,
    grade: null,
    checks: [],
    completedAt: null,
    reportPath: null,
    fixes: [],
    gradeStatus: null,
    ...p,
  };
}

const NONE: EntryFilters = { search: "", type: "all", grade: "all", vis: "all" };

describe("entryType", () => {
  it("labels skill-kind entries as skill and everything else as mcp", () => {
    expect(entryType(vm({ id: "1", targetKind: "skill" }))).toBe("skill");
    expect(entryType(vm({ id: "2", targetKind: "registry_ref" }))).toBe("mcp");
    expect(entryType(vm({ id: "3", targetKind: "remote_url" }))).toBe("mcp");
  });
});

describe("isFiltering", () => {
  it("is false only when nothing is narrowing the set", () => {
    expect(isFiltering(NONE)).toBe(false);
    expect(isFiltering({ ...NONE, search: "  " })).toBe(false); // whitespace-only
    expect(isFiltering({ ...NONE, search: "x" })).toBe(true);
    expect(isFiltering({ ...NONE, type: "mcp" })).toBe(true);
    expect(isFiltering({ ...NONE, grade: "A" })).toBe(true);
    expect(isFiltering({ ...NONE, vis: "hidden" })).toBe(true);
  });
});

describe("filterEntries", () => {
  const entries = [
    vm({ id: "a", name: "Blue Agent", target: "npm/@blue/agent", targetKind: "registry_ref", grade: "A", visible: true }),
    vm({ id: "b", name: "Nookplot", target: "https://nookplot.xyz", targetKind: "remote_url", grade: "F", visible: false }),
    vm({ id: "c", name: "Flaunch Skill", target: "github/x/y#flaunch", targetKind: "skill", grade: "B", visible: true }),
    vm({ id: "d", name: "Pending Server", target: "npm/@pending/srv", targetKind: "registry_ref", grade: null, visible: true }),
  ];
  const ids = (r: EcosystemEntryVM[]) => r.map((e) => e.id);

  it("returns everything with no filters", () => {
    expect(ids(filterEntries(entries, NONE))).toEqual(["a", "b", "c", "d"]);
  });

  it("searches name and target, case-insensitively", () => {
    expect(ids(filterEntries(entries, { ...NONE, search: "blue" }))).toEqual(["a"]);
    expect(ids(filterEntries(entries, { ...NONE, search: "PENDING" }))).toEqual(["d"]); // matches name + target
    expect(ids(filterEntries(entries, { ...NONE, search: "nookplot.xyz" }))).toEqual(["b"]); // target only
    expect(ids(filterEntries(entries, { ...NONE, search: "zzz" }))).toEqual([]);
  });

  it("filters by type", () => {
    expect(ids(filterEntries(entries, { ...NONE, type: "skill" }))).toEqual(["c"]);
    expect(ids(filterEntries(entries, { ...NONE, type: "mcp" }))).toEqual(["a", "b", "d"]);
  });

  it("filters by grade letter and the ungraded bucket", () => {
    expect(ids(filterEntries(entries, { ...NONE, grade: "A" }))).toEqual(["a"]);
    expect(ids(filterEntries(entries, { ...NONE, grade: "F" }))).toEqual(["b"]);
    expect(ids(filterEntries(entries, { ...NONE, grade: "ungraded" }))).toEqual(["d"]);
  });

  it("filters by visibility", () => {
    expect(ids(filterEntries(entries, { ...NONE, vis: "shown" }))).toEqual(["a", "c", "d"]);
    expect(ids(filterEntries(entries, { ...NONE, vis: "hidden" }))).toEqual(["b"]);
  });

  it("combines filters (AND)", () => {
    expect(ids(filterEntries(entries, { ...NONE, type: "mcp", vis: "shown", grade: "A" }))).toEqual(["a"]);
    expect(ids(filterEntries(entries, { ...NONE, type: "skill", grade: "A" }))).toEqual([]);
  });
});

describe("pageItems", () => {
  it("lists every page when total fits the window (<= 7)", () => {
    expect(pageItems(1, 1)).toEqual([1]);
    expect(pageItems(3, 7)).toEqual([1, 2, 3, 4, 5, 6, 7]);
  });

  it("windows around the current page with ellipses for large totals", () => {
    expect(pageItems(1, 12)).toEqual([1, 2, "…", 12]);
    expect(pageItems(5, 12)).toEqual([1, "…", 4, 5, 6, "…", 12]);
    expect(pageItems(12, 12)).toEqual([1, "…", 11, 12]);
  });

  it("always includes the first and last page", () => {
    for (const cur of [1, 6, 20]) {
      const items = pageItems(cur, 20);
      expect(items[0]).toBe(1);
      expect(items[items.length - 1]).toBe(20);
    }
  });
});

describe("ENTRIES_PAGE_SIZE", () => {
  it("is a positive page size", () => {
    expect(ENTRIES_PAGE_SIZE).toBeGreaterThan(0);
  });
});
