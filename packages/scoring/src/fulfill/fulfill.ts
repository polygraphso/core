/**
 * The grade-request fulfillment engine. Drains the public grade_requests queue
 * (populated by /request, the CLI's `request` command, and the MCP tools'
 * request_grade) by riding the hosted runner's free auto-publish lane. Two
 * idempotent passes, run hourly by .github/workflows/fulfill.yml:
 *
 *   1. RECONCILE — requests already in_progress are linked to a hosted_runs row.
 *      When that run is complete + published, the request is completed (and the
 *      requester emailed, if they left an address). A failed run declines the
 *      request — the worker doesn't retry failed grades, so failure is terminal
 *      ("couldn't test", not a judgment).
 *
 *   2. ENQUEUE — the oldest queued requests (capped per run to respect the
 *      box's serial grading capacity) are resolved against the registry: if the
 *      current version already has a published grade the request completes
 *      immediately; if a free regrade is already in flight for the target the
 *      request rides that run; otherwise a new run is enqueued and linked.
 *
 * Enqueued rows use source='monitor' — the worker's free auto-publish lane
 * (grade + published_at stamped on completion, per-version supersession) — with
 * a request@polygraph.so sentinel email. Requester provenance (source/agent_id/
 * email) stays on grade_requests.
 */

import { parseServerRef, type ParsedServerRef } from "@polygraph/core";
import { fetchNpm } from "../adapters/npm.js";
import { fetchPypi } from "../adapters/pypi.js";
import type { EmailSender } from "../alerts/email.js";
import { buildDeclinedEmail, buildFulfilledEmail } from "./email.js";
import type { FulfillStore, GradeRequestRecord } from "./store.js";

/** Default per-run enqueue cap. The box grades serially (~15-min worst case per
 *  run), and monitor-alert regrades share the same lane — 5/hour leaves headroom. */
const DEFAULT_MAX_ENQUEUE = 5;

export interface FulfillDeps {
  /** Resolve a registry ref's latest version. Default hits npm/pypi adapters. */
  fetchLatestVersion?: (parsed: ParsedServerRef) => Promise<string | null>;
  /** Email transport for requesters who left an address. Optional. */
  sender?: EmailSender;
  /** Origin for report links in the email. */
  siteUrl?: string;
  /** Cap on grading runs enqueued in one pass. */
  maxEnqueue?: number;
  log?: (m: string) => void;
}

export interface FulfillResult {
  /** Requests completed this pass (reconciled or already-published). */
  completed: number;
  declined: number;
  /** in_progress requests still waiting on their run. */
  pending: number;
  /** New grading runs enqueued. */
  enqueued: number;
  /** Fulfillment emails that failed to send (request still completes). */
  emailFailed: number;
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
  return null;
}

export async function runFulfillment(
  store: FulfillStore,
  deps: FulfillDeps = {},
): Promise<FulfillResult> {
  const fetchLatest = deps.fetchLatestVersion ?? defaultFetchLatestVersion;
  const maxEnqueue = deps.maxEnqueue ?? DEFAULT_MAX_ENQUEUE;
  const log = deps.log ?? (() => {});

  const result: FulfillResult = {
    completed: 0,
    declined: 0,
    pending: 0,
    enqueued: 0,
    emailFailed: 0,
    skipped: [],
  };

  // Completing with an optional email: the grade is live regardless of whether
  // the email lands, so a send failure never blocks the status change — it's
  // counted and logged instead (visible in the workflow output).
  const completeAndNotify = async (
    request: GradeRequestRecord,
    grade: string,
    version: string | null,
  ) => {
    await store.completeRequest(request.id);
    result.completed += 1;
    if (request.email && deps.sender) {
      try {
        await deps.sender.send(
          request.email,
          buildFulfilledEmail({
            target: request.target,
            targetKind: request.target_kind,
            grade,
            version,
            siteUrl: deps.siteUrl,
          }),
        );
      } catch (err) {
        result.emailFailed += 1;
        log(
          `[fulfill] fulfilled-email failed for ${request.target} → ${request.email}: ${err instanceof Error ? err.message : String(err)}`,
        );
      }
    }
  };

  const declineAndNotify = async (request: GradeRequestRecord) => {
    await store.declineRequest(request.id);
    result.declined += 1;
    if (request.email && deps.sender) {
      try {
        await deps.sender.send(
          request.email,
          buildDeclinedEmail({ target: request.target, siteUrl: deps.siteUrl }),
        );
      } catch (err) {
        result.emailFailed += 1;
        log(
          `[fulfill] declined-email failed for ${request.target} → ${request.email}: ${err instanceof Error ? err.message : String(err)}`,
        );
      }
    }
  };

  // ── Pass 1: reconcile in_progress requests against their linked runs ────────
  for (const request of await store.inProgressRequests()) {
    try {
      if (!request.hosted_run_id) {
        // Pre-linkage row (manual drain era). Complete if anything published.
        const published = await store.latestPublishedGrade(request.target);
        if (published) {
          await completeAndNotify(request, published.grade ?? "?", published.resolved_version);
        } else {
          result.skipped.push({ target: request.target, reason: "in_progress without linked run" });
        }
        continue;
      }
      const run = await store.runById(request.hosted_run_id);
      if (!run) {
        result.skipped.push({ target: request.target, reason: "linked run not found" });
        continue;
      }
      if (run.status === "complete" && run.published_at) {
        await completeAndNotify(request, run.grade ?? "?", run.resolved_version);
        log(`[fulfill] completed ${request.target} — ${run.grade}`);
      } else if (run.status === "failed") {
        await declineAndNotify(request);
        log(`[fulfill] declined ${request.target} — run failed (${run.failure_reason ?? "unknown"})`);
      } else if (run.status === "complete") {
        // Graded but not published — shouldn't happen on the auto-publish lane;
        // leave it for a human rather than guessing.
        result.skipped.push({ target: request.target, reason: "run complete but unpublished" });
      } else {
        result.pending += 1;
      }
    } catch (err) {
      result.skipped.push({
        target: request.target,
        reason: err instanceof Error ? err.message : String(err),
      });
    }
  }

  // ── Pass 2: enqueue the oldest queued requests, up to the cap ────────────────
  for (const request of await store.queuedRequests(maxEnqueue)) {
    if (result.enqueued >= maxEnqueue) break;
    try {
      if (request.target_kind === "registry_ref") {
        const parsed = parseServerRef(request.target);
        if (parsed.registry !== "npm" && parsed.registry !== "pypi") {
          // Legacy intake (pre-gating) — the harness can't launch these refs.
          await declineAndNotify(request);
          log(`[fulfill] declined ${request.target} — ungradeable registry ${parsed.registry}`);
          continue;
        }
        const latest = await fetchLatest(parsed);
        if (!latest) {
          // Transient registry failure — leave queued for the next pass.
          result.skipped.push({ target: request.target, reason: "no latest version from registry" });
          continue;
        }
        if (await store.hasPublishedGradeForVersion(request.target, latest)) {
          await completeAndNotify(request, (await store.latestPublishedGrade(request.target))?.grade ?? "?", latest);
          log(`[fulfill] completed ${request.target} — already published at ${latest}`);
          continue;
        }
      } else {
        // Remote endpoints are unversioned: any published grade fulfills.
        const published = await store.latestPublishedGrade(request.target);
        if (published) {
          await completeAndNotify(request, published.grade ?? "?", published.resolved_version);
          continue;
        }
      }

      const inFlight = await store.inFlightRegradeId(request.target);
      if (inFlight) {
        await store.markInProgress(request.id, inFlight);
        log(`[fulfill] ${request.target} riding in-flight run ${inFlight}`);
        continue;
      }

      const runId = await store.enqueueRegrade(request.target, request.target_kind);
      await store.markInProgress(request.id, runId);
      result.enqueued += 1;
      log(`[fulfill] enqueued ${request.target} (run ${runId})`);
    } catch (err) {
      result.skipped.push({
        target: request.target,
        reason: err instanceof Error ? err.message : String(err),
      });
    }
  }

  return result;
}
