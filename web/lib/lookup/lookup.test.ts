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

import { fetchPublishedGrade } from "@/lib/hostedGrades";
import { runCheck } from "./check";
import { runGradeRequest } from "./gradeRequest";

function fakeSupabase(rpc: Mock = vi.fn(async () => ({ data: null, error: null }))) {
  return { rpc } as unknown as SupabaseClient & { rpc: Mock };
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
  it("maps an mcp caller to source=mcp and forwards its agent_id", async () => {
    const rpc: Mock<(...a: unknown[]) => Promise<unknown>> = vi.fn(async () => ({ data: { created: true, demand: 1 }, error: null }));
    const supabase = fakeSupabase(rpc);
    await runGradeRequest({ serverRef: "npm/tavily-mcp" }, { supabase, identity: identity("mcp") });
    const call = rpc.mock.calls.find((c) => c[0] === "record_grade_request");
    expect(call?.[1]).toMatchObject({ p_source: "mcp", p_agent_id: "claude-code/2.1.0" });
  });

  it("records a raw caller as source=cli with a null agent_id", async () => {
    const rpc: Mock<(...a: unknown[]) => Promise<unknown>> = vi.fn(async () => ({ data: { created: true, demand: 2 }, error: null }));
    const supabase = fakeSupabase(rpc);
    await runGradeRequest(
      { serverRef: "npm/tavily-mcp" },
      { supabase, identity: identity("raw", "ua:curl/8.6") },
    );
    const call = rpc.mock.calls.find((c) => c[0] === "record_grade_request");
    expect(call?.[1]).toMatchObject({ p_source: "cli", p_agent_id: null });
  });

  it("rejects a bad ref before touching the DB", async () => {
    const rpc: Mock<(...a: unknown[]) => Promise<unknown>> = vi.fn(async () => ({ data: null, error: null }));
    const r = await runGradeRequest({ serverRef: "" }, { supabase: fakeSupabase(rpc), identity: identity("mcp") });
    expect(r.status).toBe("error");
    expect(rpc).not.toHaveBeenCalled();
  });
});
