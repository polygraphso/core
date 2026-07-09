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
 *      runs). Claimed changes are grouped by recipient, then sent as ONE digest
 *      email per recipient (a watcher with several changed servers gets a single
 *      email, not one per monitor). On a successful send, mark each delivery and
 *      advance each monitor's watermark.
 *
 * Scoped to monitored targets only — this is what keeps the free regrade affordable.
 * Run hourly by .github/workflows/alerts.yml; the ~1h enqueue→grade→notify latency
 * is acceptable for "your server has a new grade".
 */

import { parseServerRef, type ParsedServerRef } from "@polygraph/core";
import { fetchNpm } from "../adapters/npm.js";
import { fetchPypi } from "../adapters/pypi.js";
import { latestCommitForPath, type CommitInfo } from "../adapters/github.js";
import { buildDigestEmail, type AlertChange, type EmailSender } from "./email.js";
import { gradeMeetsThreshold } from "./grades.js";
import type { AlertStore, MonitorRecord, PublishedGrade } from "./store.js";

/** Default per-run enqueue cap — a cheap circuit breaker against a runaway pass. */
const DEFAULT_MAX_ENQUEUE = 50;

/** owner/repo/subPath extracted from a github monitor target. subPath is the
 *  skill subdirectory (`github/owner/repo#path`) or null for a whole-repo server
 *  target (`github/owner/repo`). */
export interface GithubTarget {
  owner: string;
  repo: string;
  subPath: string | null;
}

/** Parse a stored github target into owner/repo/subPath. Handles both the server
 *  form (github/owner/repo) and the skill form (github/owner/repo#path); returns
 *  null for anything that isn't a github target. */
export function parseGithubTarget(target: string): GithubTarget | null {
  const m = /^github\/([^/\s]+)\/([^#/\s]+)(?:#(.+))?$/.exec(target);
  if (!m) return null;
  return { owner: m[1]!, repo: m[2]!, subPath: m[3] ?? null };
}

export interface AlertsDeps {
  /** Resolve a registry ref's latest version. Default hits npm/pypi adapters. */
  fetchLatestVersion?: (parsed: ParsedServerRef) => Promise<string | null>;
  /** Resolve a github target's latest PATH-SCOPED commit (the commit stream for
   *  skills + github servers). Default hits the GitHub commits API. */
  fetchLatestCommit?: (gh: GithubTarget) => Promise<CommitInfo | null>;
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
  // github is monitored via its commit stream (defaultFetchLatestCommit), not here.
  return null;
}

/** Default github commit stream: the latest commit on the default branch that
 *  touches the graded path. */
function defaultFetchLatestCommit(gh: GithubTarget): Promise<CommitInfo | null> {
  return latestCommitForPath(gh.owner, gh.repo, undefined, gh.subPath);
}

/** The production drift fetchers (npm/pypi versions + github commit stream), so
 *  the ecosystem digest job reuses the exact freshness machinery runAlerts uses. */
export const defaultDriftDeps: DriftEnqueueDeps = {
  fetchLatestVersion: defaultFetchLatestVersion,
  fetchLatestCommit: defaultFetchLatestCommit,
};

export interface DriftEnqueueDeps {
  fetchLatestVersion: (parsed: ParsedServerRef) => Promise<string | null>;
  fetchLatestCommit: (gh: GithubTarget) => Promise<CommitInfo | null>;
}

export interface DriftEnqueueOutcome {
  /** True when a regrade was enqueued for this target. */
  enqueued: boolean;
  /** A reason to record as skipped (caller pushes to result.skipped). */
  skipReason?: string;
  /** Detail for the "enqueued regrade" log line (version or short commit). */
  logDetail?: string;
}

/**
 * Detect whether a monitored target's stream has moved past its published grade
 * and, if so, enqueue a free regrade. npm/pypi move by registry version; skills +
 * github servers move by their path-scoped commit. Never throws — a fetch/parse
 * failure comes back as `{ enqueued: false, skipReason }`.
 *
 * Extracted from runAlerts's pass 1 so the ecosystem digest job can reuse the
 * exact regrade-freshness machinery (same store methods, no new tables).
 */
export async function enqueueRegradeIfDrifted(
  store: AlertStore,
  target: string,
  kind: "registry_ref" | "skill",
  deps: DriftEnqueueDeps,
): Promise<DriftEnqueueOutcome> {
  try {
    // Skills are always github + path-scoped; a registry_ref may be npm/pypi
    // (version stream) or a github server (commit stream).
    let github = kind === "skill";
    if (!github) {
      const parsed = parseServerRef(target);
      if (parsed.registry === "npm" || parsed.registry === "pypi") {
        const latest = await deps.fetchLatestVersion(parsed);
        if (!latest) return { enqueued: false, skipReason: "no latest version from registry" };
        if (await store.hasPublishedGradeForVersion(target, latest)) return { enqueued: false };
        if (await store.hasInFlightMonitorRegrade(target)) return { enqueued: false };
        await store.enqueueMonitorRegrade(target, "registry_ref");
        return { enqueued: true, logDetail: `latest ${latest}` };
      }
      if (parsed.registry === "github") github = true;
      else return { enqueued: false, skipReason: `unmonitorable registry: ${parsed.registry}` };
    }

    const gh = parseGithubTarget(target);
    if (!gh) return { enqueued: false, skipReason: "unparseable github target" };
    const live = await deps.fetchLatestCommit(gh);
    if (!live) return { enqueued: false, skipReason: "no commit from github" };
    const published = await store.latestPublishedGrade(target);
    // Compare the path-scoped commit, never resolved_version. A null stored
    // commit_sha (never graded, or a pre-anchor grade not yet backfilled) is
    // treated as drift so one regrade establishes the baseline (self-heal).
    if (published?.commit_sha && published.commit_sha === live.sha) return { enqueued: false };
    if (await store.hasInFlightMonitorRegrade(target)) return { enqueued: false };
    await store.enqueueMonitorRegrade(target, kind);
    return { enqueued: true, logDetail: `commit ${live.sha.slice(0, 8)}` };
  } catch (err) {
    return { enqueued: false, skipReason: err instanceof Error ? err.message : String(err) };
  }
}

export async function runAlerts(store: AlertStore, deps: AlertsDeps = {}): Promise<AlertsResult> {
  const fetchLatest = deps.fetchLatestVersion ?? defaultFetchLatestVersion;
  const fetchLatestCommitFn = deps.fetchLatestCommit ?? defaultFetchLatestCommit;
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

  // ── Pass 1: enqueue regrades for targets whose stream has moved past the grade
  // npm/pypi move by registry version; skills + github servers move by their
  // path-scoped commit (the github "version stream"). A target maps to exactly one
  // kind, so carry each target's kind alongside it.
  const targetKinds = new Map(monitors.map((m) => [m.target, m.target_kind] as const));
  const targets = [...targetKinds.keys()];
  result.targets = targets.length;

  const driftDeps: DriftEnqueueDeps = {
    fetchLatestVersion: fetchLatest,
    fetchLatestCommit: fetchLatestCommitFn,
  };
  for (const target of targets) {
    if (result.enqueued >= maxEnqueue) {
      log(`[alerts] enqueue cap (${maxEnqueue}) reached — deferring remaining targets to next run`);
      break;
    }
    const kind = targetKinds.get(target) ?? "registry_ref";
    const outcome = await enqueueRegradeIfDrifted(store, target, kind, driftDeps);
    if (outcome.enqueued) {
      result.enqueued += 1;
      if (outcome.logDetail) log(`[alerts] enqueued regrade ${target} (${outcome.logDetail})`);
    } else if (outcome.skipReason) {
      result.skipped.push({ target, reason: outcome.skipReason });
    }
  }

  // ── Pass 2a: reconcile + claim, grouping claimed changes by recipient ────────
  // Per-monitor semantics (watermark, threshold gate, unique delivery claim) are
  // unchanged; we just collect what each recipient owes into one bucket so 2b can
  // send a single digest instead of one email per monitor.
  const pendingByEmail = new Map<string, PendingChange[]>();

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
        const bucket = pendingByEmail.get(monitor.email);
        const change: PendingChange = { monitor, latest, deliveryId };
        if (bucket) bucket.push(change);
        else pendingByEmail.set(monitor.email, [change]);
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

  // ── Pass 2b: one digest email per recipient ─────────────────────────────────
  const sender = deps.sender;
  for (const [email, changes] of pendingByEmail) {
    if (!sender) {
      throw new Error("no email sender configured");
    }
    const composed = buildDigestEmail({
      changes: changes.map((c) => toAlertChange(c)),
      siteUrl: deps.siteUrl,
    });
    try {
      const sent = await sender.send(email, composed);
      // On success, mark every delivery sent and advance every watermark.
      for (const c of changes) {
        await store.markDelivery(c.deliveryId, "sent", { resendMessageId: sent.id });
        await store.advanceWatermark(c.monitor.id, c.latest);
        result.sent += 1;
      }
      log(`[alerts] sent digest → ${email} (${changes.length} change${changes.length === 1 ? "" : "s"})`);
    } catch (sendErr) {
      const msg = sendErr instanceof Error ? sendErr.message : String(sendErr);
      // A failed send leaves each delivery row 'failed' and the watermarks put;
      // the next cron pass re-enters and claim_or_retry_delivery resets the rows
      // to 'pending' so the digest is retried.
      for (const c of changes) {
        await store.markDelivery(c.deliveryId, "failed", { error: msg });
        result.failed += 1;
      }
      log(`[alerts] send failed → ${email}: ${msg}`);
    }
  }

  return result;
}

/** A claimed, notifiable change awaiting a digest send. */
interface PendingChange {
  monitor: MonitorRecord;
  latest: PublishedGrade;
  deliveryId: string;
}

function toAlertChange(c: PendingChange): AlertChange {
  return {
    target: c.monitor.target,
    version: c.latest.resolved_version,
    grade: c.latest.grade ?? "?",
    priorGrade: c.monitor.last_notified_grade,
    unsubscribeToken: c.monitor.unsubscribe_token,
  };
}
