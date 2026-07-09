/**
 * PATCH /api/manage/[slug]/alerts — update an ecosystem's alert strategy.
 *
 * Body: any of { cve_enabled, cve_min_severity, grade_drop_enabled,
 *                new_version_enabled, frequency, recipients_mode }
 *
 * Admin/app-admin only. Upserts the singleton ecosystem_alert_settings row keyed
 * by ecosystem_id (created with DB defaults on first save). The weekly digest job
 * reads this strategy.
 */

import { guardManage } from "@/lib/manageApi";
import { getSupabaseAdmin } from "@/lib/supabase";

const SEVERITIES = new Set(["CRITICAL", "HIGH", "MODERATE", "LOW"]);
const FREQUENCIES = new Set(["weekly", "off"]);
const MODES = new Set(["admins", "members", "explicit"]);

export async function PATCH(request: Request, { params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const guard = await guardManage(slug, { requireManage: true });
  if (guard instanceof Response) return guard;
  const { access } = guard;

  let body: {
    cve_enabled?: unknown;
    cve_min_severity?: unknown;
    grade_drop_enabled?: unknown;
    new_version_enabled?: unknown;
    frequency?: unknown;
    recipients_mode?: unknown;
  };
  try {
    body = (await request.json()) as typeof body;
  } catch {
    return Response.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const patch: Record<string, unknown> = {};
  for (const key of ["cve_enabled", "grade_drop_enabled", "new_version_enabled"] as const) {
    if (typeof body[key] === "boolean") patch[key] = body[key];
  }
  if (typeof body.cve_min_severity === "string" && SEVERITIES.has(body.cve_min_severity)) {
    patch.cve_min_severity = body.cve_min_severity;
  }
  if (typeof body.frequency === "string" && FREQUENCIES.has(body.frequency)) {
    patch.frequency = body.frequency;
  }
  if (typeof body.recipients_mode === "string" && MODES.has(body.recipients_mode)) {
    patch.recipients_mode = body.recipients_mode;
  }

  if (Object.keys(patch).length === 0) {
    return Response.json({ error: "No supported fields to update." }, { status: 400 });
  }

  const db = getSupabaseAdmin();
  if (!db) return Response.json({ error: "Database not configured" }, { status: 503 });

  patch.updated_at = new Date().toISOString();
  const { error } = await db
    .from("ecosystem_alert_settings")
    .upsert({ ecosystem_id: access.ecosystem.id, ...patch }, { onConflict: "ecosystem_id" });
  if (error) {
    console.error("[manage/alerts] update failed:", error.message);
    return Response.json({ error: "Couldn't save alert settings." }, { status: 500 });
  }
  return Response.json({ ok: true });
}
