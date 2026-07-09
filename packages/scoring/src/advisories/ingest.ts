/**
 * Advisory ingest engine. For each distinct gradeable ecosystem-entry target it
 * pulls the current advisories and upserts them into advisories / advisory_targets:
 *   - npm / pypi → deps.dev names the GHSA ids on the default version; OSV
 *     enriches each with CVE aliases, severity, summary, and the affected range.
 *   - github     → the repo's own published GitHub Security Advisories.
 *   - remote_url → skipped (no package advisory feed; "not covered").
 *
 * Store-seam design mirrors alerts/ingest so it is unit-testable with a fake
 * store + injected fetchers. Per-target try/catch degrades a single failure to a
 * skip rather than aborting the run.
 */

import { parseServerRef } from "@polygraph/core";
import type { DepsDevAdapterData, DepsDevEcosystem } from "../adapters/depsdev.js";
import type { OsvAdvisory } from "../adapters/osv.js";
import type { GhsaAdvisory } from "../adapters/ghsa.js";
import type {
  AdvisoryStore,
  NormalizedAdvisory,
  NormalizedAdvisoryTarget,
} from "./store.js";

export interface AdvisoryIngestDeps {
  fetchDepsDev: (pkg: string, ecosystem: DepsDevEcosystem) => Promise<DepsDevAdapterData | null>;
  fetchOsvVuln: (ghsaId: string) => Promise<OsvAdvisory | null>;
  fetchRepoSecurityAdvisories: (owner: string, repo: string) => Promise<GhsaAdvisory[]>;
}

export interface IngestOptions {
  limit?: number;
  dryRun?: boolean;
  concurrency?: number;
}

export interface IngestResult {
  targetsProcessed: number;
  targetsSkipped: Array<{ target: string; reason: string }>;
  advisoriesWritten: number;
  npmPypiCovered: number;
  githubCovered: number;
}

/** PEP 503 name normalization so a pypi name matches OSV's spelling. */
function normalizePypi(name: string): string {
  return name.toLowerCase().replace(/[-_.]+/g, "-");
}

/** Strip a skill's `#path` suffix — the advisory feed is repo-level. */
export function normalizeTargetKey(target: string): string {
  const hash = target.indexOf("#");
  return hash === -1 ? target : target.slice(0, hash);
}

/** deps.dev package name for a parsed ref (npm scope kept; pypi flat). */
function depsDevPackageName(owner: string | null, name: string): string {
  return owner ? `${owner}/${name}` : name;
}

/** Find the OSV affected entry matching this registry + package name. */
function matchOsvAffected(
  osv: OsvAdvisory,
  registry: DepsDevEcosystem,
  pkg: string,
): { range: string | null; fixed_version: string | null } | null {
  const wantEco = registry === "npm" ? "npm" : "pypi";
  const wantName = registry === "pypi" ? normalizePypi(pkg) : pkg;
  for (const a of osv.affected) {
    const eco = a.ecosystem.toLowerCase();
    const name = registry === "pypi" ? normalizePypi(a.name) : a.name;
    if (eco === wantEco && name === wantName) {
      return { range: a.range, fixed_version: a.fixed_version };
    }
  }
  return null;
}

function osvToAdvisory(osv: OsvAdvisory): NormalizedAdvisory {
  return {
    ghsa_id: osv.ghsa_id,
    source: "osv",
    cve_ids: osv.cve_ids,
    severity: osv.severity,
    cvss: osv.cvss,
    cvss_vector: osv.cvss_vector,
    summary: osv.summary,
    url: osv.url,
    published_at: osv.published_at,
    withdrawn_at: osv.withdrawn_at,
  };
}

/** Minimal advisory when OSV has no detail — the GHSA id is still worth showing. */
function minimalDepsDevAdvisory(ghsaId: string): NormalizedAdvisory {
  return {
    ghsa_id: ghsaId,
    source: "depsdev",
    cve_ids: [],
    severity: null,
    cvss: null,
    cvss_vector: null,
    summary: null,
    url: `https://github.com/advisories/${ghsaId}`,
    published_at: null,
    withdrawn_at: null,
  };
}

function ghsaToAdvisory(a: GhsaAdvisory): NormalizedAdvisory {
  return {
    ghsa_id: a.ghsa_id,
    source: "github",
    cve_ids: a.cve_ids,
    severity: a.severity,
    cvss: a.cvss,
    cvss_vector: a.cvss_vector,
    summary: a.summary,
    url: a.url,
    published_at: a.published_at,
    withdrawn_at: a.withdrawn_at,
  };
}

async function writeAdvisory(
  store: AdvisoryStore,
  advisory: NormalizedAdvisory,
  target: NormalizedAdvisoryTarget,
  dryRun: boolean,
): Promise<void> {
  if (dryRun) return;
  const id = await store.upsertAdvisory(advisory);
  await store.upsertAdvisoryTarget(id, target);
}

/** Process one npm/pypi target. Returns the GHSA ids seen (for stale-marking). */
async function ingestRegistryTarget(
  store: AdvisoryStore,
  deps: AdvisoryIngestDeps,
  packageKey: string,
  registry: DepsDevEcosystem,
  pkg: string,
  dryRun: boolean,
): Promise<number> {
  const dd = await deps.fetchDepsDev(pkg, registry);
  if (!dd) return 0;

  let written = 0;
  const seen: string[] = [];
  for (const ref of dd.advisories ?? []) {
    const osv = await deps.fetchOsvVuln(ref.ghsa_id);
    const advisory = osv ? osvToAdvisory(osv) : minimalDepsDevAdvisory(ref.ghsa_id);
    const matched = osv ? matchOsvAffected(osv, registry, pkg) : null;
    await writeAdvisory(store, advisory, {
      package_key: packageKey,
      ecosystem: registry,
      affected_range: matched?.range ?? null,
      fixed_version: matched?.fixed_version ?? null,
      current_version: ref.version,
    }, dryRun);
    seen.push(ref.ghsa_id);
    written++;
  }
  if (!dryRun) await store.markTargetsStale(packageKey, seen);
  return written;
}

/** Process one github target. Returns the count written. */
async function ingestGithubTarget(
  store: AdvisoryStore,
  deps: AdvisoryIngestDeps,
  packageKey: string,
  owner: string,
  repo: string,
  dryRun: boolean,
): Promise<number> {
  const advisories = await deps.fetchRepoSecurityAdvisories(owner, repo);
  let written = 0;
  const seen: string[] = [];
  for (const a of advisories) {
    await writeAdvisory(store, ghsaToAdvisory(a), {
      package_key: packageKey,
      ecosystem: "github",
      affected_range: a.affected_range,
      fixed_version: a.fixed_version,
      current_version: null,
    }, dryRun);
    seen.push(a.ghsa_id);
    written++;
  }
  if (!dryRun) await store.markTargetsStale(packageKey, seen);
  return written;
}

export async function runAdvisoryIngest(
  store: AdvisoryStore,
  deps: AdvisoryIngestDeps,
  opts: IngestOptions = {},
): Promise<IngestResult> {
  const dryRun = opts.dryRun ?? false;
  const concurrency = Math.max(1, opts.concurrency ?? 4);

  let targets = await store.distinctEcosystemTargets();
  if (opts.limit && opts.limit > 0) targets = targets.slice(0, opts.limit);

  const result: IngestResult = {
    targetsProcessed: 0,
    targetsSkipped: [],
    advisoriesWritten: 0,
    npmPypiCovered: 0,
    githubCovered: 0,
  };

  async function processOne(entryTarget: string): Promise<void> {
    const key = normalizeTargetKey(entryTarget);
    let parsed;
    try {
      parsed = parseServerRef(key);
    } catch {
      result.targetsSkipped.push({ target: entryTarget, reason: "unparseable target" });
      return;
    }

    try {
      if (parsed.registry === "npm" || parsed.registry === "pypi") {
        const pkg = depsDevPackageName(parsed.owner, parsed.name);
        result.advisoriesWritten += await ingestRegistryTarget(
          store, deps, key, parsed.registry, pkg, dryRun,
        );
        result.npmPypiCovered++;
      } else if (parsed.registry === "github") {
        if (!parsed.owner) {
          result.targetsSkipped.push({ target: entryTarget, reason: "github without owner" });
          return;
        }
        result.advisoriesWritten += await ingestGithubTarget(
          store, deps, key, parsed.owner, parsed.name, dryRun,
        );
        result.githubCovered++;
      } else {
        result.targetsSkipped.push({ target: entryTarget, reason: `unsupported registry ${parsed.registry}` });
        return;
      }
      result.targetsProcessed++;
    } catch (err) {
      result.targetsSkipped.push({
        target: entryTarget,
        reason: err instanceof Error ? err.message : String(err),
      });
    }
  }

  // Bounded concurrency: process the target list in fixed-size waves.
  for (let i = 0; i < targets.length; i += concurrency) {
    const wave = targets.slice(i, i + concurrency);
    await Promise.all(wave.map((t) => processOne(t.target)));
  }

  return result;
}
