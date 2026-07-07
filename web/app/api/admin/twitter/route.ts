/**
 * POST /api/admin/twitter — create a blank draft thread and return its id.
 *
 * The Admin › Twitter "New thread" button calls this, then routes to the new
 * thread's editor. Gated by proxy.ts (/api/admin/*).
 */
import { getSupabaseAdmin } from "@/lib/supabase";

export async function POST() {
  const db = getSupabaseAdmin();
  if (!db) return Response.json({ error: "Database not configured" }, { status: 500 });

  // Unique, human-ish slug; the editor lets you rename it.
  const slug = `untitled-${crypto.randomUUID().slice(0, 8)}`;

  const { data, error } = await db
    .from("twitter_threads")
    .insert({
      slug,
      title: "Untitled thread",
      status: "draft",
      tweets: [{ text: "" }],
    })
    .select("id")
    .single();

  if (error) return Response.json({ error: error.message }, { status: 500 });
  return Response.json({ id: data.id });
}
