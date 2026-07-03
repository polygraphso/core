/**
 * Pure helpers for the `catalog:search` read-side CLI: argument parsing, the
 * coverage mark (is a catalog server already in hosted_runs?), and the summary
 * counts. Kept side-effect-free so they are unit-testable; the script
 * (`scripts/catalog-search.ts`) owns the DB I/O and output formatting.
 */

import type { CatalogGradingKind } from "@polygraph/core";

export interface SearchArgs {
  /** Free-text term matched against name / repository_url / grading_target. */
  query: string | null;
  limit: number;
  /** Restrict to a single runnable kind. */
  kind: CatalogGradingKind | null;
  /** Only servers resolved to a runnable target (gradeable = true). */
  gradeableOnly: boolean;
  /** Only servers we have not graded yet (no matching hosted_runs.target). */
  ungradedOnly: boolean;
  /** Emit JSON instead of the human table. */
  json: boolean;
}

const KINDS = new Set<CatalogGradingKind>(["npm", "pypi", "url"]);
const DEFAULT_LIMIT = 25;

export function parseSearchArgs(argv: readonly string[]): SearchArgs {
  const args: SearchArgs = {
    query: null,
    limit: DEFAULT_LIMIT,
    kind: null,
    gradeableOnly: false,
    ungradedOnly: false,
    json: false,
  };
  const words: string[] = [];

  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === "--gradeable") args.gradeableOnly = true;
    else if (a === "--ungraded") args.ungradedOnly = true;
    else if (a === "--json") args.json = true;
    else if (a === "--limit" || a?.startsWith("--limit=")) {
      const raw = a === "--limit" ? argv[++i] : a.slice("--limit=".length);
      const n = Number(raw);
      if (!Number.isFinite(n) || n <= 0) throw new Error("--limit must be a positive number");
      args.limit = Math.floor(n);
    } else if (a === "--kind" || a?.startsWith("--kind=")) {
      const raw = a === "--kind" ? argv[++i] : a.slice("--kind=".length);
      if (!raw || !KINDS.has(raw as CatalogGradingKind)) {
        throw new Error("--kind must be one of npm|pypi|url");
      }
      args.kind = raw as CatalogGradingKind;
    } else if (a && !a.startsWith("--")) {
      words.push(a);
    }
  }

  if (words.length) args.query = words.join(" ");
  return args;
}

/** Attach `graded` to each row: true iff its runnable target is in hosted_runs. */
export function markCoverage<T extends { grading_target: string | null }>(
  rows: readonly T[],
  gradedTargets: ReadonlySet<string>,
): (T & { graded: boolean })[] {
  return rows.map((r) => ({
    ...r,
    graded: r.grading_target != null && gradedTargets.has(r.grading_target),
  }));
}

/** Headline counts over a marked result set. */
export function summarize(
  rows: readonly { gradeable: boolean | null; graded: boolean }[],
): { total: number; gradeable: number; gradeableUngraded: number } {
  let gradeable = 0;
  let gradeableUngraded = 0;
  for (const r of rows) {
    if (r.gradeable === true) {
      gradeable++;
      if (!r.graded) gradeableUngraded++;
    }
  }
  return { total: rows.length, gradeable, gradeableUngraded };
}
