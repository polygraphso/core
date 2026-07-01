/**
 * The new-version regrade alert engine. Two idempotent passes over the active
 * monitors:
 *
 *   1. ENQUEUE — for each distinct monitored target, resolve its latest registry
 *      version. If that version has no published grade yet and no monitor regrade
 *      is already in flight, enqueue a free regrade (a source='monitor' hosted_runs
 *      row). The hosted-service worker grades + auto-publishes it.
 *
 *   2. RECONCILE — for each active monitor, compare the latest published grade's
 *      row id to the monitor's watermark (last_notified_run_id). On a new id, claim
 *      a delivery (the alert_deliveries unique constraint dedups across overlapping
 *      runs), send the email best-effort, and advance the watermark.
 *
 * Scoped to monitored targets only — this is what keeps the free regrade affordable.
 * Run hourly by .github/workflows/alerts.yml; the ~1h enqueue→grade→notify latency
 * is acceptable for "your server has a new grade".
 */

import { parseServerRef, type ParsedServerRef } from "@polygraph/core";
import { fetchNpm } from "../adapters/npm.js";
import { fetchPypi } from "../adapters/pypi.js";
import { buildAlertEmail, type EmailSender } from "./email.js";
import { gradeMeetsThreshold } from "./grades.js";
import type { AlertStore } from "./store.js";

/** Default per-run enqueue cap — a cheap circuit breaker against a runaway pass. */
const DEFAULT_MAX_ENQUEUE = 50;

export interface AlertsDeps {
  /** Resolve a registry ref's latest version. Default hits npm/pypi adapters. */
  fetchLatestVersion?: (parsed: ParsedServerRef) => Promise<string | null>;
  /** Email transport. Required to send; omit in tests that don't exercise sends. */
  sender?: EmailSender;
  /** Origin for report/fix/unsubscribe links in the email. */
  siteUrl?: string;
  /** Cap on regrades enqueued in one pass. */
  maxEnqueue?: number;
  log?: (m: string) => void;
}

export interface AlertsResult {
  monitors: number;
  targets: number;
  enqueued: number;
  /** Deliveries claimed (email attempts). */
  notified: number;
  sent: number;
  failed: number;
  skipped: Array<{ target: string; reason: string }>;
}

async function defaultFetchLatestVersion(parsed: ParsedServerRef): Promise<string | null> {
  if (parsed.registry === "npm") {
    const pkg = parsed.owner ? `${parsed.owner}/${parsed.name}` : parsed.name;
    return (await fetchNpm(pkg))?.latest_version ?? null;
  }
  if (parsed.registry === "pypi") {
    return (await fetchPypi(parsed.name))?.latest_version ?? null;
  }
  // github / anything without a registry version stream: not monitorable in v1.
  return null;
}

export async function runAlerts(store: AlertStore, deps: AlertsDeps = {}): Promise<AlertsResult> {
  const fetchLatest = deps.fetchLatestVersion ?? defaultFetchLatestVersion;
  const maxEnqueue = deps.maxEnqueue ?? DEFAULT_MAX_ENQUEUE;
  const log = deps.log ?? (() => {});

  const monitors = await store.activeMonitors();
  const result: AlertsResult = {
    monitors: monitors.length,
    targets: 0,
    enqueued: 0,
    notified: 0,
    sent: 0,
    failed: 0,
    skipped: [],
  };

  // ── Pass 1: enqueue regrades for targets with an ungraded new version ───────
  const targets = [...new Set(monitors.map((m) => m.target))];
  result.targets = targets.length;

  for (const target of targets) {
    if (result.enqueued >= maxEnqueue) {
      log(`[alerts] enqueue cap (${maxEnqueue}) reached — deferring remaining targets to next run`);
      break;
    }
    try {
      const parsed = parseServerRef(target);
      if (parsed.registry !== "npm" && parsed.registry !== "pypi") {
        result.skipped.push({ target, reason: `unmonitorable registry: ${parsed.registry}` });
        continue;
      }
      const latest = await fetchLatest(parsed);
      if (!latest) {
        result.skipped.push({ target, reason: "no latest version from registry" });
        continue;
      }
      if (await store.hasPublishedGradeForVersion(target, latest)) {
        // Already graded at the latest version — reconcile (pass 2) notifies.
        continue;
      }
      if (await store.hasInFlightMonitorRegrade(target)) {
        // A regrade is already queued/running; don't enqueue a duplicate.
        continue;
      }
      await store.enqueueMonitorRegrade(target);
      result.enqueued += 1;
      log(`[alerts] enqueued regrade ${target} (latest ${latest})`);
    } catch (err) {
      result.skipped.push({ target, reason: err instanceof Error ? err.message : String(err) });
    }
  }

  // ── Pass 2: notify monitors whose latest published grade is newer than seen ──
  for (const monitor of monitors) {
    try {
      if (!monitor.email) {
        // user_id-only monitors (future signed-in mode) have no address to mail.
        result.skipped.push({ target: monitor.target, reason: "monitor has no email" });
        continue;
      }
      const latest = await store.latestPublishedGrade(monitor.target);
      if (!latest) continue;
      if (latest.id === monitor.last_notified_run_id) continue;

      // Threshold gate: the watcher only wants email at/below a chosen grade.
      // A suppressed grade is recorded as seen (dedup watermark advances) but
      // sends nothing and writes no alert_deliveries row — the "Recent alerts"
      // log and "Last alerted" line stay truthful to real sends.
      if (!gradeMeetsThreshold(latest.grade, monitor.alert_min_grade)) {
        await store.markSeen(monitor.id, latest.id);
        result.skipped.push({
          target: monitor.target,
          reason: `below alert threshold (${monitor.alert_min_grade})`,
        });
        continue;
      }

      const deliveryId = await store.claimDelivery({
        monitor_id: monitor.id,
        hosted_run_id: latest.id,
        target: monitor.target,
        version: latest.resolved_version,
        grade: latest.grade,
        email: monitor.email,
      });

      if (deliveryId) {
        result.notified += 1;
        const email = buildAlertEmail({
          target: monitor.target,
          version: latest.resolved_version,
          grade: latest.grade ?? "?",
          priorGrade: monitor.last_notified_grade,
          unsubscribeToken: monitor.unsubscribe_token,
          siteUrl: deps.siteUrl,
        });
        if (!deps.sender) {
          throw new Error("no email sender configured");
        }
        let sendOk = false;
        try {
          const sent = await deps.sender.send(monitor.email, email);
          await store.markDelivery(deliveryId, "sent", { resendMessageId: sent.id });
          result.sent += 1;
          sendOk = true;
          log(`[alerts] sent ${monitor.target} → ${monitor.email} (${latest.grade})`);
        } catch (sendErr) {
          const msg = sendErr instanceof Error ? sendErr.message : String(sendErr);
          await store.markDelivery(deliveryId, "failed", { error: msg });
          result.failed += 1;
          log(`[alerts] send failed ${monitor.target} → ${monitor.email}: ${msg}`);
        }
        // Only advance the watermark on success. A failed send leaves the
        // delivery row as 'failed'; the next cron pass will see the watermark
        // unchanged, re-enter, and claim_or_retry_delivery will reset the row
        // to 'pending' so the send is retried.
        if (sendOk) await store.advanceWatermark(monitor.id, latest);
      } else {
        // deliveryId null = the unique constraint found an existing 'sent' row
        // (a concurrent run already delivered). Advance so we don't loop forever.
        await store.advanceWatermark(monitor.id, latest);
      }
    } catch (err) {
      result.skipped.push({
        target: monitor.target,
        reason: err instanceof Error ? err.message : String(err),
      });
    }
  }

  return result;
}
