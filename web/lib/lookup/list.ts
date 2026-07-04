import "server-only";
import { fetchPublishedGradeMap, type LitmusGrade } from "@/lib/hostedGrades";
import { recordAgentCall } from "@/lib/agentIdentity";
import type { LookupContext } from "./types";

export interface ListEntry {
  server_ref: string;
  polygraph: LitmusGrade;
}

export interface ListResult {
  servers: ListEntry[];
  total: number;
}

const GRADE_RANK: Record<LitmusGrade, number> = { A: 0, B: 1, C: 2, D: 3, F: 4 };

/**
 * Every server with a published polygraph grade, sorted A-first then by ref.
 * Shared by GET /api/cli/list and the hosted MCP list_servers tool.
 */
export async function runList(ctx: LookupContext): Promise<ListResult> {
  const { supabase } = ctx;

  // Per-agent observability. Best-effort — never fail the listing.
  await recordAgentCall(supabase, ctx.identity, "list");

  const gradeByRef = await fetchPublishedGradeMap(supabase);
  const entries: ListEntry[] = [...gradeByRef.entries()].map(([server_ref, polygraph]) => ({
    server_ref,
    polygraph,
  }));
  entries.sort((a, b) => {
    const r = GRADE_RANK[a.polygraph] - GRADE_RANK[b.polygraph];
    if (r !== 0) return r;
    return a.server_ref.localeCompare(b.server_ref);
  });

  return { servers: entries, total: entries.length };
}
