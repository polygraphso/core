/**
 * POST /api/admin/users/[id]/admin
 *
 * Body: { is_admin: boolean }
 *
 * Grants or revokes admin on a user:
 *   1. Updates profiles.is_admin in the DB.
 *   2. Syncs app_metadata.is_admin so the Supabase JWT reflects the change
 *      immediately — the client's getUser() will pick it up without a re-login.
 *
 * Gated by proxy.ts (requires an admin Supabase session).
 */
import { NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabase";

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;

  let body: { is_admin?: unknown };
  try {
    body = (await request.json()) as { is_admin?: unknown };
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  if (typeof body.is_admin !== "boolean") {
    return NextResponse.json({ error: "is_admin must be a boolean" }, { status: 400 });
  }

  const db = getSupabaseAdmin();
  if (!db) {
    return NextResponse.json({ error: "Database not configured" }, { status: 503 });
  }

  // Update the profiles table (source of truth).
  const { error: profileError } = await db
    .from("profiles")
    .upsert({ id, is_admin: body.is_admin }, { onConflict: "id" });

  if (profileError) {
    return NextResponse.json({ error: profileError.message }, { status: 500 });
  }

  // Sync to app_metadata so the JWT reflects the change immediately.
  const { error: authError } = await db.auth.admin.updateUserById(id, {
    app_metadata: { is_admin: body.is_admin },
  });

  if (authError) {
    // Non-fatal: profiles row is already updated; JWT will be stale until re-login.
    console.warn("Failed to sync app_metadata for user", id, authError.message);
  }

  return NextResponse.json({ ok: true, is_admin: body.is_admin });
}
