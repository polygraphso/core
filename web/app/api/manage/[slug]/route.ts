/**
 * PATCH /api/manage/[slug] — update an ecosystem's editorial + visibility settings.
 *
 * Body: any of { name, blurb, page_config, is_public, is_listed, noindex }
 *
 * Admin/app-admin only. `page_config` carries the generic renderer's presentation
 * (cohort labels/order, methodology note, CTA, footer). `slug` is immutable here
 * (changing it would break inbound links); rename via a new ecosystem if needed.
 */

import { guardManage } from "@/lib/manageApi";
import { getSupabaseAdmin } from "@/lib/supabase";
import type { EcosystemPageConfig } from "@/lib/ecosystemTypes";

export async function PATCH(request: Request, { params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const guard = await guardManage(slug, { requireManage: true });
  if (guard instanceof Response) return guard;
  const { access } = guard;

  let body: {
    name?: unknown;
    blurb?: unknown;
    page_config?: unknown;
    is_public?: unknown;
    is_listed?: unknown;
    noindex?: unknown;
  };
  try {
    body = (await request.json()) as typeof body;
  } catch {
    return Response.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const patch: Record<string, unknown> = {};
  if (typeof body.name === "string" && body.name.trim().length > 0) {
    patch.name = body.name.trim().slice(0, 200);
  }
  if (body.blurb === null || typeof body.blurb === "string") {
    patch.blurb = typeof body.blurb === "string" ? body.blurb.slice(0, 2000) : null;
  }
  if (body.page_config && typeof body.page_config === "object" && !Array.isArray(body.page_config)) {
    patch.page_config = body.page_config as EcosystemPageConfig;
  }
  for (const key of ["is_public", "is_listed", "noindex"] as const) {
    if (typeof body[key] === "boolean") patch[key] = body[key];
  }

  if (Object.keys(patch).length === 0) {
    return Response.json({ error: "No supported fields to update." }, { status: 400 });
  }

  const db = getSupabaseAdmin();
  if (!db) return Response.json({ error: "Database not configured" }, { status: 503 });

  const { error } = await db.from("ecosystems").update(patch).eq("id", access.ecosystem.id);
  if (error) {
    console.error("[manage/settings] update failed:", error.message);
    return Response.json({ error: "Couldn't save settings." }, { status: 500 });
  }
  return Response.json({ ok: true });
}
