import { getSupabaseAdmin } from "@/lib/supabase";
import { rowToRun, type HostedRunRow } from "./checksMapper";
import { RecentGradesCarousel } from "./RecentGradesCarousel";

// How many recent grades the homepage carousel shows; the rest live at /mcp-index.
const LIMIT = 10;

async function fetchRecentGrades() {
  const db = getSupabaseAdmin();
  if (!db) return [];

  const { data, error } = await db
    .from("hosted_runs")
    // Same projection the index uses; rowToRun branches on target_kind (skill rows
    // read the SkillEvidenceBundle + quality_signal). Newest published first, capped.
    .select(
      "id, target, target_kind, grade, rationale, evidence, tool_defs_fingerprint, c01, c02, c03, quality_signal",
    )
    .in("target_kind", ["registry_ref", "remote_url", "skill"])
    .eq("status", "complete")
    .not("published_at", "is", null)
    .order("published_at", { ascending: false })
    .limit(LIMIT);

  if (error) {
    console.error("[RecentGrades] hosted_runs query failed:", error.message);
    return [];
  }

  return (data as HostedRunRow[] | null)?.map(rowToRun) ?? [];
}

export async function RecentGrades() {
  const runs = await fetchRecentGrades();
  return <RecentGradesCarousel runs={runs} />;
}
