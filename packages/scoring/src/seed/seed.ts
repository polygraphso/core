import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { parse } from "yaml";
import type { Registry } from "@polygraph/core";
import { getSupabaseClient } from "../supabase.js";

interface RawSeedRow {
  registry: unknown;
  owner?: unknown;
  name: unknown;
}

interface SeedRow {
  registry: Registry;
  owner: string | null;
  name: string;
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
    const key = `${raw.registry}|${owner ?? ""}|${raw.name}`;
    if (seen.has(key)) {
      throw new Error(`servers.yaml[${i}]: duplicate entry ${key}`);
    }
    seen.add(key);
    out.push({ registry: raw.registry as Registry, owner, name: raw.name });
  }
  return out;
}

async function main(): Promise<void> {
  const yamlPath = new URL("./servers.yaml", import.meta.url);
  const rows = validateSeed(loadSeed(yamlPath));
  console.log(`Loaded ${rows.length} entries from servers.yaml`);

  const now = new Date().toISOString();
  const supabase = getSupabaseClient();
  const { data, error } = await supabase
    .from("servers")
    .upsert(
      rows.map((r) => ({ ...r, last_seen: now })),
      { onConflict: "registry,owner,name" },
    )
    .select("id, registry, owner, name");

  if (error) {
    console.error("Seed failed:", error);
    process.exit(1);
  }
  console.log(`Upserted ${data?.length ?? 0} server rows.`);
}

// Entry-point guard so the validator can be imported by tests without running main.
const isEntryPoint = import.meta.url === `file://${process.argv[1]}`;
if (isEntryPoint) {
  main().catch((err) => {
    console.error(err);
    process.exit(1);
  });
}
