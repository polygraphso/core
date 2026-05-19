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
 * Structural-absence aware weighted sum. Each entry's `present` flag is
 * the absence check: `true` means the signal exists (even if 0/low),
 * `false` means the server has no presence on that source at all.
 *
 * When some signals are absent, their weights are redistributed
 * proportionally to the *present* weights — preserving the formula
 * structure while adapting to the per-server input distribution. Per
 * scoring-brief.md "Structural-absence normalization."
 *
 * Returns the score plus a report of what was redistributed so debug
 * views can explain tier shifts.
 */
export interface AdoptionSignal {
  name: string;
  value: number;
  weight: number;
  present: boolean;
}

export function adoptionWithRedistribution(
  signals: readonly AdoptionSignal[],
): { score: number; absent: string[]; scale_factor: number | null } {
  const presentSignals = signals.filter((s) => s.present);
  const absent = signals.filter((s) => !s.present).map((s) => s.name);

  if (presentSignals.length === 0) {
    return { score: 0, absent, scale_factor: null };
  }

  const presentWeightSum = presentSignals.reduce((acc, s) => acc + s.weight, 0);
  // presentWeightSum is > 0 by construction (caller assigns positive weights
  // to every signal); guard anyway.
  const scaleFactor = presentWeightSum > 0 ? 1 / presentWeightSum : 0;

  const score = presentSignals.reduce(
    (acc, s) => acc + s.value * s.weight * scaleFactor,
    0,
  );
  return { score, absent, scale_factor: scaleFactor };
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
  // Weights renormalized from agentic-talent-app's mcp-tool formula. Original
  // baseAdoption weights summed to 1.00 (npm 0.32, pypi 0.08, vscode 0.12,
  // homebrew 0.10, smithery 0.14, pulse 0.07, gh_stars 0.05, velocity 0.07,
  // dependents 0.05). We drop vscode + homebrew + pulse (out of mcp-tool
  // scope) = 0.29; remaining kept-weight sum = 0.71. Renormalization
  // factor = 1 / 0.71 ≈ 1.408:
  //   npm 0.32 × 1.408 = 0.451     pypi 0.08 × 1.408 = 0.113
  //   smithery 0.14 × 1.408 = 0.197    gh_stars 0.05 × 1.408 = 0.070
  //   velocity 0.07 × 1.408 = 0.099    dependents 0.05 × 1.408 = 0.070
  // Sum = 1.000 (within rounding). x402 was an outer 0.05+0.05 layered
  // ON TOP of baseAdoption with a 0.9 multiplier on baseAdoption — not
  // part of the renormalization base. The previous 0.61 denominator was
  // wrong and produced weights summing to 1.165, which made
  // adoptionWithRedistribution emit scale_factor values that double as
  // a "compress to fit the bogus total" rather than redistribute absence.
  //
  // Structural-absence normalization: each signal carries a `present`
  // flag indicating whether the server has any presence on that source
  // (vs. zero/low). Absent weights redistribute across present signals
  // per scoring-brief.md.
  const velocityFromWeekly = snap.npm?.weekly_downloads.length
    ? snap.npm.weekly_downloads
    : snap.pypi?.weekly_downloads ?? null;
  // velocity is "present" iff we have enough weekly data to actually
  // compute it (matches the helper's `< 8 weeks` neutral fallback rule).
  const velocityPresent = Boolean(velocityFromWeekly && velocityFromWeekly.length >= 8);
  const velocity = computeDownloadVelocity(velocityFromWeekly);

  const adoptionSignals: AdoptionSignal[] = [
    {
      name: "npm",
      weight: 0.451,
      value: logScale(snap.npm?.downloads_last_month ?? 0),
      present: snap.npm !== null,
    },
    {
      name: "pypi",
      weight: 0.113,
      value: logScale(snap.pypi?.downloads_last_month ?? 0),
      present: snap.pypi !== null,
    },
    {
      name: "smithery_use_count",
      weight: 0.197,
      value: logScale(snap.smithery?.use_count ?? 0),
      // Structurally absent when the server isn't on Smithery at all.
      // Present-but-zero (rare; would mean Smithery returned the entry
      // but useCount=0) keeps the weight — the formula's job to penalize.
      present: snap.smithery !== null,
    },
    {
      name: "gh_stars",
      weight: 0.070,
      value: ghMasked ? 0 : logScale(snap.github?.stars ?? 0),
      // Shared-repo mask still treats github as absent — the mask is exactly
      // the "this signal would mislead us" case, structurally identical to
      // "no github repo at all" for the purpose of this server's score.
      present: snap.github !== null && !ghMasked,
    },
    {
      name: "velocity",
      weight: 0.099,
      value: (velocity / 100) * logScale(1000),
      present: velocityPresent,
    },
    {
      name: "depsdev_dependents",
      weight: 0.070,
      value: logScale(snap.depsdev?.dependents_count ?? 0),
      present: snap.depsdev !== null,
    },
  ];
  const adoptionResult = adoptionWithRedistribution(adoptionSignals);
  const adoption = adoptionResult.score;

  // ── Quality ───────────────────────────────────────────────────────────────
  // Brief excludes Glama grades + Smithery `verified` (components, not weights)
  // and npms.io scores (defunct). Only PR-merge-rate and OpenSSF aggregate
  // remain; weights renormalized from 0.15 + 0.25 = 0.40 → 0.375 + 0.625.
  //
  // PR counts may be null when the github search API failed (422 on some
  // niche repos). null is structurally-absent — weightedAverage skips it
  // and renormalizes — vs `0` which would be "actually zero PRs."
  const prOpen = ghMasked ? null : snap.github?.pr_count_open ?? null;
  const prClosed = ghMasked ? null : snap.github?.pr_count_closed ?? null;
  const totalPRs = prOpen !== null && prClosed !== null ? prOpen + prClosed : null;
  const prMergeRate: number | null =
    totalPRs !== null && totalPRs > 0 ? (prClosed ?? 0) / totalPRs : null;
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

  return {
    adoption,
    quality,
    consistency,
    risk,
    sources_used,
    redistribution: {
      adoption: {
        structurally_absent: adoptionResult.absent,
        scale_factor: adoptionResult.scale_factor,
      },
    },
  };
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
