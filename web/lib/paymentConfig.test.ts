import { describe, expect, it } from "vitest";
import {
  MONTH_SECONDS,
  PLAN_PRICES_USD,
  PLAN_QUOTAS,
  YEAR_MONTHS,
  YEARLY_BILLED_MONTHS,
  billedMonths,
  paymentShapeTag,
  planShapeTag,
  termDurationSeconds,
} from "./paymentConfig";

describe("planShapeTag", () => {
  const uuid = "3f2a1b4c-5d6e-4f70-8a9b-0c1d2e3f4a5b";

  it("matches Node's base64url of the uuid bytes", () => {
    const hex = uuid.replace(/-/g, "");
    const expected = `pgu:${Buffer.from(hex, "hex").toString("base64url")}`;
    expect(planShapeTag(uuid)).toBe(expected);
  });

  it("fits Sablier's 32-byte shape cap", () => {
    // 4-char prefix + 22 base64url chars = 26 ASCII bytes.
    const tag = planShapeTag(uuid);
    expect(tag).toHaveLength(26);
    expect(new TextEncoder().encode(tag).length).toBeLessThanOrEqual(32);
  });

  it("is deterministic and distinct per user", () => {
    const other = "00000000-0000-4000-8000-000000000001";
    expect(planShapeTag(uuid)).toBe(planShapeTag(uuid));
    expect(planShapeTag(uuid)).not.toBe(planShapeTag(other));
  });

  it("never collides with the ecosystem namespace", () => {
    // pg:<slug> vs pgu:<b64> — the prefixes are disjoint by construction.
    expect(planShapeTag(uuid).startsWith("pgu:")).toBe(true);
    expect(paymentShapeTag("bankr").startsWith("pg:")).toBe(true);
    expect(paymentShapeTag("bankr").startsWith("pgu:")).toBe(false);
  });

  it("rejects a non-uuid", () => {
    expect(() => planShapeTag("not-a-uuid")).toThrow();
    expect(() => planShapeTag("")).toThrow();
  });
});

describe("billing terms", () => {
  it("maps terms to stream durations", () => {
    expect(termDurationSeconds("monthly")).toBe(MONTH_SECONDS);
    expect(termDurationSeconds("yearly")).toBe(YEAR_MONTHS * MONTH_SECONDS);
  });

  it("bills sub-year streams at the plain monthly rate", () => {
    expect(billedMonths(1)).toBe(1);
    expect(billedMonths(6)).toBe(6);
    // Deliberate discontinuity: no deal short of a full year. 11.5 months
    // bills 11.5 — more than a year's 10; the UI never creates this.
    expect(billedMonths(11.5)).toBe(11.5);
  });

  it("bills every full 12-month block as 10", () => {
    expect(billedMonths(12)).toBe(YEARLY_BILLED_MONTHS);
    expect(billedMonths(13)).toBe(YEARLY_BILLED_MONTHS + 1);
    expect(billedMonths(24)).toBe(2 * YEARLY_BILLED_MONTHS);
  });

  it("credits a block within the ~3-day slop under a 12-month multiple", () => {
    // Same tolerance philosophy as MIN_STREAM_SECONDS on the monthly check.
    expect(billedMonths(11.95)).toBe(YEARLY_BILLED_MONTHS);
    expect(billedMonths(23.95)).toBe(2 * YEARLY_BILLED_MONTHS);
    // Just past the slop: no block credited.
    expect(billedMonths(11.85)).toBe(11.85);
  });
});

describe("plan constants", () => {
  it("prices and quotas cover every plan", () => {
    expect(PLAN_QUOTAS.free).toBe(1);
    for (const plan of ["indie", "team"] as const) {
      expect(PLAN_PRICES_USD[plan]).toBeGreaterThan(0);
      // Quotas mirror record_monitor's CASE in 20260718120000_user_plans.sql.
      expect(PLAN_QUOTAS[plan]).toBeGreaterThan(PLAN_QUOTAS.free);
    }
    expect(PLAN_QUOTAS.indie).toBe(25);
    expect(PLAN_QUOTAS.team).toBe(100);
  });
});
