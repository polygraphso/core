import "server-only";
import { fetchPublishedGradeMap, type LitmusGrade } from "@/lib/hostedGrades";
import { recordAgentCall } from "@/lib/agentIdentity";
import type { LookupContext, LookupError } from "./types";

export interface ListEntry {
  server_ref: string;
  polygraph: LitmusGrade;
}

/** Always computed over the full graded corpus, never the filtered or paged slice. */
export interface ListSummary {
  total: number;
  byGrade: Record<LitmusGrade, number>;
}

export interface ListOptions {
  /** Restrict the listing to one grade. */
  grade?: LitmusGrade;
  /** Rows to return. Omitted returns every matching row (today's default shape). */
  limit?: number;
  /** Rows to skip before taking `limit`. Defaults to 0. */
  offset?: number;
}

export interface ListSuccess {
  servers: ListEntry[];
  /** Rows matching `grade` (if given), before `limit`/`offset` are applied. Equals
   *  `summary.total` when no grade filter is given. */
  total: number;
  summary: ListSummary;
}

export type ListResult = ListSuccess | LookupError;

const GRADE_RANK: Record<LitmusGrade, number> = { A: 0, B: 1, C: 2, D: 3, F: 4 };
const GRADES: readonly LitmusGrade[] = ["A", "B", "C", "D", "F"];

/**
 * Every server with a published polygraph grade, sorted A-first then by ref.
 * Shared by GET /api/cli/list and the hosted MCP list_servers tool.
 *
 * `grade`/`limit`/`offset` narrow and page the `servers` array; `summary` is
 * always computed over the whole graded corpus first, so a filtered or paged
 * caller can still see the shape of the full set (total plus a count per
 * grade). No params behaves exactly as before: every graded server, unpaged.
 */
export async function runList(ctx: LookupContext, options: ListOptions = {}): Promise<ListResult> {
  if (options.grade !== undefined && !GRADES.includes(options.grade)) {
    return { status: "error", code: 400, error: "grade must be one of A, B, C, D, F." };
  }
  if (options.limit !== undefined && (!Number.isInteger(options.limit) || options.limit <= 0)) {
    return { status: "error", code: 400, error: "limit must be a positive integer." };
  }
  if (options.offset !== undefined && (!Number.isInteger(options.offset) || options.offset < 0)) {
    return { status: "error", code: 400, error: "offset must be a non-negative integer." };
  }

  const { supabase } = ctx;

  // Per-agent observability. Best-effort: never fail the listing on a counter error.
  await recordAgentCall(supabase, ctx.identity, "list");

  const gradeByRef = await fetchPublishedGradeMap(supabase);
  const all: ListEntry[] = [...gradeByRef.entries()].map(([server_ref, polygraph]) => ({
    server_ref,
    polygraph,
  }));
  all.sort((a, b) => {
    const r = GRADE_RANK[a.polygraph] - GRADE_RANK[b.polygraph];
    if (r !== 0) return r;
    return a.server_ref.localeCompare(b.server_ref);
  });

  const byGrade: Record<LitmusGrade, number> = { A: 0, B: 0, C: 0, D: 0, F: 0 };
  for (const entry of all) byGrade[entry.polygraph]++;
  const summary: ListSummary = { total: all.length, byGrade };

  const filtered = options.grade ? all.filter((entry) => entry.polygraph === options.grade) : all;
  const offset = options.offset ?? 0;
  const page =
    options.limit !== undefined ? filtered.slice(offset, offset + options.limit) : filtered.slice(offset);

  return { servers: page, total: filtered.length, summary };
}
