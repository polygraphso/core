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
export type { DepsDevAdapterData, DepsDevEcosystem } from "./adapters/depsdev.js";

export { fetchGlama } from "./adapters/glama.js";
export type { GlamaAdapterData } from "./adapters/glama.js";

export { fetchSmithery } from "./adapters/smithery.js";
export type { SmitheryAdapterData } from "./adapters/smithery.js";
