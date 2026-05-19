export { getSupabaseClient } from "./supabase.js";

export { fetchNpm } from "./adapters/npm.js";
export type { NpmAdapterData } from "./adapters/npm.js";

export { fetchGitHub } from "./adapters/github.js";
export type { GithubAdapterData } from "./adapters/github.js";

export { fetchPypi } from "./adapters/pypi.js";
export type { PypiAdapterData } from "./adapters/pypi.js";

export { fetchOpenSSF } from "./adapters/openssf.js";
export type { OpenSSFAdapterData } from "./adapters/openssf.js";

export { fetchDepsDev } from "./adapters/depsdev.js";
export type {
  AdvisorySeverity,
  DepsDevAdapterData,
  DepsDevEcosystem,
} from "./adapters/depsdev.js";

export { fetchGlama } from "./adapters/glama.js";
export type { GlamaAdapterData } from "./adapters/glama.js";

export { fetchSmithery } from "./adapters/smithery.js";
export type { SmitheryAdapterData } from "./adapters/smithery.js";

// Scoring pipeline
export { computeRawDimensions, buildSharedRepoMask } from "./scoring/compute.js";
export { rankAndTier, assignTier, WEIGHTS } from "./scoring/rank.js";
export { writeAdoptionScores, buildComponents } from "./scoring/writer.js";
export { readTopRanked } from "./scoring/reporter.js";
export {
  scoreAllTrackedServers,
  ensureVersionId,
} from "./scoring/orchestrate.js";
export { pollVersions } from "./scoring/poll-versions.js";
export {
  emit,
  notifyGradeComputed,
  notifyVersionDetected,
} from "./scoring/events.js";
export type {
  ComponentSnapshot,
  RawDimensions,
  ScoredServer,
} from "./scoring/types.js";
export type { TopRankEntry } from "./scoring/reporter.js";
export type { ScoreRunOptions, ScoreRunResult } from "./scoring/orchestrate.js";
export type { PollOptions, PollResult } from "./scoring/poll-versions.js";
export type { NotifyChannel } from "./scoring/events.js";
