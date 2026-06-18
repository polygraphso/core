import { getSupabaseAdmin } from "@/lib/supabase";
import { rowToRun, type HostedRunRow } from "./checksMapper";
import { ChecksSoFarView } from "./ChecksSoFarView";

async function fetchPublishedChecks() {
  const db = getSupabaseAdmin();
  if (!db) return [];

  const { data, error } = await db
    .from("hosted_runs")
    // `quality_signal` (skill rows' advisory verdict) is selected now that the
    // hosted-service 0003 migration is applied to this DB — the column exists, so the
    // query is safe. `content_hash` isn't needed: skill rows carry contentHash inside
    // `evidence` (the SkillEvidenceBundle). Server rows leave quality_signal NULL.
    .select(
      "id, target, target_kind, grade, rationale, evidence, tool_defs_fingerprint, c01, c02, c03, quality_signal",
    )
    // Server grades only — skill grades have a different evidence shape (no
    // target) and render through a server-shaped mapper here.
    .in("target_kind", ["registry_ref", "remote_url"])
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
