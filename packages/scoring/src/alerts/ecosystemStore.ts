/**
 * The DB seam for the ecosystem weekly-digest engine (runEcosystemAlerts). The
 * engine depends on this interface, not supabase-js, so it is unit-testable with
 * a fake store. All access is service-role (RLS-bypassing); never from the browser.
 */

import type { SupabaseClient } from "@supabase/supabase-js";
import type { AdvisorySeverity } from "../adapters/depsdev.js";
import type { PublishedGrade } from "./store.js";

export type RecipientsMode = "admins" | "members" | "explicit";

/** The strategy for one ecosystem, joined to its slug/name for the digest links. */
export interface EcosystemAlertSettings {
  ecosystem_id: string;
  slug: string;
  name: string;
  cve_enabled: boolean;
  cve_min_severity: AdvisorySeverity;
  grade_drop_enabled: boolean;
  new_version_enabled: boolean;
  frequency: "weekly" | "off";
  recipients_mode: RecipientsMode;
  last_digest_period: string | null;
  /** Price override joined from ecosystems (null = default, 0 = comped). */
  monthly_price_usd: number | null;
}

export interface EcosystemRecipient {
  id: string;
  email: string;
  unsubscribe_token: string;
}

export interface DigestEntry {
  id: string;
  target: string;
  target_kind: "registry_ref" | "remote_url" | "skill";
  name: string;
}

export interface EntryAdvisory {
  ghsa: string;
  cveIds: string[];
  severity: AdvisorySeverity | null;
  fixedVersion: string | null;
  url: string | null;
}

export interface EntryState {
  last_seen_run_id: string | null;
  last_seen_grade: string | null;
  last_seen_version: string | null;
}

export interface EcosystemAlertStore {
  /** Configured ecosystems due this ISO week (frequency='weekly', not yet done). */
  dueEcosystems(periodKey: string): Promise<EcosystemAlertSettings[]>;
  /**
   * True when the ecosystem has a live verified payment (an ecosystem_payments
   * row with status='active' and end_at in the future). The digest trusts the DB
   * status — the web console is what reconciles it with the chain.
   */
  hasActivePayment(ecosystemId: string): Promise<boolean>;
  /** Resolve the digest recipient set for a mode (mints auto tokens as needed). */
  recipientsFor(ecosystemId: string, mode: RecipientsMode): Promise<EcosystemRecipient[]>;
  /** Entries (with a target) for an ecosystem. */
  entriesFor(ecosystemId: string): Promise<DigestEntry[]>;
  /** Current advisories per package_key (already is_current_affected, not withdrawn). */
  advisoriesForTargets(packageKeys: string[]): Promise<Map<string, EntryAdvisory[]>>;
  /** Latest published grade for a target (reused from the monitor engine). */
  latestPublishedGrade(target: string): Promise<PublishedGrade | null>;
  entryState(entryId: string): Promise<EntryState | null>;
  advanceEntryState(entryId: string, state: EntryState): Promise<void>;
  /** Claim a (recipient, period) delivery; null if already claimed (weekly dedup). */
  claimEcosystemDelivery(
    recipientId: string,
    periodKey: string,
    ecosystemId: string,
    email: string,
  ): Promise<string | null>;
  markEcosystemDelivery(
    id: string,
    status: "sent" | "failed",
    detail: { resendMessageId?: string | null; error?: string | null },
  ): Promise<void>;
  /** Record that this ISO week's digest has been processed for the ecosystem. */
  touchDigestPeriod(ecosystemId: string, periodKey: string): Promise<void>;
}

interface SettingsJoinRow {
  ecosystem_id: string;
  cve_enabled: boolean;
  cve_min_severity: AdvisorySeverity;
  grade_drop_enabled: boolean;
  new_version_enabled: boolean;
  frequency: "weekly" | "off";
  recipients_mode: RecipientsMode;
  last_digest_period: string | null;
  ecosystems:
    | { slug: string; name: string; monthly_price_usd: number | null }
    | { slug: string; name: string; monthly_price_usd: number | null }[]
    | null;
}

interface RecipientRow {
  id: string;
  email: string;
  unsubscribe_token: string;
  source: "auto" | "explicit";
}

interface AdvisoryJoinRow {
  package_key: string;
  fixed_version: string | null;
  advisories:
    | { ghsa_id: string; cve_ids: string[] | null; severity: AdvisorySeverity | null; url: string | null; withdrawn_at: string | null }
    | Array<{ ghsa_id: string; cve_ids: string[] | null; severity: AdvisorySeverity | null; url: string | null; withdrawn_at: string | null }>
    | null;
}

function one<T>(v: T | T[] | null): T | null {
  if (v == null) return null;
  return Array.isArray(v) ? v[0] ?? null : v;
}

export function supabaseEcosystemAlertStore(supabase: SupabaseClient): EcosystemAlertStore {
  return {
    async dueEcosystems(periodKey) {
      const { data, error } = await supabase
        .from("ecosystem_alert_settings")
        .select(
          "ecosystem_id, cve_enabled, cve_min_severity, grade_drop_enabled, new_version_enabled, frequency, recipients_mode, last_digest_period, ecosystems(slug, name, monthly_price_usd)",
        )
        .eq("frequency", "weekly")
        .or(`last_digest_period.is.null,last_digest_period.neq.${periodKey}`);
      if (error) throw new Error(`dueEcosystems: ${error.message}`);
      return ((data as SettingsJoinRow[] | null) ?? []).flatMap((row) => {
        const eco = one(row.ecosystems);
        if (!eco) return [];
        return [{
          ecosystem_id: row.ecosystem_id,
          slug: eco.slug,
          name: eco.name,
          cve_enabled: row.cve_enabled,
          cve_min_severity: row.cve_min_severity,
          grade_drop_enabled: row.grade_drop_enabled,
          new_version_enabled: row.new_version_enabled,
          frequency: row.frequency,
          recipients_mode: row.recipients_mode,
          last_digest_period: row.last_digest_period,
          monthly_price_usd: eco.monthly_price_usd,
        }];
      });
    },

    async hasActivePayment(ecosystemId) {
      const { data, error } = await supabase
        .from("ecosystem_payments")
        .select("id")
        .eq("ecosystem_id", ecosystemId)
        .eq("status", "active")
        .gt("end_at", new Date().toISOString())
        .limit(1);
      if (error) throw new Error(`hasActivePayment(${ecosystemId}): ${error.message}`);
      return ((data as { id: string }[] | null) ?? []).length > 0;
    },

    async recipientsFor(ecosystemId, mode) {
      let memberEmails = new Set<string>();
      if (mode === "admins" || mode === "members") {
        let q = supabase
          .from("ecosystem_members")
          .select("email, role")
          .eq("ecosystem_id", ecosystemId)
          .eq("status", "active");
        if (mode === "admins") q = q.eq("role", "admin");
        const { data, error } = await q;
        if (error) throw new Error(`recipientsFor members(${ecosystemId}): ${error.message}`);
        memberEmails = new Set(
          ((data as { email: string }[] | null) ?? []).map((m) => m.email.toLowerCase()),
        );
        if (memberEmails.size > 0) {
          // Mint an auto recipient row per member (ignoreDuplicates so an existing
          // explicit / unsubscribed row is left untouched).
          const { error: upErr } = await supabase.from("ecosystem_alert_recipients").upsert(
            [...memberEmails].map((email) => ({ ecosystem_id: ecosystemId, email, source: "auto" })),
            { onConflict: "ecosystem_id,email", ignoreDuplicates: true },
          );
          if (upErr) throw new Error(`recipientsFor mint(${ecosystemId}): ${upErr.message}`);
        }
      }

      const { data, error } = await supabase
        .from("ecosystem_alert_recipients")
        .select("id, email, unsubscribe_token, source")
        .eq("ecosystem_id", ecosystemId)
        .is("unsubscribed_at", null);
      if (error) throw new Error(`recipientsFor(${ecosystemId}): ${error.message}`);

      return ((data as RecipientRow[] | null) ?? [])
        .filter((r) =>
          mode === "explicit"
            ? r.source === "explicit"
            : r.source === "explicit" || memberEmails.has(r.email.toLowerCase()),
        )
        .map((r) => ({ id: r.id, email: r.email, unsubscribe_token: r.unsubscribe_token }));
    },

    async entriesFor(ecosystemId) {
      const { data, error } = await supabase
        .from("ecosystem_entries")
        .select("id, target, target_kind, metadata")
        .eq("ecosystem_id", ecosystemId)
        .not("target", "is", null);
      if (error) throw new Error(`entriesFor(${ecosystemId}): ${error.message}`);
      return ((data as Array<{ id: string; target: string; target_kind: DigestEntry["target_kind"]; metadata: { name?: string; project?: string } }> | null) ?? [])
        .map((e) => ({
          id: e.id,
          target: e.target,
          target_kind: e.target_kind,
          name: e.metadata?.name ?? e.metadata?.project ?? e.target,
        }));
    },

    async advisoriesForTargets(packageKeys) {
      const byKey = new Map<string, EntryAdvisory[]>();
      if (packageKeys.length === 0) return byKey;
      const { data, error } = await supabase
        .from("advisory_targets")
        .select("package_key, fixed_version, advisories(ghsa_id, cve_ids, severity, url, withdrawn_at)")
        .in("package_key", packageKeys)
        .eq("is_current_affected", true);
      if (error) throw new Error(`advisoriesForTargets: ${error.message}`);
      for (const row of (data as AdvisoryJoinRow[] | null) ?? []) {
        const adv = one(row.advisories);
        if (!adv || adv.withdrawn_at) continue;
        const list = byKey.get(row.package_key) ?? [];
        list.push({
          ghsa: adv.ghsa_id,
          cveIds: adv.cve_ids ?? [],
          severity: adv.severity,
          fixedVersion: row.fixed_version,
          url: adv.url,
        });
        byKey.set(row.package_key, list);
      }
      return byKey;
    },

    async latestPublishedGrade(target) {
      const { data, error } = await supabase
        .from("hosted_runs")
        .select("id, resolved_version, grade, commit_sha")
        .eq("target", target)
        .eq("status", "complete")
        .not("published_at", "is", null)
        .order("published_at", { ascending: false })
        .limit(1)
        .maybeSingle();
      if (error) throw new Error(`latestPublishedGrade(${target}): ${error.message}`);
      return (data as PublishedGrade | null) ?? null;
    },

    async entryState(entryId) {
      const { data, error } = await supabase
        .from("ecosystem_entry_alert_state")
        .select("last_seen_run_id, last_seen_grade, last_seen_version")
        .eq("entry_id", entryId)
        .maybeSingle();
      if (error) throw new Error(`entryState(${entryId}): ${error.message}`);
      return (data as EntryState | null) ?? null;
    },

    async advanceEntryState(entryId, state) {
      const { error } = await supabase.from("ecosystem_entry_alert_state").upsert(
        {
          entry_id: entryId,
          last_seen_run_id: state.last_seen_run_id,
          last_seen_grade: state.last_seen_grade,
          last_seen_version: state.last_seen_version,
          updated_at: new Date().toISOString(),
        },
        { onConflict: "entry_id" },
      );
      if (error) throw new Error(`advanceEntryState(${entryId}): ${error.message}`);
    },

    async claimEcosystemDelivery(recipientId, periodKey, ecosystemId, email) {
      const { data, error } = await supabase.rpc("claim_ecosystem_delivery", {
        p_recipient_id: recipientId,
        p_period_key: periodKey,
        p_ecosystem_id: ecosystemId,
        p_email: email,
      });
      if (error) throw new Error(`claimEcosystemDelivery(${recipientId}): ${error.message}`);
      return (data as string | null) ?? null;
    },

    async markEcosystemDelivery(id, status, detail) {
      const { error } = await supabase
        .from("ecosystem_alert_deliveries")
        .update({
          status,
          resend_message_id: detail.resendMessageId ?? null,
          error: detail.error ?? null,
          sent_at: status === "sent" ? new Date().toISOString() : null,
        })
        .eq("id", id);
      if (error) throw new Error(`markEcosystemDelivery(${id}): ${error.message}`);
    },

    async touchDigestPeriod(ecosystemId, periodKey) {
      const { error } = await supabase
        .from("ecosystem_alert_settings")
        .update({ last_digest_period: periodKey, last_cve_sent_at: new Date().toISOString() })
        .eq("ecosystem_id", ecosystemId);
      if (error) throw new Error(`touchDigestPeriod(${ecosystemId}): ${error.message}`);
    },
  };
}
