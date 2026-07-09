import { describe, it, expect } from "vitest";
import { runAdvisoryIngest, normalizeTargetKey, type AdvisoryIngestDeps } from "./ingest.js";
import type {
  AdvisoryStore,
  EntryTarget,
  NormalizedAdvisory,
  NormalizedAdvisoryTarget,
} from "./store.js";
import type { DepsDevAdapterData, DepsDevEcosystem } from "../adapters/depsdev.js";
import type { OsvAdvisory } from "../adapters/osv.js";
import type { GhsaAdvisory } from "../adapters/ghsa.js";

interface WrittenTarget {
  advisoryId: string;
  target: NormalizedAdvisoryTarget;
}

class FakeAdvisoryStore implements AdvisoryStore {
  advisories: NormalizedAdvisory[] = [];
  targets: WrittenTarget[] = [];
  staleCalls: Array<{ packageKey: string; seen: string[] }> = [];

  constructor(private readonly entryTargets: EntryTarget[]) {}

  async distinctEcosystemTargets() {
    return this.entryTargets;
  }
  async upsertAdvisory(advisory: NormalizedAdvisory) {
    this.advisories.push(advisory);
    return `adv-${advisory.ghsa_id}`;
  }
  async upsertAdvisoryTarget(advisoryId: string, target: NormalizedAdvisoryTarget) {
    this.targets.push({ advisoryId, target });
  }
  async markTargetsStale(packageKey: string, seenGhsaIds: string[]) {
    this.staleCalls.push({ packageKey, seen: seenGhsaIds });
  }
}

function depsDevData(advisories: Array<{ ghsa_id: string; version: string }>): DepsDevAdapterData {
  return {
    ecosystem: "npm",
    package_name: "x",
    latest_version: advisories[0]?.version ?? "1.0.0",
    dependents_count: 0,
    advisory_count: advisories.length,
    max_advisory_severity: null,
    advisory_severities: [],
    advisories,
    has_slsa_provenance: false,
    license_detected: null,
  };
}

function osvData(ghsa: string, over: Partial<OsvAdvisory> = {}): OsvAdvisory {
  return {
    ghsa_id: ghsa,
    cve_ids: ["CVE-2024-0001"],
    severity: "HIGH",
    cvss: null,
    cvss_vector: "CVSS:3.1/AV:N",
    summary: "a flaw",
    url: `https://github.com/advisories/${ghsa}`,
    published_at: "2024-01-01T00:00:00Z",
    withdrawn_at: null,
    affected: [{ ecosystem: "npm", name: "left-pad", range: ">=0 <1.4.2", fixed_version: "1.4.2" }],
    ...over,
  };
}

function makeDeps(over: Partial<AdvisoryIngestDeps> = {}): AdvisoryIngestDeps {
  return {
    fetchDepsDev: async () => null,
    fetchOsvVuln: async () => null,
    fetchRepoSecurityAdvisories: async () => [],
    ...over,
  };
}

describe("normalizeTargetKey", () => {
  it("strips a skill #path suffix", () => {
    expect(normalizeTargetKey("github/BankrBot/skills#skills/foo")).toBe("github/BankrBot/skills");
  });
  it("leaves a plain target unchanged", () => {
    expect(normalizeTargetKey("npm/@scope/pkg")).toBe("npm/@scope/pkg");
  });
});

describe("runAdvisoryIngest", () => {
  it("ingests an npm target: deps.dev names the GHSA, OSV enriches range/fixed", async () => {
    const store = new FakeAdvisoryStore([{ target: "npm/left-pad", target_kind: "registry_ref" }]);
    const deps = makeDeps({
      fetchDepsDev: async (pkg: string, eco: DepsDevEcosystem) => {
        expect(pkg).toBe("left-pad");
        expect(eco).toBe("npm");
        return depsDevData([{ ghsa_id: "GHSA-aaaa", version: "1.0.0" }]);
      },
      fetchOsvVuln: async (ghsa: string) => osvData(ghsa),
    });

    const result = await runAdvisoryIngest(store, deps);

    expect(result.npmPypiCovered).toBe(1);
    expect(result.advisoriesWritten).toBe(1);
    expect(store.advisories[0]).toMatchObject({ ghsa_id: "GHSA-aaaa", source: "osv", severity: "HIGH" });
    expect(store.targets[0]!.target).toMatchObject({
      package_key: "npm/left-pad",
      ecosystem: "npm",
      affected_range: ">=0 <1.4.2",
      fixed_version: "1.4.2",
      current_version: "1.0.0",
    });
    expect(store.staleCalls[0]).toEqual({ packageKey: "npm/left-pad", seen: ["GHSA-aaaa"] });
  });

  it("keeps the npm scope in the deps.dev package name", async () => {
    const store = new FakeAdvisoryStore([{ target: "npm/@scope/pkg", target_kind: "registry_ref" }]);
    let seenPkg = "";
    await runAdvisoryIngest(store, makeDeps({
      fetchDepsDev: async (pkg: string) => { seenPkg = pkg; return depsDevData([]); },
    }));
    expect(seenPkg).toBe("@scope/pkg");
  });

  it("falls back to a minimal depsdev advisory when OSV has no detail", async () => {
    const store = new FakeAdvisoryStore([{ target: "npm/left-pad", target_kind: "registry_ref" }]);
    await runAdvisoryIngest(store, makeDeps({
      fetchDepsDev: async () => depsDevData([{ ghsa_id: "GHSA-bbbb", version: "2.0.0" }]),
      fetchOsvVuln: async () => null,
    }));
    expect(store.advisories[0]).toMatchObject({
      ghsa_id: "GHSA-bbbb",
      source: "depsdev",
      severity: null,
      url: "https://github.com/advisories/GHSA-bbbb",
    });
    expect(store.targets[0]!.target.current_version).toBe("2.0.0");
  });

  it("ingests a github target from repo security advisories", async () => {
    const store = new FakeAdvisoryStore([{ target: "github/acme/server", target_kind: "registry_ref" }]);
    const ghsa: GhsaAdvisory = {
      ghsa_id: "GHSA-cccc",
      cve_ids: ["CVE-2024-9999"],
      severity: "CRITICAL",
      cvss: 9.8,
      cvss_vector: "CVSS:3.1/AV:N",
      summary: "rce",
      url: "https://github.com/acme/server/security/advisories/GHSA-cccc",
      published_at: "2024-02-02T00:00:00Z",
      withdrawn_at: null,
      affected_range: "< 2.0.0",
      fixed_version: "2.0.0",
    };
    const result = await runAdvisoryIngest(store, makeDeps({
      fetchRepoSecurityAdvisories: async (owner: string, repo: string) => {
        expect(owner).toBe("acme");
        expect(repo).toBe("server");
        return [ghsa];
      },
    }));
    expect(result.githubCovered).toBe(1);
    expect(store.advisories[0]).toMatchObject({ ghsa_id: "GHSA-cccc", source: "github", severity: "CRITICAL" });
    expect(store.targets[0]!.target).toMatchObject({
      package_key: "github/acme/server",
      ecosystem: "github",
      affected_range: "< 2.0.0",
      fixed_version: "2.0.0",
    });
  });

  it("maps a skill target to its github repo (strips #path)", async () => {
    const store = new FakeAdvisoryStore([
      { target: "github/acme/skills#skills/foo", target_kind: "skill" },
    ]);
    let seen = "";
    await runAdvisoryIngest(store, makeDeps({
      fetchRepoSecurityAdvisories: async (owner: string, repo: string) => { seen = `${owner}/${repo}`; return []; },
    }));
    expect(seen).toBe("acme/skills");
    expect(store.staleCalls[0]!.packageKey).toBe("github/acme/skills");
  });

  it("skips an unparseable (remote https) target", async () => {
    const store = new FakeAdvisoryStore([
      { target: "https://mcp.example.com/sse", target_kind: "remote_url" },
    ]);
    const result = await runAdvisoryIngest(store, makeDeps());
    expect(result.targetsProcessed).toBe(0);
    expect(result.targetsSkipped[0]).toMatchObject({ reason: "unparseable target" });
  });

  it("dry-run writes nothing", async () => {
    const store = new FakeAdvisoryStore([{ target: "npm/left-pad", target_kind: "registry_ref" }]);
    await runAdvisoryIngest(store, makeDeps({
      fetchDepsDev: async () => depsDevData([{ ghsa_id: "GHSA-dddd", version: "1.0.0" }]),
      fetchOsvVuln: async (ghsa: string) => osvData(ghsa),
    }), { dryRun: true });
    expect(store.advisories).toHaveLength(0);
    expect(store.targets).toHaveLength(0);
    expect(store.staleCalls).toHaveLength(0);
  });

  it("degrades a fetch failure to a skip, not an abort", async () => {
    const store = new FakeAdvisoryStore([
      { target: "npm/boom", target_kind: "registry_ref" },
      { target: "npm/left-pad", target_kind: "registry_ref" },
    ]);
    const result = await runAdvisoryIngest(store, makeDeps({
      fetchDepsDev: async (pkg: string) => {
        if (pkg === "boom") throw new Error("network down");
        return depsDevData([]);
      },
    }));
    expect(result.targetsProcessed).toBe(1);
    expect(result.targetsSkipped).toEqual([{ target: "npm/boom", reason: "network down" }]);
  });
});
