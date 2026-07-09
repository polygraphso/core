/**
 * PATCH  /api/manage/[slug]/members/[id] — change a member's role (admin ↔ member).
 * DELETE /api/manage/[slug]/members/[id] — remove a member / revoke an invite.
 *
 * Admin/app-admin only. Both writes are scoped to (id, ecosystem_id). Removing or
 * demoting the ecosystem's last admin is refused so an ecosystem can't be orphaned
 * (a global app admin can still manage it either way).
 */

import { guardManage } from "@/lib/manageApi";
import { getSupabaseAdmin } from "@/lib/supabase";
import type { SupabaseClient } from "@supabase/supabase-js";

/** True when `memberId` is the only admin left on the ecosystem. */
async function isLastAdmin(
  db: SupabaseClient,
  ecosystemId: string,
  memberId: string,
): Promise<boolean> {
  const { data } = await db
    .from("ecosystem_members")
    .select("id")
    .eq("ecosystem_id", ecosystemId)
    .eq("role", "admin");
  const admins = (data as Array<{ id: string }> | null) ?? [];
  return admins.length === 1 && admins[0]?.id === memberId;
}

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ slug: string; id: string }> },
) {
  const { slug, id } = await params;
  const guard = await guardManage(slug, { requireManage: true });
  if (guard instanceof Response) return guard;
  const { access } = guard;

  let body: { role?: unknown };
  try {
    body = (await request.json()) as typeof body;
  } catch {
    return Response.json({ error: "Invalid JSON" }, { status: 400 });
  }
  if (body.role !== "admin" && body.role !== "member") {
    return Response.json({ error: 'role must be "admin" or "member"' }, { status: 400 });
  }

  const db = getSupabaseAdmin();
  if (!db) return Response.json({ error: "Database not configured" }, { status: 503 });

  if (body.role === "member" && (await isLastAdmin(db, access.ecosystem.id, id))) {
    return Response.json({ error: "Keep at least one admin." }, { status: 400 });
  }

  const { data, error } = await db
    .from("ecosystem_members")
    .update({ role: body.role })
    .eq("id", id)
    .eq("ecosystem_id", access.ecosystem.id)
    .select("id")
    .maybeSingle();

  if (error) {
    console.error("[manage/members/:id] role update failed:", error.message);
    return Response.json({ error: "Couldn't update the member." }, { status: 500 });
  }
  if (!data) return Response.json({ error: "Not found" }, { status: 404 });
  return Response.json({ ok: true });
}

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ slug: string; id: string }> },
) {
  const { slug, id } = await params;
  const guard = await guardManage(slug, { requireManage: true });
  if (guard instanceof Response) return guard;
  const { access } = guard;

  const db = getSupabaseAdmin();
  if (!db) return Response.json({ error: "Database not configured" }, { status: 503 });

  if (await isLastAdmin(db, access.ecosystem.id, id)) {
    return Response.json({ error: "Keep at least one admin." }, { status: 400 });
  }

  const { error } = await db
    .from("ecosystem_members")
    .delete()
    .eq("id", id)
    .eq("ecosystem_id", access.ecosystem.id);

  if (error) {
    console.error("[manage/members/:id] delete failed:", error.message);
    return Response.json({ error: "Couldn't remove the member." }, { status: 500 });
  }
  return Response.json({ ok: true });
}
