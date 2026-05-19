/**
 * Per-server raw-dimension computation. Lifted from agentic-talent-app's
 * `computeMcpToolScores`, pruned to what scoring-brief.md keeps in scope.
 *
 * What we kept (the proven formula structure):
 *   - 4-dimension model (adoption, quality, consistency, risk)
 *   - log-scale on count-y signals (downloads, stars, dependents)
 *   - weighted-average for quality/consistency, additive penalties for risk
 *   - trust-reduction subtracted from risk
 *
 * What we pruned (out-of-scope per the brief):
 *   - Adoption: vscode_install_count, homebrew_install_365d, pulse_visitors_total,
 *     x402 revenue/payers. Remaining adoption weights renormalized to sum to 1.
 *   - Quality: Glama grades + Smithery `verified` flag (brief: "components,
 *     not weights"), npms.io quality score (defunct). PR-merge-rate + OpenSSF
 *     stay; weights renormalized.
 *   - Consistency: pulse_status, npm_maintenance_score (defunct). Registry
 *     breadth recomputed as Glama + Smithery presence only (no Pulse, no MCP-
 *     registry adapter yet).
 *   - Risk: pulse_status bumps, Glama security/license grade bumps, Smithery
 *     `verified` reduction (component, not weight), `npm_insecure_flag`
 *     (defunct). `npm_deprecated` stays (we capture it).
 *
 * What we added (per the locked scope-split rule):
 *   - Risk: CVSS-severity-weighted advisory bumps (CRITICAL=25, HIGH=15,
 *     MODERATE=8, LOW=3, capped at 50 so one server's vulns can't dominate).
 *     Without severity weighting, Risk degrades to a flat count — explicit
 *     brief callout.
 *   - Trust: SLSA provenance presence reduces risk (+5).
 */

import type { AdvisorySeverity } from "../adapters/depsdev.js";
import type { ComponentSnapshot, RawDimensions } from "./types.js";

const MS_PER_DAY = 1000 * 60 * 60 * 24;

function logScale(x: number): number {
  return x > 0 ? Math.log10(x + 1) : 0;
}

function daysSince(iso: string | null | undefined, now: number = Date.now()): number {
  if (!iso) return 9999;
  const t = new Date(iso).getTime();
  return Number.isFinite(t) ? (now - t) / MS_PER_DAY : 9999;
}

function freshnessScore(iso: string | null | undefined, now: number = Date.now()): number {
  const days = daysSince(iso, now);
  return Math.max(0, 1 - days / 365);
}

/**
 * Weighted average over (value, weight) pairs, skipping null/undefined
 * values and renormalizing across what's present. Returns 0.5 when every
 * input is null (so the dimension doesn't disappear — it just sits at the
 * neutral midpoint).
 */
function weightedAverage(pairs: Array<readonly [number | null | undefined, number]>): number {
  const valid = pairs.filter(([v]) => v != null) as Array<readonly [number, number]>;
  if (valid.length === 0) return 0.5;
  const totalWeight = valid.reduce((s, [, w]) => s + w, 0);
  return valid.reduce((s, [v, w]) => s + v * w, 0) / totalWeight;
}

/**
 * Last-4-weeks vs prior-4-weeks download velocity. Returns 0-100 where
 * 50 = neutral. Same as agentic-talent-app's computeDownloadVelocity.
 */
export function computeDownloadVelocity(weekly: number[] | null | undefined): number {
  if (!weekly || weekly.length < 8) return 50;
  const recent = weekly.slice(-4).reduce((s, n) => s + n, 0) / 4;
  const prior = weekly.slice(-8, -4).reduce((s, n) => s + n, 0) / 4;
  if (prior === 0) return recent > 0 ? 100 : 50;
  return Math.max(0, Math.min(100, (recent / prior) * 50));
}

const ADVISORY_RISK_POINTS: Record<AdvisorySeverity, number> = {
  CRITICAL: 25,
  HIGH: 15,
  MODERATE: 8,
  LOW: 3,
};

const ADVISORY_RISK_CAP = 50;

export function advisoryRiskFromSeverities(severities: readonly AdvisorySeverity[]): number {
  let risk = 0;
  for (const s of severities) risk += ADVISORY_RISK_POINTS[s];
  return Math.min(ADVISORY_RISK_CAP, risk);
}

/**
 * Options for shared-repo masking. When a github repo is shared across
 * multiple servers in the batch (e.g. all `@modelcontextprotocol/server-*`
 * point to `modelcontextprotocol/servers`), github signals get masked to
 * null so every sharer doesn't inherit the same boost. Mirrors the
 * shared-repo mask in agentic-talent-app/recompute.ts.
 */
export interface ComputeOptions {
  shared_github_repos: ReadonlySet<string>;
  now?: number;
}

/**
 * Per-server raw dimensions. Run this on every server in a batch, then
 * pass the resulting array through rank() to normalize and combine.
 */
export function computeRawDimensions(
  snap: ComponentSnapshot,
  opts: ComputeOptions,
): RawDimensions {
  const now = opts.now ?? Date.now();
  const ghMasked = Boolean(
    snap.github_repo_key && opts.shared_github_repos.has(snap.github_repo_key),
  );

  // ── Adoption ──────────────────────────────────────────────────────────────
  // Weights renormalized from agentic-talent-app to sum to 1 after pruning
  // vscode (0.12) + homebrew (0.10) + pulse (0.07) + x402 (0.10) = 0.39
  // Remaining 0.61 → divide each by 0.61 to renormalize:
  //   npm 0.32 → 0.525, pypi 0.08 → 0.131, smithery_use 0.14 → 0.230,
  //   gh_stars 0.05 → 0.082, velocity*1k 0.07 → 0.115, dependents 0.05 → 0.082
  // We round to 3 decimals; small drift is fine, math is approximate.
  const npmDl = logScale(snap.npm?.downloads_last_month ?? 0);
  const pypiDl = logScale(snap.pypi?.downloads_last_month ?? 0);
  const smitheryUse = logScale(snap.smithery?.use_count ?? 0);
  const ghStars = ghMasked ? 0 : logScale(snap.github?.stars ?? 0);
  const dependents = logScale(snap.depsdev?.dependents_count ?? 0);

  const weekly = snap.npm?.weekly_downloads.length
    ? snap.npm.weekly_downloads
    : snap.pypi?.weekly_downloads ?? null;
  const velocity = computeDownloadVelocity(weekly);
  const velocityTerm = (velocity / 100) * logScale(1000);

  const adoption =
    npmDl * 0.525 +
    pypiDl * 0.131 +
    smitheryUse * 0.230 +
    ghStars * 0.082 +
    velocityTerm * 0.115 +
    dependents * 0.082;

  // ── Quality ───────────────────────────────────────────────────────────────
  // Brief excludes Glama grades + Smithery `verified` (components, not weights)
  // and npms.io scores (defunct). Only PR-merge-rate and OpenSSF aggregate
  // remain; weights renormalized from 0.15 + 0.25 = 0.40 → 0.375 + 0.625.
  const totalPRs = ghMasked
    ? 0
    : (snap.github?.pr_count_open ?? 0) + (snap.github?.pr_count_closed ?? 0);
  const prMergeRate: number | null =
    totalPRs > 0 ? (snap.github?.pr_count_closed ?? 0) / totalPRs : null;
  const openssfNormalized =
    snap.openssf?.aggregate_score != null ? snap.openssf.aggregate_score / 10 : null;
  const quality = weightedAverage([
    [prMergeRate, 0.375],
    [openssfNormalized, 0.625],
  ]);

  // ── Consistency ───────────────────────────────────────────────────────────
  // Freshness (40%) + registry breadth (20%), renormalized → 0.667 / 0.333.
  // Drop pulse_status and npm_maintenance.
  const lastPublish =
    snap.npm?.last_publish_date ?? snap.pypi?.last_release_date ?? snap.github?.last_push_at ?? null;
  const freshness = freshnessScore(lastPublish, now);
  let registryHits = 0;
  if (snap.glama) registryHits++;
  if (snap.smithery) registryHits++;
  const registryBreadth = registryHits / 2;
  const consistency = weightedAverage([
    [freshness, 0.667],
    [registryBreadth, 0.333],
  ]);

  // ── Risk ──────────────────────────────────────────────────────────────────
  let risk = 0;
  if (!ghMasked && snap.github?.archived) risk += 80;
  if (snap.npm?.deprecated) risk += 50;

  const staleDays = daysSince(lastPublish, now);
  if (staleDays > 365) risk += 40;
  else if (staleDays > 180) risk += 20;

  if (snap.depsdev?.advisory_severities?.length) {
    risk += advisoryRiskFromSeverities(snap.depsdev.advisory_severities);
  }

  risk = Math.min(100, risk);

  // Trust reductions
  let reduction = 0;
  const openssfScore = snap.openssf?.aggregate_score ?? null;
  if (openssfScore != null) {
    if (openssfScore >= 7) reduction += 15;
    else if (openssfScore >= 5) reduction += 10;
    else if (openssfScore >= 3) reduction += 5;
  }
  if (snap.depsdev?.advisory_count === 0) reduction += 10;
  if (snap.depsdev?.license_detected) reduction += 5;
  if (snap.depsdev?.has_slsa_provenance) reduction += 5;

  risk = Math.max(0, Math.min(100, risk - reduction));

  // ── Sources ───────────────────────────────────────────────────────────────
  const sources_used: string[] = [];
  if (snap.npm) sources_used.push("npm");
  if (snap.pypi) sources_used.push("pypi");
  if (snap.github && !ghMasked) sources_used.push("github");
  if (snap.openssf) sources_used.push("openssf");
  if (snap.depsdev) sources_used.push("depsdev");
  if (snap.glama) sources_used.push("glama");
  if (snap.smithery) sources_used.push("smithery");

  return { adoption, quality, consistency, risk, sources_used };
}

/**
 * Build the shared-repo mask: any github repo seen on 2+ servers in the
 * batch goes in the set. Callers pass this set into computeRawDimensions
 * via opts.shared_github_repos.
 */
export function buildSharedRepoMask(snapshots: readonly ComponentSnapshot[]): Set<string> {
  const counts = new Map<string, number>();
  for (const s of snapshots) {
    if (s.github_repo_key) counts.set(s.github_repo_key, (counts.get(s.github_repo_key) ?? 0) + 1);
  }
  const shared = new Set<string>();
  for (const [key, n] of counts) if (n > 1) shared.add(key);
  return shared;
}
