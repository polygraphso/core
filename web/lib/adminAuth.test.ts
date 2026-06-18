import { describe, it, expect, beforeEach } from "vitest";
import {
  signSession,
  verifySession,
  checkPassword,
  ADMIN_COOKIE,
  ADMIN_SESSION_TTL_SECONDS,
} from "@/lib/adminAuth";

const NOW = 1_700_000_000; // fixed reference instant (seconds)

beforeEach(() => {
  process.env.ADMIN_PASSWORD = "correct-horse-battery-staple";
});

describe("session cookie", () => {
  it("verifies a token it just signed", async () => {
    const token = await signSession(NOW);
    expect(token).toBeTruthy();
    expect(await verifySession(token!, NOW + 10)).toBe(true);
  });

  it("rejects an expired token", async () => {
    const token = await signSession(NOW);
    expect(
      await verifySession(token!, NOW + ADMIN_SESSION_TTL_SECONDS + 1),
    ).toBe(false);
  });

  it("accepts a token just inside the expiry boundary", async () => {
    const token = await signSession(NOW);
    expect(
      await verifySession(token!, NOW + ADMIN_SESSION_TTL_SECONDS - 1),
    ).toBe(true);
  });

  it("rejects a tampered signature", async () => {
    const token = await signSession(NOW);
    const tampered = token!.slice(0, -1) + (token!.endsWith("a") ? "b" : "a");
    expect(await verifySession(tampered, NOW + 10)).toBe(false);
  });

  it("rejects a token signed under a different password", async () => {
    const token = await signSession(NOW);
    process.env.ADMIN_PASSWORD = "a-different-secret";
    expect(await verifySession(token!, NOW + 10)).toBe(false);
  });

  it("rejects undefined / malformed tokens", async () => {
    expect(await verifySession(undefined, NOW)).toBe(false);
    expect(await verifySession("garbage", NOW)).toBe(false);
    expect(await verifySession("", NOW)).toBe(false);
  });

  it("returns null when no password is configured", async () => {
    delete process.env.ADMIN_PASSWORD;
    expect(await signSession(NOW)).toBeNull();
  });

  it("fails closed when ADMIN_PASSWORD is unset", async () => {
    delete process.env.ADMIN_PASSWORD;
    expect(await verifySession("anything.deadbeef", NOW)).toBe(false);
  });
});

describe("checkPassword", () => {
  it("accepts the correct password", async () => {
    expect(await checkPassword("correct-horse-battery-staple")).toBe(true);
  });
  it("rejects a wrong password", async () => {
    expect(await checkPassword("nope")).toBe(false);
  });
  it("rejects everything when unconfigured", async () => {
    delete process.env.ADMIN_PASSWORD;
    expect(await checkPassword("anything")).toBe(false);
  });
});

it("exports a cookie name", () => {
  expect(ADMIN_COOKIE).toBe("pg_admin");
});
