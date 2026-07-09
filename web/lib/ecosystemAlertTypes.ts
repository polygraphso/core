/**
 * Ecosystem alert-strategy types, in a client-safe module (NO `server-only`) so
 * the AlertSettingsForm client component and the server data layer share them.
 * Field names mirror the ecosystem_alert_settings columns so the PATCH body maps
 * 1:1. web/ is a standalone deploy, so these mirror packages/core/src/types.ts.
 */

export type AdvisorySeverity = "CRITICAL" | "HIGH" | "MODERATE" | "LOW";
export type EcosystemAlertFrequency = "weekly" | "off";
export type EcosystemAlertRecipientsMode = "admins" | "members" | "explicit";

/** The strategy, as the form edits it (column names). */
export interface EcosystemAlertSettingsVM {
  cve_enabled: boolean;
  cve_min_severity: AdvisorySeverity;
  grade_drop_enabled: boolean;
  new_version_enabled: boolean;
  frequency: EcosystemAlertFrequency;
  recipients_mode: EcosystemAlertRecipientsMode;
}

/** One digest recipient row for the explicit-list editor. */
export interface EcosystemAlertRecipientVM {
  id: string;
  email: string;
  source: "auto" | "explicit";
  unsubscribed: boolean;
}

/** Defaults for an ecosystem with no settings row yet (created on first save). */
export const DEFAULT_ALERT_SETTINGS: EcosystemAlertSettingsVM = {
  cve_enabled: true,
  cve_min_severity: "HIGH",
  grade_drop_enabled: true,
  new_version_enabled: true,
  frequency: "weekly",
  recipients_mode: "admins",
};
