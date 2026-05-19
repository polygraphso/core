/**
 * Hourly version-detection pass. Lightweight cousin of the daily scoring
 * orchestrator: per server, hit only the npm/pypi adapter to read the
 * current latest version, compare to the `versions` table, and insert
 * + NOTIFY when a new one shows up.
 *
 * No scoring happens here — the daily run picks up the new version_id
 * via the same `ensureVersionId` codepath and writes adoption_scores.
 *
 * github-only refs are skipped: github "versions" mean tags, which is a
 * different (and noisier) concept. v1 only polls versions for refs that
 * have a true registry version stream (npm, pypi).
 */

import type { SupabaseClient } from "@supabase/supabase-js";
import type { Registry } from "@polygraph/core";
import { fetchNpm } from "../adapters/npm.js";
import { fetchPypi } from "../adapters/pypi.js";
import { ensureVersionId } from "./orchestrate.js";

interface ServerRow {
  id: string;
  registry: Registry;
  owner: string | null;
  name: string;
}

export interface PollResult {
  checked: number;
  new_versions: number;
  skipped: Array<{ server_id: string; reason: string }>;
}

export interface PollOptions {
  limit?: number;
  /** Test seam: override the per-server fetch step. */
  fetchLatestVersion?: (server: ServerRow) => Promise<string | null>;
}

async function defaultFetchLatestVersion(server: ServerRow): Promise<string | null> {
  if (server.registry === "npm") {
    const pkg = server.owner ? `${server.owner}/${server.name}` : server.name;
    const data = await fetchNpm(pkg);
    return data?.latest_version ?? null;
  }
  if (server.registry === "pypi") {
    const data = await fetchPypi(server.name);
    return data?.latest_version ?? null;
  }
  // github: no first-class version stream; skip.
  return null;
}

export async function pollVersions(
  supabase: SupabaseClient,
  options: PollOptions = {},
): Promise<PollResult> {
  const fetchLatest = options.fetchLatestVersion ?? defaultFetchLatestVersion;

  let query = supabase
    .from("servers")
    .select("id, registry, owner, name")
    .in("registry", ["npm", "pypi"])
    .order("registry")
    .order("name");
  if (options.limit) query = query.limit(options.limit);
  const { data: servers, error } = await query;
  if (error) throw new Error(`pollVersions: list servers: ${error.message}`);
  if (!servers || servers.length === 0) {
    return { checked: 0, new_versions: 0, skipped: [] };
  }

  let newVersions = 0;
  const skipped: Array<{ server_id: string; reason: string }> = [];

  for (const server of servers as ServerRow[]) {
    try {
      const latest = await fetchLatest(server);
      if (!latest) {
        skipped.push({ server_id: server.id, reason: "no latest_version returned" });
        continue;
      }
      const { isNew } = await ensureVersionId(supabase, server.id, latest);
      if (isNew) newVersions++;
    } catch (err) {
      const reason = err instanceof Error ? err.message : String(err);
      console.error(`[poll] ${server.id} (${server.registry}/${server.name}): ${reason}`);
      skipped.push({ server_id: server.id, reason });
    }
  }

  return { checked: servers.length, new_versions: newVersions, skipped };
}
