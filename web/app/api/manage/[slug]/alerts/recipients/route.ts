/**
 * POST   /api/manage/[slug]/alerts/recipients — add an explicit digest recipient.
 * DELETE /api/manage/[slug]/alerts/recipients — remove one by id.
 *
 * Admin/app-admin only. Explicit recipients are used when recipients_mode is
 * 'explicit' (and are always additive to the resolved admins/members set). Adding
 * an address that was previously unsubscribed re-subscribes it.
 */

import { guardManage } from "@/lib/manageApi";
import { getSupabaseAdmin } from "@/lib/supabase";

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

export async function POST(request: Request, { params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const guard = await guardManage(slug, { requireManage: true });
  if (guard instanceof Response) return guard;
  const { access } = guard;

  let body: { email?: unknown };
  try {
    body = (await request.json()) as typeof body;
  } catch {
    return Response.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const email = typeof body.email === "string" ? body.email.trim().toLowerCase() : "";
  if (!EMAIL_RE.test(email) || email.length > 254) {
    return Response.json({ error: "Enter a valid email address." }, { status: 400 });
  }

  const db = getSupabaseAdmin();
  if (!db) return Response.json({ error: "Database not configured" }, { status: 503 });

  // Upsert on (ecosystem_id, email): re-adding an unsubscribed address resubscribes
  // it and marks it explicit (an intentional add, not an auto mirror).
  const { error } = await db
    .from("ecosystem_alert_recipients")
    .upsert(
      { ecosystem_id: access.ecosystem.id, email, source: "explicit", unsubscribed_at: null },
      { onConflict: "ecosystem_id,email" },
    );
  if (error) {
    console.error("[manage/alerts/recipients] add failed:", error.message);
    return Response.json({ error: "Couldn't add that recipient." }, { status: 500 });
  }
  return Response.json({ ok: true, email }, { status: 201 });
}

export async function DELETE(request: Request, { params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const guard = await guardManage(slug, { requireManage: true });
  if (guard instanceof Response) return guard;
  const { access } = guard;

  let body: { id?: unknown };
  try {
    body = (await request.json()) as typeof body;
  } catch {
    return Response.json({ error: "Invalid JSON" }, { status: 400 });
  }
  if (typeof body.id !== "string" || body.id.length === 0) {
    return Response.json({ error: "Missing recipient id." }, { status: 400 });
  }

  const db = getSupabaseAdmin();
  if (!db) return Response.json({ error: "Database not configured" }, { status: 503 });

  const { error } = await db
    .from("ecosystem_alert_recipients")
    .delete()
    .eq("id", body.id)
    .eq("ecosystem_id", access.ecosystem.id);
  if (error) {
    console.error("[manage/alerts/recipients] delete failed:", error.message);
    return Response.json({ error: "Couldn't remove that recipient." }, { status: 500 });
  }
  return Response.json({ ok: true });
}
