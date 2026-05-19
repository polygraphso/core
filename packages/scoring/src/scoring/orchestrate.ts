/**
 * End-to-end scoring orchestrator. Lives at the scoring/ layer so it can
 * sit alongside the math; Phase 5 will wrap this in a daily-cron worker.
 *
 * One call (`scoreAllTrackedServers`) does the full pass:
 *   1. Read every server from `servers` (or a limit-N slice).
 *   2. For each, run the relevant adapters in parallel where the API
 *      tolerates it. Build a ComponentSnapshot.
 *   3. Resolve a version_id per server (insert into `versions` if the
 *      latest seen version isn't already there).
 *   4. Compute raw dimensions + the shared-repo mask.
 *   5. Rank, assign tiers, write to adoption_scores.
 *
 * Servers in different registries have different adapter sets — this
 * dispatches by `registry`. Adapter failures (network, post-retry) bubble
 * up as thrown errors so a single bad server is loud, not silent.
 */

import type { SupabaseClient } from "@supabase/supabase-js";
import type { IdentitySource, Registry } from "@polygraph/core";
import { fetchDepsDev } from "../adapters/depsdev.js";
import { fetchGitHub } from "../adapters/github.js";
import { fetchGlama } from "../adapters/glama.js";
import { fetchNpm } from "../adapters/npm.js";
import { fetchOpenSSF } from "../adapters/openssf.js";
import { fetchPypi } from "../adapters/pypi.js";
import { fetchSmithery } from "../adapters/smithery.js";
import { buildSharedRepoMask, computeRawDimensions } from "./compute.js";
import { notifyGradeComputed, notifyVersionDetected } from "./events.js";
import { rankAndTier, type RankInput } from "./rank.js";
import type { ComponentSnapshot, ScoredServer } from "./types.js";
import { writeAdoptionScores } from "./writer.js";

interface ServerRow {
  id: string;
  registry: Registry;
  owner: string | null;
  name: string;
  latest_version_id: string | null;
}

/**
 * Curated identities per server, keyed by source. Built once from
 * `server_identities` at the start of each run and passed down to the
 * scrape functions so they can look up the right Smithery / Glama
 * identifier without guessing.
 *
 * Servers without a curated identity for a given source skip that
 * adapter entirely — no fuzzy fallback (silent false positives are
 * unacceptable for trust-grading data, per scoring-brief.md). Absent
 * sources then fall through to structural-absence normalization in
 * compute.
 */
export type IdentityMap = ReadonlyMap<string, Partial<Record<IdentitySource, string>>>;

export interface ScoreRunResult {
  rows_written: number;
  scored: ScoredServer[];
  snapshots: ComponentSnapshot[];
  skipped: Array<{ server_id: string; reason: string }>;
}

interface SnapshotResult {
  snapshot: ComponentSnapshot;
}

/** What a single server's adapter pass produced — both the snapshot and the
 *  registry-derived latest_version that needs upserting into `versions`. */
interface ServerScrape {
  server_id: string;
  registry: Registry;
  owner: string | null;
  name: string;
  latest_version: string | null;
  snapshot: Omit<ComponentSnapshot, "version_id">;
}

async function scrapeNpmServer(
  server: ServerRow,
  identities: Partial<Record<IdentitySource, string>>,
): Promise<ServerScrape> {
  const pkg = server.owner ? `${server.owner}/${server.name}` : server.name;
  const npm = await fetchNpm(pkg);
  const gh = npm?.github_owner_repo ?? null;

  // Smithery / Glama are only called when a curated identity exists for
  // that source — see IdentityMap comment. No fuzzy match.
  const glamaIdent = identities.glama; // expected shape: "namespace/slug"
  const glamaPair = glamaIdent ? glamaIdent.split("/", 2) : null;
  const smitheryIdent = identities.smithery;

  const [github, openssf, depsdev, glama, smithery] = await Promise.all([
    gh ? fetchGitHub(gh.owner, gh.repo) : Promise.resolve(null),
    gh ? fetchOpenSSF(gh.owner, gh.repo) : Promise.resolve(null),
    fetchDepsDev(pkg, "npm"),
    glamaPair && glamaPair[0] && glamaPair[1]
      ? fetchGlama(glamaPair[0], glamaPair[1])
      : Promise.resolve(null),
    smitheryIdent ? fetchSmithery(smitheryIdent) : Promise.resolve(null),
  ]);

  return {
    server_id: server.id,
    registry: "npm",
    owner: server.owner,
    name: server.name,
    latest_version: npm?.latest_version ?? null,
    snapshot: {
      server_id: server.id,
      github_repo_key: gh ? `${gh.owner.toLowerCase()}/${gh.repo.toLowerCase()}` : null,
      npm,
      pypi: null,
      github,
      openssf,
      depsdev,
      glama,
      smithery,
    },
  };
}

async function scrapePypiServer(server: ServerRow): Promise<ServerScrape> {
  const pypi = await fetchPypi(server.name);
  const gh = pypi?.github_owner_repo ?? null;

  const [github, openssf, depsdev] = await Promise.all([
    gh ? fetchGitHub(gh.owner, gh.repo) : Promise.resolve(null),
    gh ? fetchOpenSSF(gh.owner, gh.repo) : Promise.resolve(null),
    fetchDepsDev(server.name, "pypi"),
  ]);

  return {
    server_id: server.id,
    registry: "pypi",
    owner: null,
    name: server.name,
    latest_version: pypi?.latest_version ?? null,
    snapshot: {
      server_id: server.id,
      github_repo_key: gh ? `${gh.owner.toLowerCase()}/${gh.repo.toLowerCase()}` : null,
      npm: null,
      pypi,
      github,
      openssf,
      depsdev,
      glama: null,
      smithery: null,
    },
  };
}

async function scrapeGithubServer(server: ServerRow): Promise<ServerScrape> {
  if (!server.owner) {
    throw new Error(`github server ${server.id} has no owner — invariant violation`);
  }
  const [github, openssf] = await Promise.all([
    fetchGitHub(server.owner, server.name),
    fetchOpenSSF(server.owner, server.name),
  ]);
  return {
    server_id: server.id,
    registry: "github",
    owner: server.owner,
    name: server.name,
    latest_version: null, // version detection for github-only refs is a future concern
    snapshot: {
      server_id: server.id,
      github_repo_key: `${server.owner.toLowerCase()}/${server.name.toLowerCase()}`,
      npm: null,
      pypi: null,
      github,
      openssf: openssf,
      depsdev: null,
      glama: null,
      smithery: null,
    },
  };
}

async function scrapeServer(
  server: ServerRow,
  identities: Partial<Record<IdentitySource, string>> = {},
): Promise<ServerScrape> {
  switch (server.registry) {
    case "npm":
      return scrapeNpmServer(server, identities);
    case "pypi":
      return scrapePypiServer(server);
    case "github":
      return scrapeGithubServer(server);
  }
}

/**
 * Load curated identities for the given server ids in one batch query.
 * Result is keyed by server_id with each value being a partial map of
 * source → identity.
 */
export async function loadIdentityMap(
  supabase: SupabaseClient,
  serverIds: readonly string[],
): Promise<IdentityMap> {
  const map = new Map<string, Partial<Record<IdentitySource, string>>>();
  if (serverIds.length === 0) return map;
  const { data, error } = await supabase
    .from("server_identities")
    .select("server_id, source, identity")
    .in("server_id", serverIds as string[]);
  if (error) throw new Error(`loadIdentityMap: ${error.message}`);
  for (const row of data ?? []) {
    const sid = row.server_id as string;
    const slot = map.get(sid) ?? {};
    slot[row.source as IdentitySource] = row.identity as string;
    map.set(sid, slot);
  }
  return map;
}

/**
 * Upserts a `versions` row for the given (server_id, version) and returns
 * the resulting id. Uses a SELECT-then-INSERT pattern (vs. true upsert) so
 * we don't accidentally overwrite `detected_at` on subsequent runs. Emits
 * `version_detected` on insert (not on existing-row hit).
 *
 * Exported so the hourly poll-versions worker can use the same path.
 */
export async function ensureVersionId(
  supabase: SupabaseClient,
  server_id: string,
  version: string,
): Promise<{ version_id: string; isNew: boolean }> {
  const { data: existing, error: selErr } = await supabase
    .from("versions")
    .select("id")
    .eq("server_id", server_id)
    .eq("version", version)
    .maybeSingle();
  if (selErr) throw new Error(`ensureVersionId(${server_id}): ${selErr.message}`);
  if (existing) return { version_id: existing.id as string, isNew: false };

  const { data: inserted, error: insErr } = await supabase
    .from("versions")
    .insert({ server_id, version })
    .select("id")
    .single();
  if (insErr) throw new Error(`ensureVersionId(${server_id}) insert: ${insErr.message}`);
  const version_id = inserted.id as string;
  // Fire-and-forget — emit() swallows errors so a NOTIFY drop doesn't fail
  // the broader insert that just succeeded.
  await notifyVersionDetected(supabase, { version_id, server_id });
  return { version_id, isNew: true };
}

/**
 * Updates servers.latest_version_id when a newer-detected version_id is
 * available. Idempotent: setting the same id is a no-op.
 */
async function updateLatestVersionId(
  supabase: SupabaseClient,
  server_id: string,
  version_id: string,
): Promise<void> {
  const { error } = await supabase
    .from("servers")
    .update({ latest_version_id: version_id, last_seen: new Date().toISOString() })
    .eq("id", server_id);
  if (error) throw new Error(`updateLatestVersionId(${server_id}): ${error.message}`);
}

export interface ScoreRunOptions {
  /** Cap the number of servers scored. Useful for smoke tests. */
  limit?: number;
  /** Skip the DB write step. Returns the would-be scored list. */
  dryRun?: boolean;
  /** Override the per-server scrape (used by tests). */
  scrape?: (
    server: ServerRow,
    identities: Partial<Record<IdentitySource, string>>,
  ) => Promise<ServerScrape>;
}

export async function scoreAllTrackedServers(
  supabase: SupabaseClient,
  options: ScoreRunOptions = {},
): Promise<ScoreRunResult> {
  const scrape = options.scrape ?? scrapeServer;

  let query = supabase
    .from("servers")
    .select("id, registry, owner, name, latest_version_id")
    .order("registry")
    .order("name");
  if (options.limit) query = query.limit(options.limit);
  const { data: servers, error } = await query;
  if (error) throw new Error(`scoreAllTrackedServers: server list: ${error.message}`);
  if (!servers || servers.length === 0) {
    return { rows_written: 0, scored: [], snapshots: [], skipped: [] };
  }

  const identities = await loadIdentityMap(
    supabase,
    (servers as ServerRow[]).map((s) => s.id),
  );

  const scrapes: ServerScrape[] = [];
  const skipped: Array<{ server_id: string; reason: string }> = [];

  // Sequential scrape to avoid hammering external APIs all at once. Phase 5
  // can fan out with a bounded concurrency pool if 78 × ~5s gets painful.
  for (const server of servers as ServerRow[]) {
    try {
      const result = await scrape(server, identities.get(server.id) ?? {});
      scrapes.push(result);
    } catch (err) {
      const reason = err instanceof Error ? err.message : String(err);
      console.error(`[scoring] scrape failed for ${server.id} (${server.registry}/${server.name}): ${reason}`);
      skipped.push({ server_id: server.id, reason });
    }
  }

  // For each scraped server, ensure a version row + collect a complete
  // ComponentSnapshot with the version_id attached. Servers with no
  // detected version are skipped — they can't have an adoption_scores row.
  const snapshots: ComponentSnapshot[] = [];
  for (const s of scrapes) {
    if (!s.latest_version) {
      skipped.push({ server_id: s.server_id, reason: "no version detected" });
      continue;
    }
    const version_id = options.dryRun
      ? `dry-run-${s.server_id}`
      : (await ensureVersionId(supabase, s.server_id, s.latest_version)).version_id;
    snapshots.push({ ...s.snapshot, version_id });
    if (!options.dryRun) {
      await updateLatestVersionId(supabase, s.server_id, version_id);
    }
  }

  const sharedMask = buildSharedRepoMask(snapshots);

  const rankInputs: RankInput[] = snapshots.map((snap) => ({
    server_id: snap.server_id,
    version_id: snap.version_id,
    raw: computeRawDimensions(snap, { shared_github_repos: sharedMask }),
  }));

  const scored = rankAndTier(rankInputs);

  let rows_written = 0;
  if (!options.dryRun) {
    const snapshotsById = new Map(snapshots.map((s) => [s.server_id, s]));
    rows_written = await writeAdoptionScores(supabase, scored, snapshotsById);

    // Emit grade_computed per server. Fire-and-forget — emit() swallows
    // errors so an alert-worker outage doesn't fail the scoring write that
    // just succeeded. One NOTIFY per server is fine (daily cadence, ~78
    // round-trips); batch if it ever becomes a hot path.
    await Promise.all(
      scored.map((s) =>
        notifyGradeComputed(supabase, {
          version_id: s.version_id,
          kind: "adoption",
          new_value: s.score,
        }),
      ),
    );
  }

  return { rows_written, scored, snapshots, skipped };
}
