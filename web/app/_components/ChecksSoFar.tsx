import { getSupabaseAdmin } from "@/lib/supabase";
import { rowToRun, type HostedRunRow } from "./checksMapper";
import { ChecksSoFarView } from "./ChecksSoFarView";

async function fetchPublishedChecks() {
  const db = getSupabaseAdmin();
  if (!db) return [];

  const { data, error } = await db
    .from("hosted_runs")
    .select(
      "id, target, target_kind, grade, rationale, evidence, tool_defs_fingerprint, c01, c02, c03",
    )
    .eq("status", "complete")
    .not("published_at", "is", null)
    .order("published_at", { ascending: true });

  if (error) {
    console.error("[ChecksSoFar] hosted_runs query failed:", error.message);
    return [];
  }

  return (data as HostedRunRow[] | null)?.map(rowToRun) ?? [];
}

export async function ChecksSoFar() {
  const runs = await fetchPublishedChecks();
  return <ChecksSoFarView runs={runs} />;
}
