import { describe, it, expect, vi } from "vitest";
import { runAlerts, parseGithubTarget, type GithubTarget } from "./alerts.js";
import type {
  AlertStore,
  ClaimDeliveryInput,
  MonitorRecord,
  PublishedGrade,
} from "./store.js";
import { buildAlertEmail, buildDigestEmail } from "./email.js";
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
  enqueuedKinds: Array<{ target: string; kind: string }> = [];
  async enqueueMonitorRegrade(target: string, kind: "registry_ref" | "skill") {
    this.enqueued.push(target);
    this.enqueuedKinds.push({ target, kind });
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
    target_kind: "registry_ref",
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

  it("respects the enqueue cap", async () => {
    const monitors = ["a", "b", "c"].map((n) => monitor({ id: n, target: `npm/${n}` }));
    const store = new FakeStore({ monitors });
    const result = await runAlerts(store, { fetchLatestVersion: async () => "1.0.0", maxEnqueue: 2 });
    expect(result.enqueued).toBe(2);
    expect(store.enqueued).toHaveLength(2);
  });
});

describe("runAlerts — github commit stream (skills + github servers)", () => {
  // Seed the watermark to the current grade so pass 2 (reconcile) is a no-op and
  // these tests isolate the pass-1 commit-drift enqueue decision.
  it("enqueues a github SERVER regrade when the live commit moved past the graded one", async () => {
    const store = new FakeStore({
      monitors: [monitor({ target: "github/owner/repo", last_notified_run_id: "run-1" })],
      latest: { "github/owner/repo": { id: "run-1", resolved_version: "oldsha", grade: "A", commit_sha: "oldsha" } },
    });
    const result = await runAlerts(store, {
      fetchLatestCommit: async () => ({ sha: "newsha", committedAt: "2026-07-08T00:00:00Z" }),
    });
    expect(store.enqueuedKinds).toEqual([{ target: "github/owner/repo", kind: "registry_ref" }]);
    expect(result.enqueued).toBe(1);
  });

  it("does NOT enqueue when the live commit matches the graded commit_sha", async () => {
    const store = new FakeStore({
      monitors: [monitor({ target: "github/owner/repo", last_notified_run_id: "run-1" })],
      latest: { "github/owner/repo": { id: "run-1", resolved_version: "abc", grade: "A", commit_sha: "abc" } },
    });
    await runAlerts(store, { fetchLatestCommit: async () => ({ sha: "abc", committedAt: null }) });
    expect(store.enqueued).toEqual([]);
  });

  it("enqueues a SKILL regrade with kind 'skill', path-scoped to the skill subdir", async () => {
    const seen: GithubTarget[] = [];
    const store = new FakeStore({
      monitors: [monitor({ target: "github/BankrBot/skills#pay", target_kind: "skill", last_notified_run_id: "run-1" })],
      latest: { "github/BankrBot/skills#pay": { id: "run-1", resolved_version: "r", grade: "A", commit_sha: "old" } },
    });
    const result = await runAlerts(store, {
      fetchLatestCommit: async (gh) => {
        seen.push(gh);
        return { sha: "new", committedAt: null };
      },
    });
    expect(store.enqueuedKinds).toEqual([{ target: "github/BankrBot/skills#pay", kind: "skill" }]);
    expect(seen).toEqual([{ owner: "BankrBot", repo: "skills", subPath: "pay" }]);
    expect(result.enqueued).toBe(1);
  });

  it("self-heals a pre-anchor grade (null commit_sha) by enqueuing one baseline regrade", async () => {
    const store = new FakeStore({
      monitors: [monitor({ target: "github/owner/repo", last_notified_run_id: "run-1" })],
      latest: { "github/owner/repo": { id: "run-1", resolved_version: "x", grade: "A" } }, // no commit_sha
    });
    await runAlerts(store, { fetchLatestCommit: async () => ({ sha: "y", committedAt: null }) });
    expect(store.enqueued).toEqual(["github/owner/repo"]);
  });

  it("does NOT enqueue a github regrade already in flight", async () => {
    const store = new FakeStore({
      monitors: [monitor({ target: "github/owner/repo", last_notified_run_id: "run-1" })],
      latest: { "github/owner/repo": { id: "run-1", resolved_version: "old", grade: "A", commit_sha: "old" } },
      inFlight: ["github/owner/repo"],
    });
    await runAlerts(store, { fetchLatestCommit: async () => ({ sha: "new", committedAt: null }) });
    expect(store.enqueued).toEqual([]);
  });

  it("skips a github target whose commit stream returns nothing (deleted/empty repo)", async () => {
    const store = new FakeStore({ monitors: [monitor({ target: "github/owner/repo" })] });
    const result = await runAlerts(store, { fetchLatestCommit: async () => null });
    expect(store.enqueued).toEqual([]);
    expect(result.skipped.some((s) => /no commit/.test(s.reason))).toBe(true);
  });
});

describe("parseGithubTarget", () => {
  it("parses a whole-repo server ref (no subPath)", () => {
    expect(parseGithubTarget("github/owner/repo")).toEqual({ owner: "owner", repo: "repo", subPath: null });
  });
  it("parses a skill ref with a nested subPath", () => {
    expect(parseGithubTarget("github/BankrBot/skills#a/b/c")).toEqual({
      owner: "BankrBot",
      repo: "skills",
      subPath: "a/b/c",
    });
  });
  it("returns null for non-github targets", () => {
    expect(parseGithubTarget("npm/@scope/srv")).toBeNull();
    expect(parseGithubTarget("pypi/foo")).toBeNull();
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

describe("runAlerts — per-recipient batching", () => {
  it("sends ONE digest for two monitors sharing an email, covering both servers", async () => {
    const store = new FakeStore({
      monitors: [
        monitor({ id: "m1", target: "npm/@scope/a", email: "dev@example.com" }),
        monitor({ id: "m2", target: "npm/@scope/b", email: "dev@example.com" }),
      ],
      latest: {
        "npm/@scope/a": { id: "run-a", resolved_version: "1.0.0", grade: "D" },
        "npm/@scope/b": { id: "run-b", resolved_version: "2.0.0", grade: "B" },
      },
      publishedVersions: ["npm/@scope/a@1.0.0", "npm/@scope/b@2.0.0"],
    });
    const { sender, sent } = recordingSender();
    const result = await runAlerts(store, {
      fetchLatestVersion: async () => null, // enqueue pass is irrelevant here
      sender,
    });

    // Exactly one email, addressed once, mentioning both servers.
    expect(sent).toHaveLength(1);
    expect(sent[0]!.to).toBe("dev@example.com");
    expect(sent[0]!.email.text).toContain("npm/@scope/a");
    expect(sent[0]!.email.text).toContain("npm/@scope/b");
    expect(sent[0]!.email.subject).toBe("polygraph: 2 monitored servers regraded");

    // Both deliveries recorded sent and both watermarks advanced.
    expect(result.notified).toBe(2);
    expect(result.sent).toBe(2);
    expect(store.marks.map((m) => m.status)).toEqual(["sent", "sent"]);
    expect(store.watermarks.map((w) => w.monitorId).sort()).toEqual(["m1", "m2"]);
  });

  it("sends a separate email to each distinct recipient", async () => {
    const store = new FakeStore({
      monitors: [
        monitor({ id: "m1", target: "npm/@scope/a", email: "a@x.com" }),
        monitor({ id: "m2", target: "npm/@scope/b", email: "b@x.com" }),
      ],
      latest: {
        "npm/@scope/a": { id: "run-a", resolved_version: "1.0.0", grade: "D" },
        "npm/@scope/b": { id: "run-b", resolved_version: "2.0.0", grade: "B" },
      },
      publishedVersions: ["npm/@scope/a@1.0.0", "npm/@scope/b@2.0.0"],
    });
    const { sender, sent } = recordingSender();
    await runAlerts(store, { fetchLatestVersion: async () => null, sender });

    expect(sent).toHaveLength(2);
    expect(sent.map((s) => s.to).sort()).toEqual(["a@x.com", "b@x.com"]);
  });

  it("on a digest send failure, marks every delivery failed and advances no watermark", async () => {
    const store = new FakeStore({
      monitors: [
        monitor({ id: "m1", target: "npm/@scope/a", email: "dev@example.com" }),
        monitor({ id: "m2", target: "npm/@scope/b", email: "dev@example.com" }),
      ],
      latest: {
        "npm/@scope/a": { id: "run-a", resolved_version: "1.0.0", grade: "D" },
        "npm/@scope/b": { id: "run-b", resolved_version: "2.0.0", grade: "F" },
      },
      publishedVersions: ["npm/@scope/a@1.0.0", "npm/@scope/b@2.0.0"],
    });
    const failingSender: EmailSender = { send: vi.fn(async () => { throw new Error("smtp down"); }) };
    const result = await runAlerts(store, { fetchLatestVersion: async () => null, sender: failingSender });

    expect(result.failed).toBe(2);
    expect(store.marks.map((m) => m.status)).toEqual(["failed", "failed"]);
    // Watermarks stay put so the next cron pass retries the whole digest.
    expect(store.watermarks).toHaveLength(0);
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

  it("carries the one-click unsubscribe token in the List-Unsubscribe header", () => {
    const e = buildAlertEmail({ target: "npm/x", version: "1", grade: "A", priorGrade: null, unsubscribeToken: "tok-xyz" });
    expect(e.headers?.["List-Unsubscribe"]).toContain("/api/monitor/unsubscribe?token=tok-xyz");
    expect(e.headers?.["List-Unsubscribe-Post"]).toBe("List-Unsubscribe=One-Click");
  });

  it("links the body to the dashboard to manage monitors (no raw unsubscribe link in the body)", () => {
    const e = buildAlertEmail({ target: "npm/x", version: "1", grade: "A", priorGrade: null, unsubscribeToken: "tok-xyz" });
    expect(e.text).toContain("Manage your monitors: https://polygraph.so/dashboard");
    expect(e.html).toContain("https://polygraph.so/dashboard");
    // The token unsubscribe URL lives only in the header, not the visible body.
    expect(e.text).not.toContain("/api/monitor/unsubscribe?token=tok-xyz");
    expect(e.html).not.toContain("/api/monitor/unsubscribe?token=tok-xyz");
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
    expect(e.text).toContain("https://staging.polygraph.so/dashboard");
  });

  it("falls back to the default origin for a blank or malformed siteUrl (the empty-var bug)", () => {
    for (const siteUrl of ["", "   ", "not-a-url", "ftp://x"]) {
      const e = buildAlertEmail({ target: "npm/@polygraphso/litmus", version: "1", grade: "A", priorGrade: null, unsubscribeToken: "t", siteUrl });
      // Absolute https links — never a root-relative path that mail clients
      // "repair" into http://<first-segment>/…
      expect(e.text).toContain("https://polygraph.so/mcp/npm/@polygraphso/litmus");
      expect(e.text).toContain("https://polygraph.so/dashboard");
      expect(e.text).not.toContain("http://mcp/");
      expect(e.headers?.["List-Unsubscribe"]).toContain("https://polygraph.so/api/monitor/unsubscribe?token=t");
    }
  });
});

describe("buildDigestEmail", () => {
  it("summarizes multiple changes in one email with a report link per server", () => {
    const e = buildDigestEmail({
      changes: [
        { target: "npm/@scope/a", version: "1.0.0", grade: "D", priorGrade: "A", unsubscribeToken: "tok-a" },
        { target: "npm/@scope/b", version: "2.0.0", grade: "B", priorGrade: null, unsubscribeToken: "tok-b" },
      ],
    });
    expect(e.subject).toBe("polygraph: 2 monitored servers regraded");
    expect(e.text).toContain("https://polygraph.so/mcp/npm/@scope/a");
    expect(e.text).toContain("https://polygraph.so/mcp/npm/@scope/b");
    expect(e.text).toContain("Grade: A → D");
    expect(e.text).toContain("Grade: B");
    // One dashboard link, and every token present in the List-Unsubscribe header.
    expect(e.text).toContain("Manage your monitors: https://polygraph.so/dashboard");
    expect(e.headers?.["List-Unsubscribe"]).toContain("token=tok-a");
    expect(e.headers?.["List-Unsubscribe"]).toContain("token=tok-b");
  });

  it("renders a single change with the single-server subject (not the digest count)", () => {
    const e = buildDigestEmail({
      changes: [{ target: "npm/@scope/a", version: "1.0.0", grade: "D", priorGrade: "A", unsubscribeToken: "t" }],
    });
    expect(e.subject).toBe("@scope/a v1.0.0: grade A → D");
  });
});
