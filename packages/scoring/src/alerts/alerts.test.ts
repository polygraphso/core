import { describe, it, expect, vi } from "vitest";
import { runAlerts } from "./alerts.js";
import type {
  AlertStore,
  ClaimDeliveryInput,
  MonitorRecord,
  PublishedGrade,
} from "./store.js";
import { buildAlertEmail } from "./email.js";
import type { ComposedEmail, EmailSender } from "./email.js";

/** In-memory AlertStore that models the unique (monitor, run) delivery constraint. */
class FakeStore implements AlertStore {
  monitors: MonitorRecord[];
  latest: Map<string, PublishedGrade>; // target -> latest published grade
  publishedVersions: Set<string>; // `${target}@${version}` with a published grade
  inFlight: Set<string>; // targets with a queued/running monitor regrade

  enqueued: string[] = [];
  deliveries = new Map<string, { id: string; input: ClaimDeliveryInput }>();
  marks: Array<{ id: string; status: string; detail: unknown }> = [];
  watermarks: Array<{ monitorId: string; grade: PublishedGrade }> = [];
  seen: Array<{ monitorId: string; runId: string }> = [];
  private deliverySeq = 0;

  constructor(opts: {
    monitors: MonitorRecord[];
    latest?: Record<string, PublishedGrade>;
    publishedVersions?: string[];
    inFlight?: string[];
    preclaimed?: Array<{ monitorId: string; runId: string }>;
  }) {
    this.monitors = opts.monitors;
    this.latest = new Map(Object.entries(opts.latest ?? {}));
    this.publishedVersions = new Set(opts.publishedVersions ?? []);
    this.inFlight = new Set(opts.inFlight ?? []);
    for (const p of opts.preclaimed ?? []) {
      this.deliveries.set(`${p.monitorId}|${p.runId}`, {
        id: `pre-${p.monitorId}-${p.runId}`,
        input: {} as ClaimDeliveryInput,
      });
    }
  }

  async activeMonitors() {
    return this.monitors;
  }
  async latestPublishedGrade(target: string) {
    return this.latest.get(target) ?? null;
  }
  async hasPublishedGradeForVersion(target: string, version: string) {
    return this.publishedVersions.has(`${target}@${version}`);
  }
  async hasInFlightMonitorRegrade(target: string) {
    return this.inFlight.has(target);
  }
  async enqueueMonitorRegrade(target: string) {
    this.enqueued.push(target);
    this.inFlight.add(target); // a real enqueue makes the next check see it in flight
  }
  async claimDelivery(input: ClaimDeliveryInput) {
    const key = `${input.monitor_id}|${input.hosted_run_id}`;
    if (this.deliveries.has(key)) return null; // unique-constraint conflict
    const id = `d${++this.deliverySeq}`;
    this.deliveries.set(key, { id, input });
    return id;
  }
  async markDelivery(id: string, status: "sent" | "failed", detail: unknown) {
    this.marks.push({ id, status, detail });
  }
  async advanceWatermark(monitorId: string, grade: PublishedGrade) {
    this.watermarks.push({ monitorId, grade });
    const m = this.monitors.find((x) => x.id === monitorId);
    if (m) {
      m.last_notified_run_id = grade.id;
      m.last_notified_grade = grade.grade;
    }
  }
  async markSeen(monitorId: string, runId: string) {
    this.seen.push({ monitorId, runId });
    const m = this.monitors.find((x) => x.id === monitorId);
    if (m) m.last_notified_run_id = runId; // dedup watermark only; grade/at untouched
  }
}

function monitor(over: Partial<MonitorRecord> = {}): MonitorRecord {
  return {
    id: "m1",
    target: "npm/@scope/srv",
    email: "dev@example.com",
    unsubscribe_token: "tok-1",
    last_notified_run_id: null,
    last_notified_grade: null,
    alert_min_grade: null,
    ...over,
  };
}

function recordingSender(): { sender: EmailSender; sent: Array<{ to: string; email: ComposedEmail }> } {
  const sent: Array<{ to: string; email: ComposedEmail }> = [];
  return {
    sent,
    sender: {
      send: vi.fn(async (to: string, email: ComposedEmail) => {
        sent.push({ to, email });
        return { id: `resend-${sent.length}` };
      }),
    },
  };
}

describe("runAlerts — enqueue pass", () => {
  it("enqueues a regrade when the latest version has no published grade and none is in flight", async () => {
    const store = new FakeStore({ monitors: [monitor()] });
    const result = await runAlerts(store, {
      fetchLatestVersion: async () => "2.0.0",
    });
    expect(store.enqueued).toEqual(["npm/@scope/srv"]);
    expect(result.enqueued).toBe(1);
  });

  it("does NOT enqueue when the latest version is already graded", async () => {
    const store = new FakeStore({
      monitors: [monitor()],
      publishedVersions: ["npm/@scope/srv@2.0.0"],
    });
    await runAlerts(store, { fetchLatestVersion: async () => "2.0.0" });
    expect(store.enqueued).toEqual([]);
  });

  it("does NOT enqueue when a monitor regrade is already in flight", async () => {
    const store = new FakeStore({ monitors: [monitor()], inFlight: ["npm/@scope/srv"] });
    await runAlerts(store, { fetchLatestVersion: async () => "2.0.0" });
    expect(store.enqueued).toEqual([]);
  });

  it("dedupes by target so two monitors of the same server enqueue once", async () => {
    const store = new FakeStore({
      monitors: [monitor({ id: "m1", email: "a@x.com" }), monitor({ id: "m2", email: "b@x.com" })],
    });
    await runAlerts(store, { fetchLatestVersion: async () => "2.0.0" });
    expect(store.enqueued).toEqual(["npm/@scope/srv"]);
  });

  it("skips unmonitorable registries (e.g. a remote/github ref) without enqueuing", async () => {
    const store = new FakeStore({ monitors: [monitor({ target: "github/owner/repo" })] });
    const result = await runAlerts(store, { fetchLatestVersion: async () => "2.0.0" });
    expect(store.enqueued).toEqual([]);
    expect(result.skipped.some((s) => /unmonitorable/.test(s.reason))).toBe(true);
  });

  it("respects the enqueue cap", async () => {
    const monitors = ["a", "b", "c"].map((n) => monitor({ id: n, target: `npm/${n}` }));
    const store = new FakeStore({ monitors });
    const result = await runAlerts(store, { fetchLatestVersion: async () => "1.0.0", maxEnqueue: 2 });
    expect(result.enqueued).toBe(2);
    expect(store.enqueued).toHaveLength(2);
  });
});

describe("runAlerts — reconcile pass", () => {
  it("claims a delivery, sends, and advances the watermark on a new published grade", async () => {
    const store = new FakeStore({
      monitors: [monitor()],
      latest: { "npm/@scope/srv": { id: "run-9", resolved_version: "2.0.0", grade: "B" } },
      // version already graded → no enqueue noise
      publishedVersions: ["npm/@scope/srv@2.0.0"],
    });
    const { sender, sent } = recordingSender();
    const result = await runAlerts(store, {
      fetchLatestVersion: async () => "2.0.0",
      sender,
    });
    expect(sent).toHaveLength(1);
    expect(sent[0]!.to).toBe("dev@example.com");
    expect(result.sent).toBe(1);
    expect(store.marks).toEqual([{ id: "d1", status: "sent", detail: { resendMessageId: "resend-1" } }]);
    expect(store.watermarks).toEqual([{ monitorId: "m1", grade: { id: "run-9", resolved_version: "2.0.0", grade: "B" } }]);
  });

  it("does NOT notify when the latest grade is the one already notified (watermark match)", async () => {
    const store = new FakeStore({
      monitors: [monitor({ last_notified_run_id: "run-9" })],
      latest: { "npm/@scope/srv": { id: "run-9", resolved_version: "2.0.0", grade: "B" } },
      publishedVersions: ["npm/@scope/srv@2.0.0"],
    });
    const { sender, sent } = recordingSender();
    const result = await runAlerts(store, { fetchLatestVersion: async () => "2.0.0", sender });
    expect(sent).toHaveLength(0);
    expect(result.sent).toBe(0);
    expect(store.watermarks).toEqual([]);
  });

  it("is idempotent across runs — a second pass sends nothing more", async () => {
    const store = new FakeStore({
      monitors: [monitor()],
      latest: { "npm/@scope/srv": { id: "run-9", resolved_version: "2.0.0", grade: "B" } },
      publishedVersions: ["npm/@scope/srv@2.0.0"],
    });
    const { sender, sent } = recordingSender();
    await runAlerts(store, { fetchLatestVersion: async () => "2.0.0", sender });
    await runAlerts(store, { fetchLatestVersion: async () => "2.0.0", sender });
    expect(sent).toHaveLength(1); // watermark advanced after the first run
  });

  it("does not double-send when a delivery is already claimed (unique-constraint conflict)", async () => {
    const store = new FakeStore({
      monitors: [monitor()],
      latest: { "npm/@scope/srv": { id: "run-9", resolved_version: "2.0.0", grade: "B" } },
      publishedVersions: ["npm/@scope/srv@2.0.0"],
      preclaimed: [{ monitorId: "m1", runId: "run-9" }],
    });
    const { sender, sent } = recordingSender();
    await runAlerts(store, { fetchLatestVersion: async () => "2.0.0", sender });
    expect(sent).toHaveLength(0); // claim returned null → skip send
    // watermark still advances so the monitor isn't reprocessed forever
    expect(store.watermarks).toEqual([{ monitorId: "m1", grade: { id: "run-9", resolved_version: "2.0.0", grade: "B" } }]);
  });

  it("marks the delivery failed and does NOT advance the watermark, so it retries next pass", async () => {
    const store = new FakeStore({
      monitors: [monitor()],
      latest: { "npm/@scope/srv": { id: "run-9", resolved_version: "2.0.0", grade: "D" } },
      publishedVersions: ["npm/@scope/srv@2.0.0"],
    });
    const failingSender: EmailSender = { send: vi.fn(async () => { throw new Error("smtp down"); }) };
    const result = await runAlerts(store, { fetchLatestVersion: async () => "2.0.0", sender: failingSender });
    expect(result.failed).toBe(1);
    expect(store.marks[0]).toMatchObject({ status: "failed" });
    // Watermark stays put on failure: next cron pass re-enters and
    // claim_or_retry_delivery resets the 'failed' row to 'pending' to retry.
    expect(store.watermarks).toHaveLength(0);
  });

  it("skips monitors with no email (future signed-in mode) without throwing", async () => {
    const store = new FakeStore({
      monitors: [monitor({ email: null })],
      latest: { "npm/@scope/srv": { id: "run-9", resolved_version: "2.0.0", grade: "A" } },
    });
    const { sender, sent } = recordingSender();
    const result = await runAlerts(store, { fetchLatestVersion: async () => "2.0.0", sender });
    expect(sent).toHaveLength(0);
    expect(result.skipped.some((s) => /no email/.test(s.reason))).toBe(true);
  });
});

describe("runAlerts — alert-grade threshold", () => {
  it("suppresses the email when the new grade is above the monitor's threshold", async () => {
    const store = new FakeStore({
      monitors: [monitor({ alert_min_grade: "D" })],
      latest: { "npm/@scope/srv": { id: "run-9", resolved_version: "2.0.0", grade: "B" } },
      publishedVersions: ["npm/@scope/srv@2.0.0"],
    });
    const { sender, sent } = recordingSender();
    const result = await runAlerts(store, { fetchLatestVersion: async () => "2.0.0", sender });
    expect(sent).toHaveLength(0);
    expect(result.sent).toBe(0);
    expect(result.notified).toBe(0);
    // Recorded as seen (dedup advances) but no delivery claimed, no display change.
    expect(store.seen).toEqual([{ monitorId: "m1", runId: "run-9" }]);
    expect(store.deliveries.size).toBe(0);
    expect(store.watermarks).toEqual([]);
    expect(result.skipped.some((s) => /below alert threshold/.test(s.reason))).toBe(true);
  });

  it("sends when the new grade meets the threshold (at the boundary)", async () => {
    const store = new FakeStore({
      monitors: [monitor({ alert_min_grade: "C" })],
      latest: { "npm/@scope/srv": { id: "run-9", resolved_version: "2.0.0", grade: "C" } },
      publishedVersions: ["npm/@scope/srv@2.0.0"],
    });
    const { sender, sent } = recordingSender();
    const result = await runAlerts(store, { fetchLatestVersion: async () => "2.0.0", sender });
    expect(sent).toHaveLength(1);
    expect(result.sent).toBe(1);
    expect(store.seen).toEqual([]); // send path doesn't use markSeen
  });

  it("does not reprocess a suppressed grade on the next run (dedup watermark advanced)", async () => {
    const store = new FakeStore({
      monitors: [monitor({ alert_min_grade: "F" })],
      latest: { "npm/@scope/srv": { id: "run-9", resolved_version: "2.0.0", grade: "C" } },
      publishedVersions: ["npm/@scope/srv@2.0.0"],
    });
    const { sender } = recordingSender();
    await runAlerts(store, { fetchLatestVersion: async () => "2.0.0", sender });
    await runAlerts(store, { fetchLatestVersion: async () => "2.0.0", sender });
    // First run marks it seen; the watermark match short-circuits the second run.
    expect(store.seen).toEqual([{ monitorId: "m1", runId: "run-9" }]);
  });

  it("a suppressed grade leaves the prior EMAILED grade intact for a later email", async () => {
    const store = new FakeStore({
      monitors: [
        monitor({ alert_min_grade: "D", last_notified_grade: "B", last_notified_run_id: "run-0" }),
      ],
      latest: { "npm/@scope/srv": { id: "run-1", resolved_version: "2.0.0", grade: "C" } },
      publishedVersions: ["npm/@scope/srv@2.0.0", "npm/@scope/srv@3.0.0"],
    });
    const { sender, sent } = recordingSender();

    // Run 1: C is above "D or worse" → suppressed; last_notified_grade stays "B".
    await runAlerts(store, { fetchLatestVersion: async () => "2.0.0", sender });
    expect(sent).toHaveLength(0);
    expect(store.monitors[0]!.last_notified_run_id).toBe("run-1");
    expect(store.monitors[0]!.last_notified_grade).toBe("B");

    // Run 2: a worse grade F crosses the threshold → email shows the last emailed grade.
    store.latest.set("npm/@scope/srv", { id: "run-2", resolved_version: "3.0.0", grade: "F" });
    await runAlerts(store, { fetchLatestVersion: async () => "3.0.0", sender });
    expect(sent).toHaveLength(1);
    expect(sent[0]!.email.subject).toContain("B → F");
  });
});

describe("buildAlertEmail", () => {
  it("renders a grade-change subject and a was→now line", () => {
    const e = buildAlertEmail({
      target: "npm/@scope/srv",
      version: "2.0.0",
      grade: "D",
      priorGrade: "A",
      unsubscribeToken: "tok-1",
    });
    expect(e.subject).toContain("A → D");
    expect(e.text).toContain("Grade: A → D");
  });

  it("renders a plain graded subject on the first alert (no prior grade)", () => {
    const e = buildAlertEmail({
      target: "npm/@scope/srv",
      version: "2.0.0",
      grade: "B",
      priorGrade: null,
      unsubscribeToken: "tok-1",
    });
    expect(e.subject).toContain("graded B");
    expect(e.text).toContain("Grade: B");
  });

  it("includes a fix link for non-A grades and omits it for A", () => {
    const nonA = buildAlertEmail({ target: "npm/x", version: "1", grade: "D", priorGrade: null, unsubscribeToken: "t" });
    expect(nonA.text).toMatch(/\/fix\?for=/);
    const a = buildAlertEmail({ target: "npm/x", version: "1", grade: "A", priorGrade: null, unsubscribeToken: "t" });
    expect(a.text).not.toMatch(/\/fix\?for=/);
  });

  it("always includes the one-click unsubscribe link with the token", () => {
    const e = buildAlertEmail({ target: "npm/x", version: "1", grade: "A", priorGrade: null, unsubscribeToken: "tok-xyz" });
    expect(e.text).toContain("/api/monitor/unsubscribe?token=tok-xyz");
    expect(e.html).toContain("/api/monitor/unsubscribe?token=tok-xyz");
  });

  it("uses the configured site origin", () => {
    const e = buildAlertEmail({
      target: "npm/x",
      version: "1",
      grade: "A",
      priorGrade: null,
      unsubscribeToken: "t",
      siteUrl: "https://staging.polygraph.so/",
    });
    expect(e.text).toContain("https://staging.polygraph.so/mcp/npm/x");
  });
});
