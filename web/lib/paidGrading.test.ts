import { describe, it, expect, vi, beforeEach } from "vitest";

// --- module mocks (declared before importing the SUT) ---
const state: {
  maybeSingleQueue: Array<{ data: unknown; error: unknown }>;
  updates: Array<{ table: string; values: Record<string, unknown> }>;
  jobStatus: unknown;
  runnerConfigured: boolean;
} = { maybeSingleQueue: [], updates: [], jobStatus: null, runnerConfigured: true };

function fakeBuilder(table: string) {
  const b: Record<string, unknown> = {};
  const chain = () => b;
  b.select = chain;
  b.eq = chain;
  b.in = chain;
  b.is = chain;
  b.order = chain;
  b.limit = chain;
  b.update = (values: Record<string, unknown>) => {
    state.updates.push({ table, values });
    return b;
  };
  b.maybeSingle = async () => state.maybeSingleQueue.shift() ?? { data: null, error: null };
  // Awaiting a builder that had no maybeSingle() (update without select).
  (b as { then: unknown }).then = (res: (v: unknown) => unknown) => res({ data: null, error: null });
  return b;
}

vi.mock("@/lib/supabase", () => ({
  getSupabaseAdmin: () => ({ from: (t: string) => fakeBuilder(t) }),
}));
vi.mock("@/lib/hostedRunner", () => ({
  hostedRunnerConfig: () => (state.runnerConfigured ? { url: "https://h", token: "t" } : null),
  postGrade: vi.fn(async () => ({ status: 202, data: { id: "job-1" } })),
  getGradeStatus: vi.fn(async () => ({ status: 200, data: state.jobStatus })),
  runnerKindFor: (k: string) => (k === "skill" ? "skill" : "server"),
}));
vi.mock("@/lib/serverRef", () => ({ refToPath: (k: string) => k }));
vi.mock("@/lib/skillGrades", () => ({ skillRefToPath: (t: string) => t.replace("#", "/") }));
vi.mock("@/lib/x402Fee", () => ({
  settleAuthorizedFeePayment: async () => ({ state: "no_authorization" }),
  voidAuthorizedFeePayment: async () => {},
}));

import { pollAndReconcile } from "./paidGrading";

beforeEach(() => {
  state.maybeSingleQueue = [];
  state.updates = [];
  state.jobStatus = null;
  state.runnerConfigured = true;
});

const paidRow = (over: Record<string, unknown> = {}) => ({
  id: "req-1",
  target: "npm/some-mcp",
  target_kind: "registry_ref",
  status: "queued",
  priority_paid_at: "2026-07-16T00:00:00Z",
  hosted_run_id: null,
  runner_job_id: "job-1",
  note: null,
  ...over,
});

describe("pollAndReconcile", () => {
  it("returns unpaid when the request has no payment", async () => {
    state.maybeSingleQueue = [{ data: paidRow({ priority_paid_at: null }), error: null }];
    const r = await pollAndReconcile("req-1");
    expect(r.state).toBe("unpaid");
  });

  it("reports grading while the runner job is still running", async () => {
    state.maybeSingleQueue = [{ data: paidRow(), error: null }];
    state.jobStatus = { status: "running" };
    const r = await pollAndReconcile("req-1");
    expect(r).toEqual({ state: "grading", target: "npm/some-mcp" });
    expect(state.updates).toHaveLength(0); // nothing written mid-run
  });

  it("publishes the run and completes the request when the job is done", async () => {
    state.maybeSingleQueue = [
      { data: paidRow(), error: null }, // request lookup
      { data: { grade: "A", target: "npm/some-mcp", target_kind: "registry_ref" }, error: null }, // publish
    ];
    state.jobStatus = { status: "done", hosted_run_id: "HR-9" };
    const r = await pollAndReconcile("req-1");
    expect(r).toEqual({
      state: "graded",
      target: "npm/some-mcp",
      grade: "A",
      reportUrl: "/mcp/npm/some-mcp",
    });
    // published the hosted_runs row and completed the request
    const hr = state.updates.find((u) => u.table === "hosted_runs");
    expect(hr?.values.published_at).toBeTruthy();
    const gr = state.updates.find((u) => u.table === "grade_requests");
    expect(gr?.values).toMatchObject({ status: "completed", hosted_run_id: "HR-9" });
  });

  it("declines the request with the reason when the job errors", async () => {
    state.maybeSingleQueue = [{ data: paidRow(), error: null }];
    state.jobStatus = { status: "error", error: "no package.json — Node/Python only" };
    const r = await pollAndReconcile("req-1");
    expect(r.state).toBe("failed");
    if (r.state === "failed") expect(r.reason).toContain("package.json");
    const gr = state.updates.find((u) => u.table === "grade_requests");
    expect(gr?.values.status).toBe("declined");
  });

  it("short-circuits to graded for an already-completed request", async () => {
    state.maybeSingleQueue = [
      { data: paidRow({ status: "completed", hosted_run_id: "HR-1" }), error: null },
      { data: { grade: "B" }, error: null },
    ];
    const r = await pollAndReconcile("req-1");
    expect(r).toMatchObject({ state: "graded", grade: "B", reportUrl: "/mcp/npm/some-mcp" });
  });

  it("routes a skill target to the /skill report path with the # encoded as a subpath", async () => {
    state.maybeSingleQueue = [
      { data: paidRow({ target: "github/o/r#p", target_kind: "skill", status: "completed", hosted_run_id: "HR-2" }), error: null },
      { data: { grade: "A" }, error: null },
    ];
    const r = await pollAndReconcile("req-1");
    // # → / so the client link keeps the subpath (a raw # would be a fragment).
    expect(r).toMatchObject({ state: "graded", reportUrl: "/skill/github/o/r/p" });
  });
});
