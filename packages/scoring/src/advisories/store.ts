/**
 * The DB seam for the advisory-ingest engine. runAdvisoryIngest depends on this
 * interface, not on supabase-js directly, so the engine is unit-testable with a
 * fake store and the raw queries live in one place (supabaseAdvisoryStore).
 *
 * All access is service-role (RLS-bypassing); never reached from the browser.
 */

import type { SupabaseClient } from "@supabase/supabase-js";
import type { AdvisorySeverity } from "../adapters/depsdev.js";

export type AdvisorySource = "depsdev" | "github" | "osv";
export type AdvisoryEcosystem = "npm" | "pypi" | "github";

/** One security advisory to upsert (keyed by ghsa_id). */
export interface NormalizedAdvisory {
  ghsa_id: string;
  source: AdvisorySource;
  cve_ids: string[];
  severity: AdvisorySeverity | null;
  cvss: number | null;
  cvss_vector: string | null;
  summary: string | null;
  url: string | null;
  published_at: string | null;
  withdrawn_at: string | null;
}

/** The mapping of an advisory to one affected package (by versionless key). */
export interface NormalizedAdvisoryTarget {
  package_key: string;
  ecosystem: AdvisoryEcosystem;
  affected_range: string | null;
  fixed_version: string | null;
  current_version: string | null;
}

/** A distinct ecosystem entry target the ingest should cover. */
export interface EntryTarget {
  target: string;
  target_kind: string;
}

export interface AdvisoryStore {
  /** Distinct, non-null gradeable targets across all ecosystem_entries. */
  distinctEcosystemTargets(): Promise<EntryTarget[]>;
  /** Upsert an advisory by ghsa_id; returns its id. */
  upsertAdvisory(advisory: NormalizedAdvisory): Promise<string>;
  /** Upsert the (advisory, package_key) mapping, refreshing range/version. */
  upsertAdvisoryTarget(advisoryId: string, target: NormalizedAdvisoryTarget): Promise<void>;
  /**
   * Retire advisory_targets for a package_key whose advisory is no longer in the
   * currently-seen set (e.g. the package was patched) — flips is_current_affected
   * to false so the CVE tab reflects the current version, not history.
   */
  markTargetsStale(packageKey: string, seenGhsaIds: string[]): Promise<void>;
}

interface AdvisoryTargetJoinRow {
  id: string;
  advisories: { ghsa_id: string } | { ghsa_id: string }[] | null;
}

/** supabase-js backed AdvisoryStore. */
export function supabaseAdvisoryStore(supabase: SupabaseClient): AdvisoryStore {
  return {
    async distinctEcosystemTargets() {
      // remote_url targets have no package advisory feed → excluded (not covered).
      const { data, error } = await supabase
        .from("ecosystem_entries")
        .select("target, target_kind")
        .not("target", "is", null)
        .in("target_kind", ["registry_ref", "skill"]);
      if (error) throw new Error(`distinctEcosystemTargets: ${error.message}`);
      const seen = new Map<string, EntryTarget>();
      for (const row of (data ?? []) as EntryTarget[]) {
        if (row.target && !seen.has(row.target)) seen.set(row.target, row);
      }
      return [...seen.values()];
    },

    async upsertAdvisory(advisory) {
      const { data, error } = await supabase.rpc("upsert_advisory", {
        p_ghsa_id: advisory.ghsa_id,
        p_source: advisory.source,
        p_cve_ids: advisory.cve_ids,
        p_severity: advisory.severity,
        p_cvss: advisory.cvss,
        p_cvss_vector: advisory.cvss_vector,
        p_summary: advisory.summary,
        p_url: advisory.url,
        p_published_at: advisory.published_at,
        p_withdrawn_at: advisory.withdrawn_at,
      });
      if (error) throw new Error(`upsertAdvisory(${advisory.ghsa_id}): ${error.message}`);
      const id = data as string | null;
      if (!id) throw new Error(`upsertAdvisory(${advisory.ghsa_id}): no id returned`);
      return id;
    },

    async upsertAdvisoryTarget(advisoryId, target) {
      const { error } = await supabase
        .from("advisory_targets")
        .upsert(
          {
            advisory_id: advisoryId,
            package_key: target.package_key,
            ecosystem: target.ecosystem,
            affected_range: target.affected_range,
            fixed_version: target.fixed_version,
            current_version: target.current_version,
            is_current_affected: true,
            last_seen_at: new Date().toISOString(),
          },
          { onConflict: "advisory_id,package_key" },
        );
      if (error) throw new Error(`upsertAdvisoryTarget(${target.package_key}): ${error.message}`);
    },

    async markTargetsStale(packageKey, seenGhsaIds) {
      const { data, error } = await supabase
        .from("advisory_targets")
        .select("id, advisories(ghsa_id)")
        .eq("package_key", packageKey)
        .eq("is_current_affected", true);
      if (error) throw new Error(`markTargetsStale(${packageKey}): ${error.message}`);

      const seen = new Set(seenGhsaIds);
      const staleIds: string[] = [];
      for (const row of (data ?? []) as AdvisoryTargetJoinRow[]) {
        const adv = Array.isArray(row.advisories) ? row.advisories[0] : row.advisories;
        if (adv && !seen.has(adv.ghsa_id)) staleIds.push(row.id);
      }
      if (staleIds.length === 0) return;

      const { error: updErr } = await supabase
        .from("advisory_targets")
        .update({ is_current_affected: false, last_seen_at: new Date().toISOString() })
        .in("id", staleIds);
      if (updErr) throw new Error(`markTargetsStale(${packageKey}) update: ${updErr.message}`);
    },
  };
}
