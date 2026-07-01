import { NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabase";

export const runtime = "nodejs";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const q = (searchParams.get("q") ?? "").trim();

  if (q.length < 2) {
    return NextResponse.json({ results: [] });
  }

  const db = getSupabaseAdmin();
  if (!db) return NextResponse.json({ results: [] });

  const { data } = await db
    .from("hosted_runs")
    .select("target, grade")
    .eq("status", "complete")
    .not("published_at", "is", null)
    .ilike("target", `%${q}%`)
    .order("published_at", { ascending: false })
    .limit(40);

  // Deduplicate: keep first (latest) grade per target.
  const seen = new Set<string>();
  const results: { target: string; grade: string | null }[] = [];
  for (const row of (data ?? []) as { target: string; grade: string | null }[]) {
    if (!seen.has(row.target)) {
      seen.add(row.target);
      results.push({ target: row.target, grade: row.grade });
    }
    if (results.length >= 8) break;
  }

  return NextResponse.json({ results });
}
