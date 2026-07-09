/**
 * PATCH  /api/manage/[slug]/entries/[id] — curate an entry (visible / featured /
 *        cohort / position / metadata). This is the "choose what's displayed"
 *        surface: toggling `visible` shows or hides it on the public page.
 * DELETE /api/manage/[slug]/entries/[id] — remove an entry.
 *
 * Any member may curate/remove. Every write is scoped to (id, ecosystem_id) so a
 * member of one ecosystem can never touch another's rows.
 */

import { guardManage } from "@/lib/manageApi";
import { getSupabaseAdmin } from "@/lib/supabase";
import type { EcosystemEntryMetadata } from "@/lib/ecosystemTypes";

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ slug: string; id: string }> },
) {
  const { slug, id } = await params;
  const guard = await guardManage(slug);
  if (guard instanceof Response) return guard;
  const { access } = guard;

  let body: {
    visible?: unknown;
    featured?: unknown;
    cohort?: unknown;
    position?: unknown;
    metadata?: unknown;
  };
  try {
    body = (await request.json()) as typeof body;
  } catch {
    return Response.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const patch: Record<string, unknown> = {};
  if (typeof body.visible === "boolean") patch.visible = body.visible;
  if (typeof body.featured === "boolean") patch.featured = body.featured;
  if (body.cohort === null || typeof body.cohort === "string") {
    patch.cohort = typeof body.cohort === "string" ? body.cohort.trim().slice(0, 120) || null : null;
  }
  if (typeof body.position === "number" && Number.isFinite(body.position)) {
    patch.position = Math.trunc(body.position);
  }
  if (body.metadata && typeof body.metadata === "object" && !Array.isArray(body.metadata)) {
    patch.metadata = body.metadata as EcosystemEntryMetadata;
  }

  if (Object.keys(patch).length === 0) {
    return Response.json({ error: "No supported fields to update." }, { status: 400 });
  }

  const db = getSupabaseAdmin();
  if (!db) return Response.json({ error: "Database not configured" }, { status: 503 });

  const { data, error } = await db
    .from("ecosystem_entries")
    .update(patch)
    .eq("id", id)
    .eq("ecosystem_id", access.ecosystem.id)
    .select("id")
    .maybeSingle();

  if (error) {
    console.error("[manage/entries/:id] update failed:", error.message);
    return Response.json({ error: "Couldn't update the entry." }, { status: 500 });
  }
  if (!data) return Response.json({ error: "Not found" }, { status: 404 });
  return Response.json({ ok: true });
}

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ slug: string; id: string }> },
) {
  const { slug, id } = await params;
  const guard = await guardManage(slug);
  if (guard instanceof Response) return guard;
  const { access } = guard;

  const db = getSupabaseAdmin();
  if (!db) return Response.json({ error: "Database not configured" }, { status: 503 });

  const { error } = await db
    .from("ecosystem_entries")
    .delete()
    .eq("id", id)
    .eq("ecosystem_id", access.ecosystem.id);

  if (error) {
    console.error("[manage/entries/:id] delete failed:", error.message);
    return Response.json({ error: "Couldn't remove the entry." }, { status: 500 });
  }
  return Response.json({ ok: true });
}
