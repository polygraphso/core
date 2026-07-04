import { describe, it, expect } from "vitest";

import { isBlockedByRecentFailure } from "./gradeability";

const now = new Date("2026-07-04T12:00:00Z");

describe("isBlockedByRecentFailure", () => {
  it("blocks when the latest run failed within the cooldown", () => {
    const v = isBlockedByRecentFailure(
      { status: "failed", completed_at: "2026-07-03T23:00:00Z", failure_reason: "harness child failed (exit code 1)" },
      now,
    );
    expect(v.blocked).toBe(true);
    if (v.blocked) expect(v.reason).toContain("recently");
  });

  it("allows when the failure is older than the cooldown", () => {
    const v = isBlockedByRecentFailure(
      { status: "failed", completed_at: "2026-06-01T00:00:00Z", failure_reason: null },
      now,
    );
    expect(v.blocked).toBe(false);
  });

  it("allows when the latest run completed (a newer success supersedes old failures)", () => {
    const v = isBlockedByRecentFailure(
      { status: "complete", completed_at: "2026-07-04T01:00:00Z", failure_reason: null },
      now,
    );
    expect(v.blocked).toBe(false);
  });

  it("allows when the target has never been run", () => {
    expect(isBlockedByRecentFailure(null, now).blocked).toBe(false);
  });

  it("allows a failure with no completion timestamp (can't age it — fail open)", () => {
    const v = isBlockedByRecentFailure(
      { status: "failed", completed_at: null, failure_reason: "x" },
      now,
    );
    expect(v.blocked).toBe(false);
  });
});
