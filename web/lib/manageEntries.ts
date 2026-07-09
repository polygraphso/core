/**
 * Pure search / filter / pagination helpers for the manage console entries table
 * (EntriesManager). Client-safe (no `server-only`) and side-effect free, so they
 * unit-test without a DOM. The component owns the React state; this module owns
 * the derivation — every entry is already loaded client-side, so filtering and
 * paging are pure array work.
 */

import type { EcosystemEntryVM } from "@/lib/ecosystemTypes";

export type EntryTypeFilter = "all" | "mcp" | "skill";
export type EntryGradeFilter = "all" | "A" | "B" | "C" | "D" | "F" | "ungraded";
export type EntryVisFilter = "all" | "shown" | "hidden";

export const ENTRIES_PAGE_SIZE = 25;

export interface EntryFilters {
  search: string;
  type: EntryTypeFilter;
  grade: EntryGradeFilter;
  vis: EntryVisFilter;
}

/** How an entry is typed in the table: skills vs everything else (MCP). */
export function entryType(vm: EcosystemEntryVM): "mcp" | "skill" {
  return vm.targetKind === "skill" ? "skill" : "mcp";
}

/** True when any filter is narrowing the set (drives the "N of M" count line). */
export function isFiltering(f: EntryFilters): boolean {
  return f.search.trim() !== "" || f.type !== "all" || f.grade !== "all" || f.vis !== "all";
}

/** Case-insensitive match over name + target, combined with the three selects. */
export function filterEntries(entries: EcosystemEntryVM[], f: EntryFilters): EcosystemEntryVM[] {
  const q = f.search.trim().toLowerCase();
  return entries.filter((vm) => {
    if (q && !`${vm.name} ${vm.target ?? ""}`.toLowerCase().includes(q)) return false;
    if (f.type !== "all" && entryType(vm) !== f.type) return false;
    if (f.grade === "ungraded" && vm.grade !== null) return false;
    if (f.grade !== "all" && f.grade !== "ungraded" && vm.grade !== f.grade) return false;
    if (f.vis === "shown" && !vm.visible) return false;
    if (f.vis === "hidden" && vm.visible) return false;
    return true;
  });
}

/** Windowed page numbers with ellipses, e.g. 1 … 4 5 6 … 12. Always includes 1 and total. */
export function pageItems(current: number, total: number): (number | "…")[] {
  if (total <= 7) return Array.from({ length: total }, (_, i) => i + 1);
  const out: (number | "…")[] = [1];
  const start = Math.max(2, current - 1);
  const end = Math.min(total - 1, current + 1);
  if (start > 2) out.push("…");
  for (let p = start; p <= end; p++) out.push(p);
  if (end < total - 1) out.push("…");
  out.push(total);
  return out;
}
