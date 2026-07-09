/**
 * The ecosystem weekly-digest engine. For each configured ecosystem due this ISO
 * week it builds one digest per recipient covering the strategy's enabled sections:
 *   - CVEs to fix  — current advisories on the ecosystem's npm/pypi/github entries,
 *                    filtered to the CVE severity floor.
 *   - Grade drops  — an entry whose latest published grade is worse than the one we
 *                    last reported (gradeDropped against the entry watermark).
 *   - New-version regrades — an entry with a newly-landed published grade; also
 *                    fires a best-effort freshness regrade (enqueueRegradeIfDrifted).
 *
 * One email per recipient per ISO week: the (recipient_id, period_key) claim is the
 * dedup, exactly as the per-server monitor engine uses (monitor_id, hosted_run_id).
 * Store-seam design keeps it unit-testable with a fake store.
 */

import { normalizeTargetKey } from "../advisories/ingest.js";
import { buildEcosystemDigestEmail, type EcosystemCveItem, type EcosystemGradeItem, type EmailSender } from "./email.js";
import { gradeDropped } from "./grades.js";
import { enqueueRegradeIfDrifted, type DriftEnqueueDeps } from "./alerts.js";
import type { AlertStore } from "./store.js";
import type {
  DigestEntry,
  EcosystemAlertSettings,
  EcosystemAlertStore,
  EntryState,
} from "./ecosystemStore.js";
import type { AdvisorySeverity } from "../adapters/depsdev.js";

const SEVERITY_RANK: Record<AdvisorySeverity, number> = { CRITICAL: 4, HIGH: 3, MODERATE: 2, LOW: 1 };

/**
 * ISO-8601 week key for a date, e.g. "2026-W28". Shifts the date to the Thursday
 * of its ISO week (whose calendar year IS the ISO week-numbering year), then
 * counts weeks from Jan 1 of that year.
 */
export function isoWeek(date: Date): string {
  const target = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
  const dayNr = (target.getUTCDay() + 6) % 7; // Mon=0 … Sun=6
  target.setUTCDate(target.getUTCDate() - dayNr + 3); // Thursday of this ISO week
  const year = target.getUTCFullYear();
  const jan1 = Date.UTC(year, 0, 1);
  const week = 1 + Math.round((target.getTime() - jan1) / 86400000 / 7);
  return `${year}-W${String(week).padStart(2, "0")}`;
}

export interface EcosystemAlertsDeps {
  /** The ISO week being processed (caller computes it: isoWeek(now)). */
  periodKey: string;
  sender?: EmailSender;
  siteUrl?: string;
  /** For the new-version freshness enqueue — reuses the monitor engine's machinery. */
  alertStore?: AlertStore;
  driftDeps?: DriftEnqueueDeps;
  /** Test override: send to this address only, bypassing recipient resolution + claim. */
  overrideRecipient?: string;
  /** Compute + compose (+ send via the given sender) but never write to the DB. */
  dryRun?: boolean;
  log?: (m: string) => void;
}

export interface EcosystemAlertsResult {
  ecosystems: number;
  processed: number;
  digestsSent: number;
  failed: number;
  regradesEnqueued: number;
  skipped: Array<{ ecosystem: string; reason: string }>;
}

function meetsFloor(sev: AdvisorySeverity | null, floor: AdvisorySeverity): boolean {
  if (!sev) return false;
  return SEVERITY_RANK[sev] >= SEVERITY_RANK[floor];
}

function driftKind(kind: DigestEntry["target_kind"]): "registry_ref" | "skill" {
  return kind === "skill" ? "skill" : "registry_ref";
}

/** A reported grade change awaiting a send-gated watermark advance. */
interface ReportedState {
  entryId: string;
  state: EntryState;
}

export async function runEcosystemAlerts(
  store: EcosystemAlertStore,
  deps: EcosystemAlertsDeps,
): Promise<EcosystemAlertsResult> {
  const log = deps.log ?? (() => {});
  const { periodKey } = deps;

  const due = await store.dueEcosystems(periodKey);
  const result: EcosystemAlertsResult = {
    ecosystems: due.length,
    processed: 0,
    digestsSent: 0,
    failed: 0,
    regradesEnqueued: 0,
    skipped: [],
  };

  for (const eco of due) {
    try {
      await processEcosystem(store, deps, eco, periodKey, result, log);
      result.processed += 1;
    } catch (err) {
      result.skipped.push({ ecosystem: eco.slug, reason: err instanceof Error ? err.message : String(err) });
    }
  }

  return result;
}

async function processEcosystem(
  store: EcosystemAlertStore,
  deps: EcosystemAlertsDeps,
  eco: EcosystemAlertSettings,
  periodKey: string,
  result: EcosystemAlertsResult,
  log: (m: string) => void,
): Promise<void> {
  const entries = await store.entriesFor(eco.ecosystem_id);
  // A dry run or a --to test send composes (and may send) but never writes: no
  // claim, no watermark advance, no digest-period close — so it can't poison the
  // real weekly run.
  const noWrite = deps.dryRun === true || deps.overrideRecipient != null;

  // ── CVE section ──
  const cveItems: EcosystemCveItem[] = [];
  if (eco.cve_enabled) {
    const covered = entries.filter((e) => e.target_kind !== "remote_url");
    const keys = [...new Set(covered.map((e) => normalizeTargetKey(e.target)))];
    const advMap = await store.advisoriesForTargets(keys);
    for (const entry of covered) {
      const advs = (advMap.get(normalizeTargetKey(entry.target)) ?? []).filter((a) =>
        meetsFloor(a.severity, eco.cve_min_severity),
      );
      if (advs.length > 0) cveItems.push({ target: entry.target, name: entry.name, advisories: advs });
    }
  }

  // ── Grade-drop + new-version section (over every entry with a target) ──
  const gradeDrops: EcosystemGradeItem[] = [];
  const newVersions: EcosystemGradeItem[] = [];
  const reported: ReportedState[] = [];

  for (const entry of entries) {
    // Best-effort freshness: enqueue a regrade if the entry's stream has drifted.
    if (eco.new_version_enabled && deps.alertStore && deps.driftDeps) {
      const outcome = await enqueueRegradeIfDrifted(
        deps.alertStore,
        entry.target,
        driftKind(entry.target_kind),
        deps.driftDeps,
      );
      if (outcome.enqueued) result.regradesEnqueued += 1;
    }

    const latest = await store.latestPublishedGrade(entry.target);
    if (!latest) continue;
    const state = await store.entryState(entry.id);
    const nextState: EntryState = {
      last_seen_run_id: latest.id,
      last_seen_grade: latest.grade,
      last_seen_version: latest.resolved_version,
    };

    if (!state) {
      // First sight — seed the baseline (nothing to report against). Immediate,
      // since no unsent report rides on it.
      if (!noWrite) await store.advanceEntryState(entry.id, nextState);
      continue;
    }
    if (latest.id === state.last_seen_run_id) continue; // no change since last digest

    const dropped = eco.grade_drop_enabled && gradeDropped(state.last_seen_grade, latest.grade);
    if (dropped) {
      gradeDrops.push({
        target: entry.target,
        name: entry.name,
        grade: latest.grade ?? "?",
        priorGrade: state.last_seen_grade,
        version: latest.resolved_version,
      });
    }
    if (eco.new_version_enabled) {
      newVersions.push({
        target: entry.target,
        name: entry.name,
        grade: latest.grade ?? "?",
        priorGrade: state.last_seen_grade,
        version: latest.resolved_version,
      });
    }

    if (dropped || eco.new_version_enabled) {
      // Reported — advance only after a successful send.
      reported.push({ entryId: entry.id, state: nextState });
    } else {
      // A new run with nothing to report (e.g. grade unchanged, new-version off).
      // Advance the watermark now so we don't re-detect it every week.
      if (!noWrite) await store.advanceEntryState(entry.id, nextState);
    }
  }

  if (cveItems.length === 0 && gradeDrops.length === 0 && newVersions.length === 0) {
    // Nothing to send — but baselines/silent advances above are already recorded.
    if (!noWrite) await store.touchDigestPeriod(eco.ecosystem_id, periodKey);
    return;
  }

  const recipients = deps.overrideRecipient
    ? [{ id: "override", email: deps.overrideRecipient, unsubscribe_token: "override" }]
    : await store.recipientsFor(eco.ecosystem_id, eco.recipients_mode);

  let anySent = false;
  for (const recipient of recipients) {
    // The claim is the weekly dedup; a dry run / test override bypasses it (the
    // sim id always "claims" so the compose + send path is exercised).
    const deliveryId = noWrite
      ? "sim"
      : await store.claimEcosystemDelivery(recipient.id, periodKey, eco.ecosystem_id, recipient.email);
    if (!deliveryId) continue; // already delivered this ISO week

    const email = buildEcosystemDigestEmail({
      ecosystemName: eco.name,
      ecosystemSlug: eco.slug,
      cveItems,
      gradeDrops,
      newVersions,
      unsubscribeToken: recipient.unsubscribe_token,
      siteUrl: deps.siteUrl,
    });

    if (!deps.sender) throw new Error("no email sender configured");
    try {
      const sent = await deps.sender.send(recipient.email, email);
      anySent = true;
      result.digestsSent += 1;
      if (!noWrite) {
        await store.markEcosystemDelivery(deliveryId, "sent", { resendMessageId: sent.id });
      }
      log(`[ecosystem-alerts] sent digest → ${recipient.email} (${eco.slug})`);
    } catch (sendErr) {
      const msg = sendErr instanceof Error ? sendErr.message : String(sendErr);
      result.failed += 1;
      if (!noWrite) {
        await store.markEcosystemDelivery(deliveryId, "failed", { error: msg });
      }
      log(`[ecosystem-alerts] send failed → ${recipient.email} (${eco.slug}): ${msg}`);
    }
  }

  // Advance reported watermarks + close the week only when a digest actually went
  // out (so a total send failure re-reports next run). A dry run / test override
  // never mutates state.
  if (anySent && !noWrite) {
    for (const r of reported) await store.advanceEntryState(r.entryId, r.state);
    await store.touchDigestPeriod(eco.ecosystem_id, periodKey);
  }
}
