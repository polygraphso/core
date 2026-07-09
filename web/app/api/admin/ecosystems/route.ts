/**
 * POST /api/admin/ecosystems — provision a new ecosystem and (optionally) seed its
 * first ecosystem-admin by email.
 *
 * App-admin only: gated by proxy.ts (/api/admin/* requires is_admin). Ecosystems
 * are polygraph-provisioned, not self-serve — a global admin creates the shell and
 * hands it to a partner's admin, who then invites their own members.
 *
 * Body: { slug, name, blurb?, firstAdminEmail? }
 */

import { getSession } from "@/lib/session";
import { getSupabaseAdmin } from "@/lib/supabase";

const SLUG_RE = /^[a-z0-9][a-z0-9-]{0,62}$/;
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

export async function POST(request: Request) {
  const session = await getSession();
  // Defense in depth — proxy already enforces is_admin on /api/admin/*.
  if (!session?.isAdmin) return Response.json({ error: "Forbidden" }, { status: 403 });

  let body: { slug?: unknown; name?: unknown; blurb?: unknown; firstAdminEmail?: unknown };
  try {
    body = (await request.json()) as typeof body;
  } catch {
    return Response.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const slug = typeof body.slug === "string" ? body.slug.trim().toLowerCase() : "";
  const name = typeof body.name === "string" ? body.name.trim() : "";
  if (!SLUG_RE.test(slug)) {
    return Response.json({ error: "Slug must be lowercase letters, digits, or hyphens." }, { status: 400 });
  }
  if (name.length < 1 || name.length > 200) {
    return Response.json({ error: "Name is required (≤200 chars)." }, { status: 400 });
  }
  const blurb = typeof body.blurb === "string" && body.blurb.trim() ? body.blurb.trim().slice(0, 2000) : null;
  const firstAdminEmail =
    typeof body.firstAdminEmail === "string" ? body.firstAdminEmail.trim().toLowerCase() : "";
  if (firstAdminEmail && (!EMAIL_RE.test(firstAdminEmail) || firstAdminEmail.length > 254)) {
    return Response.json({ error: "First-admin email is invalid." }, { status: 400 });
  }

  const db = getSupabaseAdmin();
  if (!db) return Response.json({ error: "Database not configured" }, { status: 503 });

  const { data, error } = await db
    .from("ecosystems")
    .insert({ slug, name, blurb, created_by: session.userId })
    .select("id, slug, name")
    .single();

  if (error) {
    if ((error as { code?: string }).code === "23505") {
      return Response.json({ error: "That slug is already taken." }, { status: 409 });
    }
    console.error("[admin/ecosystems] create failed:", error.message);
    return Response.json({ error: "Couldn't create the ecosystem." }, { status: 500 });
  }

  const ecosystem = data as { id: string; slug: string; name: string };

  if (firstAdminEmail) {
    const { error: memErr } = await db.from("ecosystem_members").insert({
      ecosystem_id: ecosystem.id,
      email: firstAdminEmail,
      role: "admin",
      invited_by: session.userId,
    });
    if (memErr) {
      console.error("[admin/ecosystems] seed admin failed:", memErr.message);
      // The ecosystem exists; surface a soft warning rather than failing the create.
      return Response.json({ ok: true, ecosystem, warning: "Created, but couldn't seed the first admin." });
    }
  }

  return Response.json({ ok: true, ecosystem }, { status: 201 });
}
