/**
 * Read-side: search the discovery catalog and see coverage — which known MCP
 * servers are resolved to a runnable target and whether we have graded them
 * yet. No sync/resolution is triggered; this only reads catalog_servers and
 * cross-checks hosted_runs.target.
 *
 * Usage:
 *   pnpm --filter @polygraph/scoring catalog:search -- slack
 *   pnpm --filter @polygraph/scoring catalog:search -- google drive --gradeable
 *   pnpm --filter @polygraph/scoring catalog:search -- --gradeable --ungraded --kind npm --limit 40
 *   pnpm --filter @polygraph/scoring catalog:search -- git --json
 */

import type { SupabaseClient } from "@supabase/supabase-js";
import { getSupabaseClient } from "../supabase.js";
import { parseSearchArgs, markCoverage, summarize, type SearchArgs } from "../adapters/catalog/search.js";

/** Columns we read back for each candidate. */
interface CandidateRow {
  id: string;
  name: string | null;
  repository_url: string | null;
  gradeable: boolean | null;
  grading_target: string | null;
  grading_kind: string | null;
  resolution_status: string | null;
  first_seen_at: string;
}

/** PostgREST caps `.in()` URL length; keep target lookups in modest chunks. */
const COVERAGE_CHUNK = 200;

/** Build the ilike pattern: reserved PostgREST chars stripped, spaces → wildcards. */
function likePattern(query: string): string {
  const words = query
    .replace(/[,()"*:%]/g, " ")
    .trim()
    .split(/\s+/)
    .filter(Boolean);
  return `%${words.join("%")}%`;
}

async function fetchCandidates(supabase: SupabaseClient, args: SearchArgs): Promise<CandidateRow[]> {
  // When filtering to ungraded we drop graded rows *after* the coverage join,
  // so over-fetch to still fill the page.
  const fetchLimit = args.ungradedOnly ? Math.min(args.limit * 5, 1000) : args.limit;

  let q = supabase
    .from("catalog_servers")
    .select("id,name,repository_url,gradeable,grading_target,grading_kind,resolution_status,first_seen_at");
  if (args.gradeableOnly) q = q.eq("gradeable", true);
  if (args.kind) q = q.eq("grading_kind", args.kind);
  if (args.query) {
    const like = likePattern(args.query);
    q = q.or(`name.ilike.${like},repository_url.ilike.${like},grading_target.ilike.${like}`);
  }
  q = q.order("first_seen_at", { ascending: false }).limit(fetchLimit);

  const { data, error } = await q;
  if (error) throw new Error(`catalog_servers search failed: ${error.message}`);
  return (data ?? []) as CandidateRow[];
}

/** Which of these grading_targets already have a hosted_runs row. */
async function fetchGradedTargets(
  supabase: SupabaseClient,
  candidates: CandidateRow[],
): Promise<Set<string>> {
  const targets = [...new Set(candidates.map((r) => r.grading_target).filter((t): t is string => !!t))];
  const graded = new Set<string>();
  for (let i = 0; i < targets.length; i += COVERAGE_CHUNK) {
    const chunk = targets.slice(i, i + COVERAGE_CHUNK);
    const { data, error } = await supabase.from("hosted_runs").select("target").in("target", chunk);
    if (error) throw new Error(`hosted_runs coverage lookup failed: ${error.message}`);
    for (const row of (data ?? []) as { target: string }[]) graded.add(row.target);
  }
  return graded;
}

type MarkedRow = CandidateRow & { graded: boolean };

function formatTable(rows: MarkedRow[]): string {
  if (rows.length === 0) return "  (no matches)";
  const lines = rows.map((r) => {
    const cov = r.graded ? "✓ graded  " : r.gradeable ? "· to-grade" : "· —       ";
    const kind = (r.grading_kind ?? (r.gradeable === false ? "unresolved" : "?")).padEnd(10);
    const ref = r.grading_target ?? r.repository_url ?? "(no ref)";
    const name = r.name ?? "";
    return `  ${cov}  ${kind}  ${ref}${name ? `   — ${name}` : ""}`;
  });
  return lines.join("\n");
}

async function main(): Promise<void> {
  const args = parseSearchArgs(process.argv.slice(2));
  const supabase = getSupabaseClient();

  const candidates = await fetchCandidates(supabase, args);
  const graded = await fetchGradedTargets(supabase, candidates);
  let marked = markCoverage(candidates, graded);
  if (args.ungradedOnly) marked = marked.filter((r) => !r.graded);
  marked = marked.slice(0, args.limit);

  if (args.json) {
    console.log(JSON.stringify(marked, null, 2));
    return;
  }

  const s = summarize(marked);
  const scope = args.query ? `"${args.query}"` : "catalog";
  console.log(
    `\n${scope} — ${s.total} shown · ${s.gradeable} gradeable · ${s.gradeableUngraded} gradeable & not-yet-graded\n`,
  );
  console.log(formatTable(marked));
  console.log("");
}

main().catch((err: unknown) => {
  console.error(err);
  process.exit(1);
});
