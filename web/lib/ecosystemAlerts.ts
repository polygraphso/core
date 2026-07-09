import "server-only";

/**
 * DB read layer for the ecosystem alert strategy. Reads the singleton
 * ecosystem_alert_settings row (returning defaults when it hasn't been saved yet)
 * and the explicit-list recipients. Written by the /api/manage/[slug]/alerts
 * routes; the weekly digest job (packages/scoring) is the other reader.
 */

import { getSupabaseAdmin } from "@/lib/supabase";
import {
  DEFAULT_ALERT_SETTINGS,
  type EcosystemAlertRecipientVM,
  type EcosystemAlertSettingsVM,
} from "@/lib/ecosystemAlertTypes";

const SETTINGS_COLUMNS =
  "cve_enabled, cve_min_severity, grade_drop_enabled, new_version_enabled, frequency, recipients_mode";

export async function loadAlertSettings(ecosystemId: string): Promise<EcosystemAlertSettingsVM> {
  const db = getSupabaseAdmin();
  if (!db) return DEFAULT_ALERT_SETTINGS;
  const { data } = await db
    .from("ecosystem_alert_settings")
    .select(SETTINGS_COLUMNS)
    .eq("ecosystem_id", ecosystemId)
    .maybeSingle();
  return (data as EcosystemAlertSettingsVM | null) ?? DEFAULT_ALERT_SETTINGS;
}

interface RecipientRow {
  id: string;
  email: string;
  source: "auto" | "explicit";
  unsubscribed_at: string | null;
}

export async function listAlertRecipients(ecosystemId: string): Promise<EcosystemAlertRecipientVM[]> {
  const db = getSupabaseAdmin();
  if (!db) return [];
  const { data } = await db
    .from("ecosystem_alert_recipients")
    .select("id, email, source, unsubscribed_at")
    .eq("ecosystem_id", ecosystemId)
    .order("created_at", { ascending: true });
  return ((data as RecipientRow[] | null) ?? []).map((r) => ({
    id: r.id,
    email: r.email,
    source: r.source,
    unsubscribed: r.unsubscribed_at !== null,
  }));
}
