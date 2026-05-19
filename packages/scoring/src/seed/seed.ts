import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { parse } from "yaml";
import type { IdentitySource, Registry } from "@polygraph/core";
import { getSupabaseClient } from "../supabase.js";

interface RawSeedRow {
  registry: unknown;
  owner?: unknown;
  name: unknown;
  smithery_qualified_name?: unknown;
  glama_namespace_slug?: unknown;
}

export interface SeedRow {
  registry: Registry;
  owner: string | null;
  name: string;
  /** Hand-curated cross-registry identities. Empty when nothing's verified. */
  identities: SeedIdentity[];
}

export interface SeedIdentity {
  source: IdentitySource;
  identity: string;
}

const REGISTRIES: ReadonlySet<Registry> = new Set(["npm", "pypi", "github"]);

function loadSeed(yamlPath: URL): RawSeedRow[] {
  const text = readFileSync(fileURLToPath(yamlPath), "utf-8");
  const parsed: unknown = parse(text);
  if (
    !parsed ||
    typeof parsed !== "object" ||
    !("servers" in parsed) ||
    !Array.isArray((parsed as { servers: unknown }).servers)
  ) {
    throw new Error("servers.yaml: missing top-level `servers:` list");
  }
  return (parsed as { servers: RawSeedRow[] }).servers;
}

function nonEmptyString(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  return trimmed.length === 0 ? null : trimmed;
}

export function validateSeed(rows: RawSeedRow[]): SeedRow[] {
  const out: SeedRow[] = [];
  const seen = new Set<string>();
  for (const [i, raw] of rows.entries()) {
    if (typeof raw.registry !== "string" || !REGISTRIES.has(raw.registry as Registry)) {
      throw new Error(`servers.yaml[${i}]: invalid registry "${String(raw.registry)}"`);
    }
    if (typeof raw.name !== "string" || raw.name.length === 0) {
      throw new Error(`servers.yaml[${i}]: missing or invalid name`);
    }
    const owner = raw.owner == null ? null : String(raw.owner);
    // Owner rules: npm optional, pypi always null, github required.
    if (owner === null && raw.registry === "github") {
      throw new Error(`servers.yaml[${i}]: github requires an owner`);
    }
    if (owner !== null && raw.registry === "pypi") {
      throw new Error(
        `servers.yaml[${i}]: pypi packages must not have an owner (flat namespace)`,
      );
    }

    const identities: SeedIdentity[] = [];
    const smithery = nonEmptyString(raw.smithery_qualified_name);
    if (smithery) identities.push({ source: "smithery", identity: smithery });
    const glama = nonEmptyString(raw.glama_namespace_slug);
    if (glama) {
      // Sanity-check shape so a typo is caught at validation, not at adapter time.
      if (!glama.includes("/")) {
        throw new Error(
          `servers.yaml[${i}]: glama_namespace_slug must be "namespace/slug" (got "${glama}")`,
        );
      }
      identities.push({ source: "glama", identity: glama });
    }

    const key = `${raw.registry}|${owner ?? ""}|${raw.name}`;
    if (seen.has(key)) {
      throw new Error(`servers.yaml[${i}]: duplicate entry ${key}`);
    }
    seen.add(key);
    out.push({ registry: raw.registry as Registry, owner, name: raw.name, identities });
  }
  return out;
}

async function main(): Promise<void> {
  const yamlPath = new URL("./servers.yaml", import.meta.url);
  const rows = validateSeed(loadSeed(yamlPath));
  console.log(`Loaded ${rows.length} entries from servers.yaml`);

  const now = new Date().toISOString();
  const supabase = getSupabaseClient();
  const { data: serverRows, error } = await supabase
    .from("servers")
    .upsert(
      rows.map((r) => ({
        registry: r.registry,
        owner: r.owner,
        name: r.name,
        last_seen: now,
      })),
      { onConflict: "registry,owner,name" },
    )
    .select("id, registry, owner, name");

  if (error) {
    console.error("Seed failed:", error);
    process.exit(1);
  }
  console.log(`Upserted ${serverRows?.length ?? 0} server rows.`);

  // Build a (registry, owner, name) → server_id map so we can attach
  // identities to the right server. supabase-js doesn't preserve order
  // guarantees on .select() after upsert, so we don't rely on indexing.
  const idByKey = new Map<string, string>();
  for (const row of serverRows ?? []) {
    const key = `${row.registry}|${row.owner ?? ""}|${row.name}`;
    idByKey.set(key, row.id as string);
  }

  const identityRows: Array<{ server_id: string; source: IdentitySource; identity: string }> = [];
  for (const r of rows) {
    if (r.identities.length === 0) continue;
    const server_id = idByKey.get(`${r.registry}|${r.owner ?? ""}|${r.name}`);
    if (!server_id) {
      console.error(`No server_id for ${r.registry}/${r.owner ?? ""}/${r.name} — skipping identities`);
      continue;
    }
    for (const ident of r.identities) {
      identityRows.push({ server_id, source: ident.source, identity: ident.identity });
    }
  }

  if (identityRows.length === 0) {
    console.log("No curated identities in seed.");
    return;
  }

  const { error: idErr, count } = await supabase
    .from("server_identities")
    .upsert(identityRows, { onConflict: "server_id,source", count: "exact" });

  if (idErr) {
    console.error("Identity upsert failed:", idErr);
    process.exit(1);
  }
  console.log(`Upserted ${count ?? identityRows.length} server_identities rows.`);
}

// Entry-point guard so the validator can be imported by tests without running main.
const isEntryPoint = import.meta.url === `file://${process.argv[1]}`;
if (isEntryPoint) {
  main().catch((err) => {
    console.error(err);
    process.exit(1);
  });
}
