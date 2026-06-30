/**
 * POST /api/admin/publish  — publish a graded-but-draft hosted_runs row.
 *
 * A re-grade lands a grade-only row (published_at NULL). This sets published_at
 * so the fresh grade goes live on the public report and becomes mintable (the
 * attest route requires a published row). Gated by proxy.ts (/api/admin/*).
 * Only `status='complete'` rows can be published.
 */
import { getSupabaseAdmin } from "@/lib/supabase";

export async function POST(request: Request) {
  let body: { hosted_run_id?: unknown };
  try {
    body = (await request.json()) as { hosted_run_id?: unknown };
  } catch {
    return Response.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const rawId = body.hosted_run_id;
  if (typeof rawId !== "string" && typeof rawId !== "number") {
    return Response.json({ error: "hosted_run_id is required" }, { status: 400 });
  }
  const id = String(rawId);

  const db = getSupabaseAdmin();
  if (!db) return Response.json({ error: "Database not configured" }, { status: 500 });

  const { data, error } = await db
    .from("hosted_runs")
    .update({ published_at: new Date().toISOString() })
    .eq("id", id)
    .eq("status", "complete")
    .select("id, published_at")
    .maybeSingle();
  if (error) return Response.json({ error: error.message }, { status: 500 });
  if (!data) return Response.json({ error: "Completed run not found" }, { status: 404 });

  return Response.json({ status: "published", id: data.id, published_at: data.published_at });
}
