import type { AdminRow } from "./store";

/** The kind filter the admin table toolbar drives. "all" disables the filter;
 *  the others match a hosted_runs target_kind exactly (registry_ref = MCPs). */
export type KindFilter = "all" | "registry_ref" | "skill";

/** Filter the admin rows by a free-text server query (case-insensitive substring)
 *  and a target-kind filter. Pure so the toolbar logic is unit-tested. */
export function filterRows(rows: AdminRow[], opts: { query: string; kind: KindFilter }): AdminRow[] {
  const q = opts.query.trim().toLowerCase();
  return rows.filter((r) => {
    if (opts.kind !== "all" && r.target_kind !== opts.kind) return false;
    if (q && !r.server.toLowerCase().includes(q)) return false;
    return true;
  });
}

/** Slice a 0-indexed page out of items. */
export function paginate<T>(items: T[], page: number, pageSize: number): T[] {
  return items.slice(page * pageSize, page * pageSize + pageSize);
}

/** Number of pages for a total, never below 1 (so an empty table still has page 1). */
export function pageCount(total: number, pageSize: number): number {
  return Math.max(1, Math.ceil(total / pageSize));
}
