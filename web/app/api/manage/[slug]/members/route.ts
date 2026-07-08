/**
 * POST /api/manage/[slug]/members — invite someone to help manage an ecosystem.
 *
 * Body: { email: string, role?: "admin" | "member" }
 *
 * Admin/app-admin only. Creates a pending (user_id null, status 'invited') row that
 * binds to the account on first sign-in (resolve_ecosystem_invites, via the signup
 * trigger or the lazy claim on their next dashboard visit). Re-inviting an existing
 * email updates their role without disturbing an already-bound account.
 */

import { guardManage } from "@/lib/manageApi";
import { getSupabaseAdmin } from "@/lib/supabase";

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

export async function POST(request: Request, { params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const guard = await guardManage(slug, { requireManage: true });
  if (guard instanceof Response) return guard;
  const { session, access } = guard;

  let body: { email?: unknown; role?: unknown };
  try {
    body = (await request.json()) as typeof body;
  } catch {
    return Response.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const email = typeof body.email === "string" ? body.email.trim().toLowerCase() : "";
  if (!EMAIL_RE.test(email) || email.length > 254) {
    return Response.json({ error: "Enter a valid email address." }, { status: 400 });
  }
  const role = body.role === "admin" ? "admin" : "member";

  const db = getSupabaseAdmin();
  if (!db) return Response.json({ error: "Database not configured" }, { status: 503 });

  const { error } = await db
    .from("ecosystem_members")
    .upsert(
      { ecosystem_id: access.ecosystem.id, email, role, invited_by: session.userId },
      { onConflict: "ecosystem_id,email" },
    );

  if (error) {
    console.error("[manage/members] invite failed:", error.message);
    return Response.json({ error: "Couldn't send the invite." }, { status: 500 });
  }
  return Response.json({ ok: true, email, role }, { status: 201 });
}
