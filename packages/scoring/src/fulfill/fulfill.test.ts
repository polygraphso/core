import { describe, it, expect } from "vitest";
import { runFulfillment } from "./fulfill.js";
import type { FulfillStore, GradeRequestRecord, HostedRunRecord } from "./store.js";
import type { ComposedEmail, EmailSender } from "../alerts/email.js";

/** In-memory FulfillStore modelling the queue + hosted_runs linkage. */
class FakeStore implements FulfillStore {
  queued: GradeRequestRecord[];
  inProgress: GradeRequestRecord[];
  runs: Map<string, HostedRunRecord>;
  publishedVersions: Set<string>; // `${target}@${version}`
  latestPublished: Map<string, { id: string; resolved_version: string | null; grade: string | null }>;
  inFlight: Map<string, string>; // target -> run id

  enqueued: Array<{ target: string; kind: string }> = [];
  linked: Array<{ requestId: string; runId: string }> = [];
  completed: string[] = [];
  declined: string[] = [];
  private runSeq = 0;

  constructor(opts: {
    queued?: GradeRequestRecord[];
    inProgress?: GradeRequestRecord[];
    runs?: Record<string, HostedRunRecord>;
    publishedVersions?: string[];
    latestPublished?: Record<string, { id: string; resolved_version: string | null; grade: string | null }>;
    inFlight?: Record<string, string>;
  }) {
    this.queued = opts.queued ?? [];
    this.inProgress = opts.inProgress ?? [];
    this.runs = new Map(Object.entries(opts.runs ?? {}));
    this.publishedVersions = new Set(opts.publishedVersions ?? []);
    this.latestPublished = new Map(Object.entries(opts.latestPublished ?? {}));
    this.inFlight = new Map(Object.entries(opts.inFlight ?? {}));
  }

  async queuedRequests(limit: number) {
    return this.queued.slice(0, limit);
  }
  async inProgressRequests() {
    return this.inProgress;
  }
  async runById(id: string) {
    return this.runs.get(id) ?? null;
  }
  async latestPublishedGrade(target: string) {
    return this.latestPublished.get(target) ?? null;
  }
  async hasPublishedGradeForVersion(target: string, version: string) {
    return this.publishedVersions.has(`${target}@${version}`);
  }
  async inFlightRegradeId(target: string) {
    return this.inFlight.get(target) ?? null;
  }
  async enqueueRegrade(target: string, kind: "registry_ref" | "remote_url") {
    this.enqueued.push({ target, kind });
    const id = `run-${++this.runSeq}`;
    this.inFlight.set(target, id);
    return id;
  }
  async markInProgress(requestId: string, hostedRunId: string) {
    this.linked.push({ requestId, runId: hostedRunId });
  }
  async completeRequest(requestId: string) {
    this.completed.push(requestId);
  }
  async declineRequest(requestId: string) {
    this.declined.push(requestId);
  }
}

class FakeSender implements EmailSender {
  sent: Array<{ to: string; email: ComposedEmail }> = [];
  fail = false;
  async send(to: string, email: ComposedEmail) {
    if (this.fail) throw new Error("resend down");
    this.sent.push({ to, email });
    return { id: `msg-${this.sent.length}` };
  }
}

const req = (over: Partial<GradeRequestRecord> = {}): GradeRequestRecord => ({
  id: "r1",
  target: "npm/foo-mcp",
  target_kind: "registry_ref",
  email: null,
  hosted_run_id: null,
  ...over,
});

const latestNpm = async () => "2.0.0";

describe("runFulfillment — enqueue pass", () => {
  it("enqueues a queued npm request and links the created run", async () => {
    const store = new FakeStore({ queued: [req()] });
    const result = await runFulfillment(store, { fetchLatestVersion: latestNpm });
    expect(store.enqueued).toEqual([{ target: "npm/foo-mcp", kind: "registry_ref" }]);
    expect(store.linked).toEqual([{ requestId: "r1", runId: "run-1" }]);
    expect(result.enqueued).toBe(1);
  });

  it("piggybacks on an already-in-flight regrade instead of enqueueing a duplicate", async () => {
    const store = new FakeStore({
      queued: [req()],
      inFlight: { "npm/foo-mcp": "run-existing" },
    });
    await runFulfillment(store, { fetchLatestVersion: latestNpm });
    expect(store.enqueued).toEqual([]);
    expect(store.linked).toEqual([{ requestId: "r1", runId: "run-existing" }]);
  });

  it("completes immediately (with email) when the latest version is already published", async () => {
    const sender = new FakeSender();
    const store = new FakeStore({
      queued: [req({ email: "dev@example.com" })],
      publishedVersions: ["npm/foo-mcp@2.0.0"],
      latestPublished: { "npm/foo-mcp": { id: "h1", resolved_version: "2.0.0", grade: "A" } },
    });
    await runFulfillment(store, { fetchLatestVersion: latestNpm, sender });
    expect(store.completed).toEqual(["r1"]);
    expect(store.enqueued).toEqual([]);
    expect(sender.sent).toHaveLength(1);
    expect(sender.sent[0]!.to).toBe("dev@example.com");
    expect(sender.sent[0]!.email.subject).toContain("npm/foo-mcp");
  });

  it("declines legacy refs on registries the harness can't run", async () => {
    const store = new FakeStore({ queued: [req({ target: "github/owner/repo" })] });
    await runFulfillment(store, { fetchLatestVersion: latestNpm });
    expect(store.declined).toEqual(["r1"]);
  });

  it("leaves a request queued when the registry can't resolve a latest version", async () => {
    const store = new FakeStore({ queued: [req()] });
    const result = await runFulfillment(store, { fetchLatestVersion: async () => null });
    expect(store.enqueued).toEqual([]);
    expect(store.declined).toEqual([]);
    expect(result.skipped.some((s) => s.target === "npm/foo-mcp")).toBe(true);
  });

  it("handles remote_url targets: completes when published, enqueues otherwise", async () => {
    const store = new FakeStore({
      queued: [
        req({ id: "r1", target: "https://mcp.a.com/sse", target_kind: "remote_url" }),
        req({ id: "r2", target: "https://mcp.b.com/sse", target_kind: "remote_url" }),
      ],
      latestPublished: {
        "https://mcp.a.com/sse": { id: "h2", resolved_version: null, grade: "B" },
      },
    });
    await runFulfillment(store, { fetchLatestVersion: latestNpm });
    expect(store.completed).toEqual(["r1"]);
    expect(store.enqueued).toEqual([{ target: "https://mcp.b.com/sse", kind: "remote_url" }]);
  });

  it("respects the per-run enqueue cap", async () => {
    const store = new FakeStore({
      queued: [req({ id: "r1" }), req({ id: "r2", target: "npm/bar-mcp" }), req({ id: "r3", target: "npm/baz-mcp" })],
    });
    await runFulfillment(store, { fetchLatestVersion: latestNpm, maxEnqueue: 2 });
    expect(store.enqueued).toHaveLength(2);
  });
});

describe("runFulfillment — reconcile pass", () => {
  it("completes a request whose linked run is published, and emails the requester", async () => {
    const sender = new FakeSender();
    const store = new FakeStore({
      inProgress: [req({ email: "dev@example.com", hosted_run_id: "h9" })],
      runs: {
        h9: { id: "h9", status: "complete", grade: "A", resolved_version: "2.0.0", published_at: "2026-07-04T00:00:00Z", failure_reason: null },
      },
    });
    const result = await runFulfillment(store, { sender });
    expect(store.completed).toEqual(["r1"]);
    expect(result.completed).toBe(1);
    expect(sender.sent[0]!.email.subject).toContain("A");
  });

  it("declines a request whose linked run failed", async () => {
    const store = new FakeStore({
      inProgress: [req({ hosted_run_id: "h9" })],
      runs: {
        h9: { id: "h9", status: "failed", grade: null, resolved_version: null, published_at: null, failure_reason: "could not launch" },
      },
    });
    const result = await runFulfillment(store, {});
    expect(store.declined).toEqual(["r1"]);
    expect(result.declined).toBe(1);
  });

  it("leaves requests pending while the linked run is still queued/running", async () => {
    const store = new FakeStore({
      inProgress: [req({ hosted_run_id: "h9" })],
      runs: {
        h9: { id: "h9", status: "running", grade: null, resolved_version: null, published_at: null, failure_reason: null },
      },
    });
    const result = await runFulfillment(store, {});
    expect(store.completed).toEqual([]);
    expect(store.declined).toEqual([]);
    expect(result.pending).toBe(1);
  });

  it("still completes the request when the fulfillment email fails to send", async () => {
    const sender = new FakeSender();
    sender.fail = true;
    const store = new FakeStore({
      inProgress: [req({ email: "dev@example.com", hosted_run_id: "h9" })],
      runs: {
        h9: { id: "h9", status: "complete", grade: "B", resolved_version: "1.0.0", published_at: "2026-07-04T00:00:00Z", failure_reason: null },
      },
    });
    const result = await runFulfillment(store, { sender });
    expect(store.completed).toEqual(["r1"]);
    expect(result.emailFailed).toBe(1);
  });
});
