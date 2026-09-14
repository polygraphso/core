import { describe, it, expect, vi, beforeEach, type Mock } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { AgentIdentity } from "@/lib/agentIdentity";

// Mock the network-touching libs so the tests cover the helpers' orchestration
// (validation, version/freshness logic, identity→source/agent_id mapping) in
// isolation from the registry and the DB.
vi.mock("@/lib/registryVersion", () => ({
  resolveLatestVersion: vi.fn(async () => "1.2.3"),
}));
vi.mock("@/lib/hostedGrades", () => ({
  fetchPublishedGrade: vi.fn(),
  fetchPublishedGradeMap: vi.fn(async () => new Map()),
}));
vi.mock("@/lib/verifyRunnable", () => ({
  verifyRunnable: vi.fn(async () => ({ ok: true })),
  checkRegistryExists: vi.fn(),
}));
vi.mock("@/lib/knownMcp", () => ({
  gateKnownMcp: vi.fn(async () => ({ ok: true })),
  isCatalogedServer: vi.fn(),
}));
vi.mock("@/lib/agentIdentity", () => ({
  recordAgentCall: vi.fn(async () => {}),
}));

import { fetchPublishedGrade, fetchPublishedGradeMap } from "@/lib/hostedGrades";
import { runCheck } from "./check";
import { runGradeRequest } from "./gradeRequest";
import { runList } from "./list";

function fakeSupabase(rpc: Mock = vi.fn(async () => ({ data: null, error: null }))) {
  // Minimal chainable .from() so runGradeRequest's post-RPC request-row lookup
  // resolves (to "no row") without a real client.
  const chain = {
    select: () => chain,
    eq: () => chain,
    is: () => chain,
    maybeSingle: async () => ({ data: null, error: null }),
  };
  return { rpc, from: () => chain } as unknown as SupabaseClient & { rpc: Mock };
}

const identity = (source: AgentIdentity["source"], agentId = "claude-code/2.1.0"): AgentIdentity => ({
  agentId,
  name: agentId.split("/")[0]!,
  version: agentId.split("/")[1] ?? null,
  source,
  meta: null,
});

beforeEach(() => vi.clearAllMocks());

describe("runCheck", () => {
  it("rejects an empty ref with a 400", async () => {
    const r = await runCheck("", { supabase: fakeSupabase(), identity: identity("mcp") });
    expect(r).toEqual({ status: "error", code: 400, error: "server_ref is required." });
  });

  it("rejects an over-long ref with a 400", async () => {
    const r = await runCheck("npm/" + "x".repeat(600), {
      supabase: fakeSupabase(),
      identity: identity("mcp"),
    });
    expect(r.status).toBe("error");
    expect((r as { code: number }).code).toBe(400);
  });

  it("returns not_available (with a self_grade command) on a miss", async () => {
    vi.mocked(fetchPublishedGrade).mockResolvedValue(null);
    const supabase = fakeSupabase();
    const r = await runCheck("npm/nope-mcp", { supabase, identity: identity("mcp") });
    expect(r.status).toBe("not_available");
    if (r.status === "not_available") {
      expect(r.self_grade).toContain("npm/nope-mcp");
      expect(r.notify_url).toContain("npm/nope-mcp");
      expect(r.message).toContain("Hosted grading is discontinued");
      expect(r.message).not.toContain("request_grade");
    }
    // demand counter bumped on a miss
    expect(supabase.rpc).toHaveBeenCalledWith("bump_untracked_demand", { p_server_ref: "npm/nope-mcp" });
  });

  it("returns the graded result on a hit", async () => {
    vi.mocked(fetchPublishedGrade).mockResolvedValue({
      grade: "A",
      // minimal detail shape the helper passes through
      detail: { resolved_version: "1.2.3" },
    } as never);
    const r = await runCheck("npm/good-mcp@1.2.3", {
      supabase: fakeSupabase(),
      identity: identity("mcp"),
    });
    expect(r.status).toBe("graded");
    if (r.status === "graded") expect(r.polygraph).toBe("A");
  });
});

describe("runGradeRequest", () => {
  it("returns 410 and does not write when hosted grading is discontinued", async () => {
    const rpc: Mock<(...a: unknown[]) => Promise<unknown>> = vi.fn(async () => ({
      data: { created: true, demand: 1 },
      error: null,
    }));
    const r = await runGradeRequest(
      { serverRef: "npm/tavily-mcp" },
      { supabase: fakeSupabase(rpc), identity: identity("mcp") },
    );
    expect(r).toMatchObject({ status: "error", code: 410 });
    expect(rpc).not.toHaveBeenCalled();
  });
});

describe("runList", () => {
  const CORPUS = new Map([
    ["npm/a-server", "A"],
    ["npm/b-server", "B"],
    ["npm/another-a", "A"],
    ["npm/d-server", "D"],
  ]);

  beforeEach(() => {
    vi.mocked(fetchPublishedGradeMap).mockResolvedValue(CORPUS as never);
  });

  it("returns every server, sorted A-first then by ref, with a summary over the full corpus", async () => {
    const r = await runList({ supabase: fakeSupabase(), identity: identity("mcp") });
    if ("error" in r) throw new Error("expected success");
    expect(r.servers.map((s) => s.server_ref)).toEqual([
      "npm/a-server",
      "npm/another-a",
      "npm/b-server",
      "npm/d-server",
    ]);
    expect(r.total).toBe(4);
    expect(r.summary).toEqual({ total: 4, byGrade: { A: 2, B: 1, C: 0, D: 1, F: 0 } });
  });

  it("filters by grade while summary still covers the full corpus", async () => {
    const r = await runList({ supabase: fakeSupabase(), identity: identity("mcp") }, { grade: "A" });
    if ("error" in r) throw new Error("expected success");
    expect(r.servers.map((s) => s.server_ref)).toEqual(["npm/a-server", "npm/another-a"]);
    expect(r.total).toBe(2);
    expect(r.summary.total).toBe(4);
    expect(r.summary.byGrade).toEqual({ A: 2, B: 1, C: 0, D: 1, F: 0 });
  });

  it("pages the filtered set with limit/offset", async () => {
    const r = await runList({ supabase: fakeSupabase(), identity: identity("mcp") }, { limit: 2, offset: 1 });
    if ("error" in r) throw new Error("expected success");
    expect(r.servers.map((s) => s.server_ref)).toEqual(["npm/another-a", "npm/b-server"]);
    expect(r.total).toBe(4); // total reflects the (unfiltered) matching set, not the page
  });

  it("rejects an invalid grade with a 400", async () => {
    const r = await runList({ supabase: fakeSupabase(), identity: identity("mcp") }, { grade: "Z" as never });
    expect(r).toMatchObject({ status: "error", code: 400 });
  });

  it("rejects a non-positive limit with a 400", async () => {
    const r = await runList({ supabase: fakeSupabase(), identity: identity("mcp") }, { limit: 0 });
    expect(r).toMatchObject({ status: "error", code: 400 });
  });

  it("rejects a negative offset with a 400", async () => {
    const r = await runList({ supabase: fakeSupabase(), identity: identity("mcp") }, { offset: -1 });
    expect(r).toMatchObject({ status: "error", code: 400 });
  });
});
