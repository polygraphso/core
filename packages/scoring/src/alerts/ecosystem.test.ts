import { describe, it, expect } from "vitest";
import { runEcosystemAlerts, isoWeek } from "./ecosystem.js";
import { buildEcosystemDigestEmail } from "./email.js";
import type { ComposedEmail, EmailSender } from "./email.js";
import type { PublishedGrade } from "./store.js";
import type {
  DigestEntry,
  EcosystemAlertSettings,
  EcosystemAlertStore,
  EcosystemRecipient,
  EntryAdvisory,
  EntryState,
  RecipientsMode,
} from "./ecosystemStore.js";

const WEEK = "2026-W28";

function settings(over: Partial<EcosystemAlertSettings> = {}): EcosystemAlertSettings {
  return {
    ecosystem_id: "eco-1",
    slug: "acme",
    name: "Acme",
    cve_enabled: true,
    cve_min_severity: "HIGH",
    grade_drop_enabled: true,
    new_version_enabled: true,
    frequency: "weekly",
    recipients_mode: "admins",
    last_digest_period: null,
    monthly_price_usd: null,
    ...over,
  };
}

interface FakeOpts {
  due: EcosystemAlertSettings[];
  entries?: Record<string, DigestEntry[]>;
  recipients?: Record<string, EcosystemRecipient[]>;
  advisories?: Record<string, EntryAdvisory[]>;
  grades?: Record<string, PublishedGrade>;
  states?: Record<string, EntryState>;
  /** Payment gate answer; defaults to paid so unrelated tests aren't skipped. */
  paid?: boolean;
}

class FakeEcosystemStore implements EcosystemAlertStore {
  claims = new Set<string>();
  marks: Array<{ id: string; status: string }> = [];
  advanced: Array<{ entryId: string; state: EntryState }> = [];
  touched: string[] = [];
  states: Record<string, EntryState>;
  grades: Record<string, PublishedGrade>;
  private seq = 0;

  constructor(private readonly o: FakeOpts) {
    this.states = { ...(o.states ?? {}) };
    this.grades = { ...(o.grades ?? {}) };
  }

  async dueEcosystems() {
    return this.o.due;
  }
  async hasActivePayment() {
    return this.o.paid ?? true;
  }
  async recipientsFor(ecosystemId: string, _mode: RecipientsMode) {
    return this.o.recipients?.[ecosystemId] ?? [];
  }
  async entriesFor(ecosystemId: string) {
    return this.o.entries?.[ecosystemId] ?? [];
  }
  async advisoriesForTargets(keys: string[]) {
    const m = new Map<string, EntryAdvisory[]>();
    for (const k of keys) if (this.o.advisories?.[k]) m.set(k, this.o.advisories[k]!);
    return m;
  }
  async latestPublishedGrade(target: string) {
    return this.grades[target] ?? null;
  }
  async entryState(entryId: string) {
    return this.states[entryId] ?? null;
  }
  async advanceEntryState(entryId: string, state: EntryState) {
    this.states[entryId] = state;
    this.advanced.push({ entryId, state });
  }
  async claimEcosystemDelivery(recipientId: string, periodKey: string) {
    const key = `${recipientId}|${periodKey}`;
    if (this.claims.has(key)) return null;
    this.claims.add(key);
    return `d${++this.seq}`;
  }
  async markEcosystemDelivery(id: string, status: "sent" | "failed") {
    this.marks.push({ id, status });
  }
  async touchDigestPeriod(ecosystemId: string) {
    this.touched.push(ecosystemId);
  }
}

function captureSender(): { sender: EmailSender; sent: Array<{ to: string; email: ComposedEmail }> } {
  const sent: Array<{ to: string; email: ComposedEmail }> = [];
  return {
    sent,
    sender: {
      async send(to, email) {
        sent.push({ to, email });
        return { id: `msg-${sent.length}` };
      },
    },
  };
}

const recip = (id: string, email: string): EcosystemRecipient => ({
  id,
  email,
  unsubscribe_token: `tok-${id}`,
});
const entry = (id: string, target: string, name = id): DigestEntry => ({
  id,
  target,
  target_kind: "registry_ref",
  name,
});

describe("isoWeek", () => {
  it("computes the ISO-8601 week key", () => {
    // 2026-01-01 is a Thursday → ISO week 1 of 2026.
    expect(isoWeek(new Date(Date.UTC(2026, 0, 1)))).toBe("2026-W01");
    // 2026-07-09 (the plan date) falls in ISO week 28.
    expect(isoWeek(new Date(Date.UTC(2026, 6, 9)))).toBe("2026-W28");
  });
});

describe("runEcosystemAlerts", () => {
  it("sends a CVE-only digest and dedups per (recipient, week)", async () => {
    const adv: EntryAdvisory = {
      ghsa: "GHSA-x",
      cveIds: ["CVE-2024-1"],
      severity: "HIGH",
      fixedVersion: "2.0.0",
      url: "https://example.com/x",
    };
    const store = new FakeEcosystemStore({
      due: [settings({ grade_drop_enabled: false, new_version_enabled: false })],
      entries: { "eco-1": [entry("e1", "npm/left-pad")] },
      advisories: { "npm/left-pad": [adv] },
      recipients: { "eco-1": [recip("r1", "admin@acme.com")] },
    });
    const { sender, sent } = captureSender();

    const result = await runEcosystemAlerts(store, { periodKey: WEEK, sender });
    expect(result.digestsSent).toBe(1);
    expect(sent[0]!.to).toBe("admin@acme.com");
    expect(sent[0]!.email.subject).toContain("1 CVE to fix");
    expect(store.touched).toContain("eco-1");

    // A second run in the same week claims nothing → no double send.
    const again = await runEcosystemAlerts(store, { periodKey: WEEK, sender });
    expect(again.digestsSent).toBe(0);
  });

  it("applies the CVE severity floor", async () => {
    const low: EntryAdvisory = { ghsa: "GHSA-l", cveIds: [], severity: "LOW", fixedVersion: null, url: null };
    const store = new FakeEcosystemStore({
      due: [settings({ cve_min_severity: "HIGH", grade_drop_enabled: false, new_version_enabled: false })],
      entries: { "eco-1": [entry("e1", "npm/left-pad")] },
      advisories: { "npm/left-pad": [low] },
      recipients: { "eco-1": [recip("r1", "a@acme.com")] },
    });
    const { sender, sent } = captureSender();
    const result = await runEcosystemAlerts(store, { periodKey: WEEK, sender });
    expect(result.digestsSent).toBe(0); // LOW < HIGH floor → nothing to send
    expect(sent).toHaveLength(0);
    expect(store.touched).toContain("eco-1"); // still closes the week
  });

  it("seeds a baseline on first sight and reports a drop the next week", async () => {
    const base = {
      due: [settings({ cve_enabled: false, new_version_enabled: false })],
      entries: { "eco-1": [entry("e1", "npm/left-pad", "left-pad")] },
      recipients: { "eco-1": [recip("r1", "a@acme.com")] },
      grades: { "npm/left-pad": { id: "run-1", resolved_version: "1.0.0", grade: "B" } as PublishedGrade },
    };
    const store = new FakeEcosystemStore(base);
    const { sender, sent } = captureSender();

    // Week 1: no prior state → baseline seeded, nothing to send.
    const w1 = await runEcosystemAlerts(store, { periodKey: "2026-W28", sender });
    expect(w1.digestsSent).toBe(0);
    expect(store.states["e1"]).toMatchObject({ last_seen_run_id: "run-1", last_seen_grade: "B" });

    // Week 2: the grade drops B → D on a new run → grade-drop digest.
    store.grades["npm/left-pad"] = { id: "run-2", resolved_version: "1.1.0", grade: "D" } as PublishedGrade;
    const w2 = await runEcosystemAlerts(store, { periodKey: "2026-W29", sender });
    expect(w2.digestsSent).toBe(1);
    expect(sent.at(-1)!.email.subject).toContain("grade drop");
    expect(store.states["e1"]).toMatchObject({ last_seen_run_id: "run-2", last_seen_grade: "D" });
  });

  it("skips an unpaid ecosystem without advancing its week", async () => {
    const adv: EntryAdvisory = { ghsa: "GHSA-x", cveIds: [], severity: "HIGH", fixedVersion: null, url: null };
    const store = new FakeEcosystemStore({
      due: [settings({ grade_drop_enabled: false, new_version_enabled: false })],
      entries: { "eco-1": [entry("e1", "npm/left-pad")] },
      advisories: { "npm/left-pad": [adv] },
      recipients: { "eco-1": [recip("r1", "a@acme.com")] },
      paid: false,
    });
    const { sender, sent } = captureSender();
    const result = await runEcosystemAlerts(store, { periodKey: WEEK, sender });
    expect(sent).toHaveLength(0);
    expect(result.processed).toBe(0);
    expect(result.skipped).toEqual([{ ecosystem: "acme", reason: "unpaid" }]);
    // Watermark untouched: paying mid-week resumes delivery this same week.
    expect(store.touched).toHaveLength(0);
  });

  it("a comped ecosystem (monthly_price_usd = 0) bypasses the payment gate", async () => {
    const adv: EntryAdvisory = { ghsa: "GHSA-x", cveIds: [], severity: "HIGH", fixedVersion: null, url: null };
    const store = new FakeEcosystemStore({
      due: [settings({ monthly_price_usd: 0, grade_drop_enabled: false, new_version_enabled: false })],
      entries: { "eco-1": [entry("e1", "npm/left-pad")] },
      advisories: { "npm/left-pad": [adv] },
      recipients: { "eco-1": [recip("r1", "a@acme.com")] },
      paid: false,
    });
    const { sender, sent } = captureSender();
    const result = await runEcosystemAlerts(store, { periodKey: WEEK, sender });
    expect(result.digestsSent).toBe(1);
    expect(sent[0]!.to).toBe("a@acme.com");
  });

  it("skips an ecosystem with nothing to report", async () => {
    const store = new FakeEcosystemStore({
      due: [settings({ cve_enabled: false, grade_drop_enabled: false, new_version_enabled: false })],
      entries: { "eco-1": [entry("e1", "npm/left-pad")] },
      recipients: { "eco-1": [recip("r1", "a@acme.com")] },
      grades: { "npm/left-pad": { id: "run-1", resolved_version: "1.0.0", grade: "A" } as PublishedGrade },
    });
    const { sender, sent } = captureSender();
    const result = await runEcosystemAlerts(store, { periodKey: WEEK, sender });
    expect(sent).toHaveLength(0);
    expect(result.digestsSent).toBe(0);
    expect(store.touched).toContain("eco-1");
  });

  it("dry-run composes and 'sends' but writes nothing to the store", async () => {
    const adv: EntryAdvisory = { ghsa: "GHSA-x", cveIds: [], severity: "HIGH", fixedVersion: null, url: null };
    const store = new FakeEcosystemStore({
      due: [settings({ grade_drop_enabled: false, new_version_enabled: false })],
      entries: { "eco-1": [entry("e1", "npm/left-pad")] },
      advisories: { "npm/left-pad": [adv] },
      recipients: { "eco-1": [recip("r1", "a@acme.com")] },
    });
    const { sender, sent } = captureSender();
    const result = await runEcosystemAlerts(store, { periodKey: WEEK, sender, dryRun: true });
    expect(result.digestsSent).toBe(1);
    expect(sent).toHaveLength(1);
    expect(store.claims.size).toBe(0);
    expect(store.marks).toHaveLength(0);
    expect(store.advanced).toHaveLength(0);
    expect(store.touched).toHaveLength(0);
  });

  it("test override sends to one address, bypassing claim and state", async () => {
    const adv: EntryAdvisory = { ghsa: "GHSA-x", cveIds: [], severity: "CRITICAL", fixedVersion: "9.9", url: null };
    const store = new FakeEcosystemStore({
      due: [settings({ grade_drop_enabled: false, new_version_enabled: false })],
      entries: { "eco-1": [entry("e1", "npm/left-pad")] },
      advisories: { "npm/left-pad": [adv] },
      recipients: { "eco-1": [recip("r1", "real@acme.com")] },
    });
    const { sender, sent } = captureSender();
    const result = await runEcosystemAlerts(store, {
      periodKey: WEEK,
      sender,
      overrideRecipient: "test@me.com",
    });
    expect(result.digestsSent).toBe(1);
    expect(sent[0]!.to).toBe("test@me.com");
    expect(store.claims.size).toBe(0); // no claim
    expect(store.touched).toHaveLength(0); // no state mutation
  });
});

describe("buildEcosystemDigestEmail", () => {
  it("renders the three sections and the unsubscribe header", () => {
    const email = buildEcosystemDigestEmail({
      ecosystemName: "Acme",
      ecosystemSlug: "acme",
      cveItems: [
        {
          target: "npm/left-pad",
          name: "left-pad",
          advisories: [{ ghsa: "GHSA-x", cveIds: ["CVE-2024-1"], severity: "HIGH", fixedVersion: "2.0.0", url: "https://e/x" }],
        },
      ],
      gradeDrops: [{ target: "npm/foo", name: "foo", grade: "D", priorGrade: "B", version: "1.2.0" }],
      newVersions: [{ target: "npm/bar", name: "bar", grade: "A", priorGrade: "A", version: "3.0.0" }],
      unsubscribeToken: "tok-1",
      siteUrl: "https://polygraph.so",
    });
    expect(email.subject).toBe("polygraph · Acme: 1 CVE to fix, 1 grade drop, 1 regrade");
    expect(email.html).toContain("CVEs to fix");
    expect(email.html).toContain("GHSA-x");
    expect(email.html).toContain("Grade drops");
    expect(email.html).toContain("New-version regrades");
    expect(email.headers?.["List-Unsubscribe"]).toBe(
      "<https://polygraph.so/api/ecosystem-alert/unsubscribe?token=tok-1>",
    );
    expect(email.text).toContain("CVEs TO FIX");
  });

  it("throws when there is nothing to report", () => {
    expect(() =>
      buildEcosystemDigestEmail({
        ecosystemName: "Acme",
        ecosystemSlug: "acme",
        cveItems: [],
        gradeDrops: [],
        newVersions: [],
        unsubscribeToken: "t",
      }),
    ).toThrow(/nothing to report/);
  });
});
