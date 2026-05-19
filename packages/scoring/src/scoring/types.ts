/**
 * Internal compute types. Distinct from @polygraph/core's row types
 * (those mirror the DB schema). These represent intermediate state
 * between adapter outputs and the adoption_scores rows we write.
 */

import type { AdoptionTier } from "@polygraph/core";
import type { DepsDevAdapterData } from "../adapters/depsdev.js";
import type { GithubAdapterData } from "../adapters/github.js";
import type { GlamaAdapterData } from "../adapters/glama.js";
import type { NpmAdapterData } from "../adapters/npm.js";
import type { OpenSSFAdapterData } from "../adapters/openssf.js";
import type { PypiAdapterData } from "../adapters/pypi.js";
import type { SmitheryAdapterData } from "../adapters/smithery.js";

/**
 * All adapter outputs for one server, bundled. Null per source when the
 * adapter wasn't called or returned 404. Identity carries through so the
 * writer can FK back to versions/servers.
 */
export interface ComponentSnapshot {
  server_id: string;
  version_id: string;
  /** github "owner/repo" key — used for shared-repo masking across the batch. */
  github_repo_key: string | null;
  npm: NpmAdapterData | null;
  pypi: PypiAdapterData | null;
  github: GithubAdapterData | null;
  openssf: OpenSSFAdapterData | null;
  depsdev: DepsDevAdapterData | null;
  glama: GlamaAdapterData | null;
  smithery: SmitheryAdapterData | null;
}

/**
 * Raw (pre-normalization) dimension scores for one server, the direct
 * output of computeRawDimensions(). Shape matches what
 * agentic-talent-app calls `RawDimensionScores` — preserved deliberately
 * so the lifted normalization + ranking math works unchanged.
 */
export interface RawDimensions {
  /** 0–∞, log-scaled raw value. Normalized later. */
  adoption: number;
  /** 0–1, weighted average of quality sub-signals. */
  quality: number;
  /** 0–1, weighted average of consistency sub-signals. */
  consistency: number;
  /** 0–100, absolute (never normalized — passed through to the final formula). */
  risk: number;
  /** Adapters that contributed at least one non-null signal. */
  sources_used: string[];
}

/** Final scored row for one server, ready to write to adoption_scores. */
export interface ScoredServer {
  server_id: string;
  version_id: string;
  /** 0–100. The number ranking uses. */
  score: number;
  tier: AdoptionTier | null;
  rank: number;
  /** Normalized 0–100 dimension scores for the debug view. */
  dimensions: {
    adoption: number;
    quality: number;
    consistency: number;
    risk: number;
  };
  sources_used: string[];
}
