# Admin Dashboard Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a password-gated internal admin dashboard at `/admin` that surfaces demand & funnel metrics read server-side from existing Supabase tables.

**Architecture:** A new route group `web/app/admin/` in the existing Next.js 16 app. A signed HTTP-only cookie (HMAC-SHA256 via Web Crypto, so it verifies in Edge middleware) gates everything under `/admin`. Panels are server-rendered from `getSupabaseAdmin()` reads of `waitlist_signups`, `grade_requests`, `notify_requests`, and `untracked_demand`. Pure aggregation helpers are unit-tested with vitest; charts are inline SVG with zero new runtime deps.

**Tech Stack:** Next.js 16.2.6 (App Router, React 19), Tailwind v4, `@supabase/supabase-js`, Web Crypto API, vitest (new dev dependency for `web`).

---

## Design reference

Spec: `docs/superpowers/specs/2026-06-18-admin-dashboard-design.md`.

Brand tokens already defined in `web/app/globals.css` (`@theme inline`) — use these Tailwind classes, do not invent colors: `bg-parchment` / `bg-parchment-50`, `text-ink` / `text-ink-muted` / `text-ink-faint`, `text-oxblood`, `border-rule`, `font-mono`, plus utility classes `.section-label`, `.tabular`, `.hairline`. Fonts: `font-serif`, `font-sans`, `font-mono`.

## File structure

| File | Responsibility |
|---|---|
| `web/lib/adminAuth.ts` (new) | Sign/verify session cookie + constant-time password check. Web Crypto only — Edge-safe. |
| `web/lib/adminAggregate.ts` (new) | **Pure** transforms: day-bucketing, tally/breakdown. No imports → unit-testable in isolation. |
| `web/lib/adminMetrics.ts` (new) | Thin Supabase fetchers, one per panel, returning typed shapes. Imports `adminAggregate` + `supabase`. |
| `web/middleware.ts` (new) | Gate `/admin/:path*`; allow `/admin/login` through. |
| `web/app/api/admin/login/route.ts` (new) | POST: verify password (rate-limited), set cookie, redirect. |
| `web/app/api/admin/logout/route.ts` (new) | POST: clear cookie, redirect to login. |
| `web/app/admin/login/page.tsx` (new) | Branded login form (plain HTML form POST). |
| `web/app/admin/page.tsx` (new) | Dashboard shell: fetch all metrics in parallel, render panels. |
| `web/app/admin/_components/ui.tsx` (new) | Presentational: `Panel`, `KpiCard`, `MiniBars`, `BarList`, `Stat`. |
| `web/vitest.config.ts` (new) | vitest config with `@` path alias. |
| `web/package.json` (edit) | Add `vitest` dev dep + `test` / `typecheck` scripts. |
| `web/lib/adminAuth.test.ts` (new) | Tests for sign/verify/password. |
| `web/lib/adminAggregate.test.ts` (new) | Tests for pure transforms. |
| `.env.example` (edit) | Add `ADMIN_PASSWORD`. |

**Accepted trade-off:** admin pages inherit the root layout's `SiteHeader`/`Footer` (the marketing chrome). This is an internal tool; refactoring the marketing site into a route group to hide chrome is out of scope (YAGNI).

---

## Task 1: Project scaffolding (test runner, env, scripts)

**Files:**
- Modify: `web/package.json`
- Create: `web/vitest.config.ts`
- Modify: `.env.example`

- [ ] **Step 1: Add vitest dev dep + scripts to `web/package.json`**

In `web/package.json`, add to `scripts`:

```json
    "test": "vitest run",
    "typecheck": "tsc --noEmit"
```

And add to `devDependencies` (keep alphabetical-ish, matching `packages/core`'s version):

```json
    "vitest": "^2.1.0"
```

- [ ] **Step 2: Create `web/vitest.config.ts`**

```ts
import { defineConfig } from "vitest/config";
import { fileURLToPath } from "node:url";

// Mirrors the `@/*` alias from tsconfig so tests can import `@/lib/...`.
export default defineConfig({
  resolve: {
    alias: { "@": fileURLToPath(new URL("./", import.meta.url)) },
  },
  test: { environment: "node" },
});
```

- [ ] **Step 3: Add `ADMIN_PASSWORD` to `.env.example`**

Append to `.env.example`:

```bash

# Admin dashboard — the single shared password for /admin. Server-only;
# never add a NEXT_PUBLIC_ prefix. Share the value with whoever should have
# access. Pick something long and random (e.g. `openssl rand -base64 24`).
ADMIN_PASSWORD=
```

- [ ] **Step 4: Install deps**

Run (from repo root): `pnpm install`
Expected: completes; `web` now has `vitest` available.

- [ ] **Step 5: Verify the test runner is wired**

Run: `cd web && pnpm exec vitest run`
Expected: exits 0 with "No test files found" (no tests yet) — confirms vitest resolves.

- [ ] **Step 6: Commit**

```bash
git add web/package.json web/vitest.config.ts pnpm-lock.yaml .env.example
git commit -m "chore(web): add vitest + ADMIN_PASSWORD env for admin dashboard"
```

---

## Task 2: Auth module (`adminAuth.ts`)

Web Crypto only (no `node:crypto`) so the same verify path runs in Edge middleware and Node route handlers. `nowSeconds` is injected for deterministic tests.

**Files:**
- Create: `web/lib/adminAuth.ts`
- Test: `web/lib/adminAuth.test.ts`

- [ ] **Step 1: Write the failing tests**

`web/lib/adminAuth.test.ts`:

```ts
import { describe, it, expect, beforeEach } from "vitest";
import {
  signSession,
  verifySession,
  checkPassword,
  ADMIN_COOKIE,
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
    // TTL is 30 days; jump just past it.
    expect(await verifySession(token!, NOW + 60 * 60 * 24 * 30 + 1)).toBe(false);
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
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `cd web && pnpm exec vitest run lib/adminAuth.test.ts`
Expected: FAIL — cannot resolve `@/lib/adminAuth`.

- [ ] **Step 3: Implement `web/lib/adminAuth.ts`**

```ts
/**
 * Admin-dashboard auth: a signed session cookie + constant-time password
 * check. Uses the Web Crypto API exclusively (no node:crypto) so the verify
 * path runs unchanged in Edge middleware AND Node route handlers.
 *
 * The cookie never contains the password. Token format:
 *   `${expiresAt}.${hmac}`  where hmac = HMAC-SHA256("v1.${expiresAt}", ADMIN_PASSWORD)
 * Verifying recomputes the HMAC and constant-time-compares.
 *
 * NEVER import this from a client component — it reads ADMIN_PASSWORD.
 */

export const ADMIN_COOKIE = "pg_admin";
export const ADMIN_SESSION_TTL_SECONDS = 60 * 60 * 24 * 30; // 30 days

const encoder = new TextEncoder();

function getSecret(): string | null {
  return process.env.ADMIN_PASSWORD || null;
}

function toHex(buf: ArrayBuffer): string {
  return Array.from(new Uint8Array(buf))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

async function hmacHex(message: string, secret: string): Promise<string> {
  const key = await crypto.subtle.importKey(
    "raw",
    encoder.encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const sig = await crypto.subtle.sign("HMAC", key, encoder.encode(message));
  return toHex(sig);
}

/** Constant-time compare of two equal-length hex strings. */
function timingSafeEqualHex(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let mismatch = 0;
  for (let i = 0; i < a.length; i++) {
    mismatch |= a.charCodeAt(i) ^ b.charCodeAt(i);
  }
  return mismatch === 0;
}

/** Produce a signed token, or null if ADMIN_PASSWORD is unset. */
export async function signSession(nowSeconds: number): Promise<string | null> {
  const secret = getSecret();
  if (!secret) return null;
  const expiresAt = nowSeconds + ADMIN_SESSION_TTL_SECONDS;
  const sig = await hmacHex(`v1.${expiresAt}`, secret);
  return `${expiresAt}.${sig}`;
}

/** True iff `token` is well-formed, unexpired, and validly signed. */
export async function verifySession(
  token: string | undefined,
  nowSeconds: number,
): Promise<boolean> {
  const secret = getSecret();
  if (!secret || !token) return false;
  const dot = token.indexOf(".");
  if (dot <= 0) return false;
  const expiresAtStr = token.slice(0, dot);
  const sig = token.slice(dot + 1);
  const expiresAt = Number(expiresAtStr);
  if (!Number.isFinite(expiresAt) || expiresAt <= nowSeconds) return false;
  const expected = await hmacHex(`v1.${expiresAtStr}`, secret);
  return timingSafeEqualHex(sig, expected);
}

/** Constant-time check of a submitted password against ADMIN_PASSWORD. */
export async function checkPassword(input: string): Promise<boolean> {
  const secret = getSecret();
  if (!secret) return false;
  // Hash both sides to fixed-length digests so the compare is length-blind.
  const a = await hmacHex(input, "pg-pw-compare");
  const b = await hmacHex(secret, "pg-pw-compare");
  return timingSafeEqualHex(a, b);
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `cd web && pnpm exec vitest run lib/adminAuth.test.ts`
Expected: PASS — all cases green.

- [ ] **Step 5: Commit**

```bash
git add web/lib/adminAuth.ts web/lib/adminAuth.test.ts
git commit -m "feat(web): signed admin session cookie + password check (Web Crypto)"
```

---

## Task 3: Middleware gate

**Files:**
- Create: `web/middleware.ts`

> Next.js note: this Next version may diverge from training-data conventions (`web/AGENTS.md`). The `matcher` + `NextRequest.cookies.get(...)` + `NextResponse.redirect` APIs below are stable across Next 13–16; if anything mismatches, consult `web/node_modules/next/dist/docs/`. Middleware runs on the Edge runtime — `adminAuth` is Edge-safe by design (Web Crypto only).

- [ ] **Step 1: Implement `web/middleware.ts`**

```ts
import { NextResponse, type NextRequest } from "next/server";
import { verifySession, ADMIN_COOKIE } from "@/lib/adminAuth";

// Only run on /admin/* page routes. The auth API routes live under
// /api/admin/* and are intentionally NOT matched here, so login/logout
// stay reachable while unauthenticated.
export const config = { matcher: ["/admin/:path*"] };

export async function middleware(request: NextRequest) {
  // The login page itself must be reachable without a session.
  if (request.nextUrl.pathname === "/admin/login") {
    return NextResponse.next();
  }

  const token = request.cookies.get(ADMIN_COOKIE)?.value;
  const ok = await verifySession(token, Math.floor(Date.now() / 1000));
  if (ok) return NextResponse.next();

  const url = request.nextUrl.clone();
  url.pathname = "/admin/login";
  url.search = "";
  return NextResponse.redirect(url);
}
```

- [ ] **Step 2: Manual smoke (deferred to Task 10)**

No automated test for middleware here — it's verified end-to-end in Task 10 (unauthenticated `/admin` redirects to `/admin/login`). Note this in the commit.

- [ ] **Step 3: Commit**

```bash
git add web/middleware.ts
git commit -m "feat(web): gate /admin behind signed-session middleware"
```

---

## Task 4: Login & logout API routes

Plain HTML-form POSTs (no client JS). On success the login route sets the cookie and 303-redirects to `/admin`; on failure it redirects back to `/admin/login?error=...`.

**Files:**
- Create: `web/app/api/admin/login/route.ts`
- Create: `web/app/api/admin/logout/route.ts`

- [ ] **Step 1: Implement `web/app/api/admin/login/route.ts`**

```ts
/**
 * POST /api/admin/login — verify the shared admin password (rate-limited),
 * set the signed session cookie, redirect to /admin. Failures redirect back
 * to the login page with a generic error (never reveals which part failed).
 *
 * Accepts an HTML form POST (application/x-www-form-urlencoded): field `password`.
 */
import { NextResponse } from "next/server";
import {
  signSession,
  checkPassword,
  ADMIN_COOKIE,
  ADMIN_SESSION_TTL_SECONDS,
} from "@/lib/adminAuth";
import { enforceRateLimit } from "@/lib/rateLimit";

function redirect(request: Request, to: string, status = 303) {
  return NextResponse.redirect(new URL(to, request.url), status);
}

export async function POST(request: Request) {
  // Throttle brute-force attempts per IP.
  const limited = await enforceRateLimit(request, "admin-login", {
    max: 5,
    windowSeconds: 60,
  });
  if (limited) return redirect(request, "/admin/login?error=rate");

  let password = "";
  try {
    const form = await request.formData();
    const raw = form.get("password");
    password = typeof raw === "string" ? raw : "";
  } catch {
    return redirect(request, "/admin/login?error=1");
  }

  if (!password || !(await checkPassword(password))) {
    return redirect(request, "/admin/login?error=1");
  }

  const token = await signSession(Math.floor(Date.now() / 1000));
  if (!token) {
    // ADMIN_PASSWORD unset on the server — can't issue a session.
    return redirect(request, "/admin/login?error=config");
  }

  const res = redirect(request, "/admin");
  res.cookies.set(ADMIN_COOKIE, token, {
    httpOnly: true,
    secure: true,
    sameSite: "lax",
    path: "/",
    maxAge: ADMIN_SESSION_TTL_SECONDS,
  });
  return res;
}
```

- [ ] **Step 2: Implement `web/app/api/admin/logout/route.ts`**

```ts
/** POST /api/admin/logout — clear the session cookie, return to login. */
import { NextResponse } from "next/server";
import { ADMIN_COOKIE } from "@/lib/adminAuth";

export async function POST(request: Request) {
  const res = NextResponse.redirect(new URL("/admin/login", request.url), 303);
  res.cookies.set(ADMIN_COOKIE, "", {
    httpOnly: true,
    secure: true,
    sameSite: "lax",
    path: "/",
    maxAge: 0,
  });
  return res;
}
```

- [ ] **Step 3: Typecheck**

Run: `cd web && pnpm exec tsc --noEmit`
Expected: PASS (no type errors).

- [ ] **Step 4: Commit**

```bash
git add web/app/api/admin/login/route.ts web/app/api/admin/logout/route.ts
git commit -m "feat(web): admin login/logout routes with rate-limited password check"
```

---

## Task 5: Login page

**Files:**
- Create: `web/app/admin/login/page.tsx`

- [ ] **Step 1: Implement `web/app/admin/login/page.tsx`**

```tsx
import type { Metadata } from "next";

export const metadata: Metadata = { title: "Admin", robots: { index: false } };

const ERRORS: Record<string, string> = {
  "1": "Incorrect password.",
  rate: "Too many attempts. Wait a minute and try again.",
  config: "Admin password is not configured on the server.",
};

export default async function AdminLoginPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const { error } = await searchParams;
  const message = error ? ERRORS[error] ?? "Could not sign in." : null;

  return (
    <main className="flex-1 flex items-center justify-center px-6 py-24">
      <div className="w-full max-w-sm">
        <p className="section-label mb-3">Restricted</p>
        <h1 className="font-serif text-2xl text-ink mb-1">Admin access</h1>
        <p className="text-sm text-ink-muted mb-6">
          Enter the shared password to view usage metrics.
        </p>

        <form method="post" action="/api/admin/login" className="space-y-4">
          <div>
            <label
              htmlFor="password"
              className="section-label block mb-2"
            >
              Password
            </label>
            <input
              id="password"
              name="password"
              type="password"
              autoComplete="current-password"
              autoFocus
              required
              className="w-full rounded-sm border border-rule bg-parchment-50 px-3 py-2 font-mono text-sm text-ink outline-none focus:border-oxblood"
            />
          </div>

          {message && (
            <p className="text-sm text-oxblood" role="alert">
              {message}
            </p>
          )}

          <button
            type="submit"
            className="w-full rounded-sm bg-ink px-4 py-2 font-mono text-sm text-parchment hover:bg-oxblood transition-colors"
          >
            Sign in
          </button>
        </form>
      </div>
    </main>
  );
}
```

- [ ] **Step 2: Typecheck**

Run: `cd web && pnpm exec tsc --noEmit`
Expected: PASS.

- [ ] **Step 3: Commit**

```bash
git add web/app/admin/login/page.tsx
git commit -m "feat(web): branded admin login page"
```

---

## Task 6: Pure aggregation helpers (`adminAggregate.ts`)

Pure functions, no imports, so they unit-test cleanly and the DB fetchers stay thin.

**Files:**
- Create: `web/lib/adminAggregate.ts`
- Test: `web/lib/adminAggregate.test.ts`

- [ ] **Step 1: Write the failing tests**

`web/lib/adminAggregate.test.ts`:

```ts
import { describe, it, expect } from "vitest";
import { bucketByDay, tally, type DayBucket } from "@/lib/adminAggregate";

describe("bucketByDay", () => {
  // Reference "today" = 2026-06-18 (UTC).
  const today = new Date("2026-06-18T12:00:00Z");

  it("returns one ascending bucket per day, including empty days", () => {
    const out = bucketByDay([], 7, today);
    expect(out).toHaveLength(7);
    expect(out[0].date).toBe("2026-06-12");
    expect(out[6].date).toBe("2026-06-18");
    expect(out.every((b: DayBucket) => b.count === 0)).toBe(true);
  });

  it("counts timestamps into their UTC day", () => {
    const out = bucketByDay(
      [
        "2026-06-18T00:01:00Z",
        "2026-06-18T23:59:00Z",
        "2026-06-17T10:00:00Z",
      ],
      7,
      today,
    );
    expect(out.find((b) => b.date === "2026-06-18")!.count).toBe(2);
    expect(out.find((b) => b.date === "2026-06-17")!.count).toBe(1);
  });

  it("ignores timestamps outside the window", () => {
    const out = bucketByDay(["2026-01-01T00:00:00Z"], 7, today);
    expect(out.reduce((s, b) => s + b.count, 0)).toBe(0);
  });

  it("ignores null/invalid timestamps without throwing", () => {
    const out = bucketByDay(
      [null, undefined, "not-a-date", "2026-06-18T00:00:00Z"] as (string | null)[],
      7,
      today,
    );
    expect(out.find((b) => b.date === "2026-06-18")!.count).toBe(1);
  });
});

describe("tally", () => {
  it("counts and sorts descending", () => {
    const out = tally(["a", "b", "a", "a", "b", "c"]);
    expect(out).toEqual([
      { key: "a", count: 3 },
      { key: "b", count: 2 },
      { key: "c", count: 1 },
    ]);
  });

  it("maps null/empty to a placeholder label", () => {
    const out = tally(["x", null, "", "x"], "—");
    expect(out).toContainEqual({ key: "x", count: 2 });
    expect(out).toContainEqual({ key: "—", count: 2 });
  });

  it("respects an optional limit", () => {
    const out = tally(["a", "a", "b", "c", "d"], "—", 2);
    expect(out).toHaveLength(2);
    expect(out[0]).toEqual({ key: "a", count: 2 });
  });

  it("returns [] for empty input", () => {
    expect(tally([])).toEqual([]);
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `cd web && pnpm exec vitest run lib/adminAggregate.test.ts`
Expected: FAIL — cannot resolve `@/lib/adminAggregate`.

- [ ] **Step 3: Implement `web/lib/adminAggregate.ts`**

```ts
/**
 * Pure aggregation helpers for the admin dashboard. No I/O, no imports — the
 * Supabase fetchers in adminMetrics.ts call these so all the date/grouping
 * logic is unit-tested in isolation. All day bucketing is UTC to avoid
 * timezone-dependent flakiness.
 */

export interface DayBucket {
  date: string; // YYYY-MM-DD (UTC)
  count: number;
}

export interface Bucket {
  key: string;
  count: number;
}

function utcDayKey(d: Date): string {
  return d.toISOString().slice(0, 10);
}

/**
 * Group ISO timestamps into the last `days` UTC days ending on `today`
 * (inclusive). Always returns exactly `days` ascending buckets, zero-filled.
 * Null / unparseable / out-of-window timestamps are ignored.
 */
export function bucketByDay(
  timestamps: ReadonlyArray<string | null | undefined>,
  days: number,
  today: Date,
): DayBucket[] {
  const buckets: DayBucket[] = [];
  const index = new Map<string, number>();
  // Build the zero-filled window, oldest first.
  for (let i = days - 1; i >= 0; i--) {
    const d = new Date(today);
    d.setUTCDate(d.getUTCDate() - i);
    const key = utcDayKey(d);
    index.set(key, buckets.length);
    buckets.push({ date: key, count: 0 });
  }
  for (const ts of timestamps) {
    if (!ts) continue;
    const d = new Date(ts);
    if (Number.isNaN(d.getTime())) continue;
    const slot = index.get(utcDayKey(d));
    if (slot !== undefined) buckets[slot].count += 1;
  }
  return buckets;
}

/**
 * Count occurrences of each value, sorted descending by count. Null/empty
 * values fold into `nullLabel`. Optional `limit` truncates to the top N.
 */
export function tally(
  values: ReadonlyArray<string | null | undefined>,
  nullLabel = "—",
  limit?: number,
): Bucket[] {
  const counts = new Map<string, number>();
  for (const v of values) {
    const key = v && v.length > 0 ? v : nullLabel;
    counts.set(key, (counts.get(key) ?? 0) + 1);
  }
  const out = Array.from(counts, ([key, count]) => ({ key, count })).sort(
    (a, b) => b.count - a.count,
  );
  return limit ? out.slice(0, limit) : out;
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `cd web && pnpm exec vitest run lib/adminAggregate.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add web/lib/adminAggregate.ts web/lib/adminAggregate.test.ts
git commit -m "feat(web): pure day-bucket + tally helpers for admin metrics"
```

---

## Task 7: Supabase metric fetchers (`adminMetrics.ts`)

Thin fetchers, one per panel. Each guards on `getSupabaseAdmin()` returning null and catches errors → returns `null` so the panel degrades to an empty state. Pre-traction volumes are small, so full-table selects are fine.

**Files:**
- Create: `web/lib/adminMetrics.ts`

- [ ] **Step 1: Implement `web/lib/adminMetrics.ts`**

```ts
import "server-only";
import { getSupabaseAdmin } from "@/lib/supabase";
import { bucketByDay, tally, type DayBucket, type Bucket } from "@/lib/adminAggregate";

const WINDOW_DAYS = 30;

export interface Topline {
  waitlist: number;
  gradeRequests: number;
  gradeQueued: number;
  notify: number;
  notifyUnfulfilled: number;
  untrackedServers: number;
}

export interface WaitlistMetrics {
  perDay: DayBucket[];
  byRole: Bucket[];
  bySource: Bucket[];
  recent: { email: string; role: string | null; source: string | null; first_seen_at: string }[];
}

export interface GradeRequestMetrics {
  perDay: DayBucket[];
  byStatus: Bucket[];
  demand: Bucket[]; // targets ranked by distinct requester rows
  recent: { target: string; target_kind: string; status: string; requested_at: string }[];
}

export interface NotifyMetrics {
  perDay: DayBucket[];
  topServers: Bucket[];
  fulfilled: number;
  unfulfilled: number;
}

export interface UntrackedRow {
  server_ref: string;
  request_count: number;
  first_seen_at: string;
  last_seen_at: string;
}

async function countOf(
  table: string,
  refine?: (q: ReturnType<NonNullable<ReturnType<typeof getSupabaseAdmin>>["from"]>["select"] extends never ? never : any) => any,
): Promise<number> {
  const db = getSupabaseAdmin();
  if (!db) return 0;
  let q = db.from(table).select("*", { count: "exact", head: true });
  if (refine) q = refine(q);
  const { count, error } = await q;
  if (error) {
    console.error(`[admin] count ${table} failed:`, error.message);
    return 0;
  }
  return count ?? 0;
}

export async function getTopline(): Promise<Topline> {
  const [waitlist, gradeRequests, gradeQueued, notify, notifyUnfulfilled, untrackedServers] =
    await Promise.all([
      countOf("waitlist_signups"),
      countOf("grade_requests"),
      countOf("grade_requests", (q) => q.eq("status", "queued")),
      countOf("notify_requests"),
      countOf("notify_requests", (q) => q.is("fulfilled_at", null)),
      countOf("untracked_demand"),
    ]);
  return { waitlist, gradeRequests, gradeQueued, notify, notifyUnfulfilled, untrackedServers };
}

const today = () => new Date();

export async function getWaitlistMetrics(): Promise<WaitlistMetrics | null> {
  const db = getSupabaseAdmin();
  if (!db) return null;
  const { data, error } = await db
    .from("waitlist_signups")
    .select("email, role, source, first_seen_at")
    .order("first_seen_at", { ascending: false });
  if (error) {
    console.error("[admin] waitlist fetch failed:", error.message);
    return null;
  }
  const rows = data ?? [];
  return {
    perDay: bucketByDay(rows.map((r) => r.first_seen_at as string), WINDOW_DAYS, today()),
    byRole: tally(rows.map((r) => r.role as string | null)),
    bySource: tally(rows.map((r) => r.source as string | null)),
    recent: rows.slice(0, 12) as WaitlistMetrics["recent"],
  };
}

export async function getGradeRequestMetrics(): Promise<GradeRequestMetrics | null> {
  const db = getSupabaseAdmin();
  if (!db) return null;
  const { data, error } = await db
    .from("grade_requests")
    .select("target, target_kind, status, requested_at")
    .order("requested_at", { ascending: false });
  if (error) {
    console.error("[admin] grade_requests fetch failed:", error.message);
    return null;
  }
  const rows = data ?? [];
  return {
    perDay: bucketByDay(rows.map((r) => r.requested_at as string), WINDOW_DAYS, today()),
    byStatus: tally(rows.map((r) => r.status as string)),
    demand: tally(rows.map((r) => r.target as string), "—", 10),
    recent: rows.slice(0, 12) as GradeRequestMetrics["recent"],
  };
}

export async function getNotifyMetrics(): Promise<NotifyMetrics | null> {
  const db = getSupabaseAdmin();
  if (!db) return null;
  const { data, error } = await db
    .from("notify_requests")
    .select("server_ref, requested_at, fulfilled_at");
  if (error) {
    console.error("[admin] notify fetch failed:", error.message);
    return null;
  }
  const rows = data ?? [];
  const fulfilled = rows.filter((r) => r.fulfilled_at != null).length;
  return {
    perDay: bucketByDay(rows.map((r) => r.requested_at as string), WINDOW_DAYS, today()),
    topServers: tally(rows.map((r) => r.server_ref as string), "—", 10),
    fulfilled,
    unfulfilled: rows.length - fulfilled,
  };
}

export async function getUntrackedDemand(): Promise<UntrackedRow[] | null> {
  const db = getSupabaseAdmin();
  if (!db) return null;
  const { data, error } = await db
    .from("untracked_demand")
    .select("server_ref, request_count, first_seen_at, last_seen_at")
    .order("request_count", { ascending: false })
    .limit(20);
  if (error) {
    console.error("[admin] untracked_demand fetch failed:", error.message);
    return null;
  }
  return (data ?? []) as UntrackedRow[];
}
```

> If the `countOf` helper's `refine` parameter type proves awkward under `tsc`, simplify its signature to `refine?: (q: any) => any` — the Supabase query builder is fluent and `any` here is acceptable for an internal helper. Keep the call sites unchanged.

- [ ] **Step 2: Typecheck**

Run: `cd web && pnpm exec tsc --noEmit`
Expected: PASS. If the `countOf` signature errors, apply the simplification noted above, then re-run.

- [ ] **Step 3: Commit**

```bash
git add web/lib/adminMetrics.ts
git commit -m "feat(web): supabase fetchers for admin demand & funnel metrics"
```

---

## Task 8: Presentational UI components

**Files:**
- Create: `web/app/admin/_components/ui.tsx`

- [ ] **Step 1: Implement `web/app/admin/_components/ui.tsx`**

```tsx
import type { ReactNode } from "react";
import type { DayBucket, Bucket } from "@/lib/adminAggregate";

export function Panel({
  label,
  title,
  note,
  children,
}: {
  label: string;
  title: string;
  note?: string;
  children: ReactNode;
}) {
  return (
    <section className="border border-rule rounded-sm bg-parchment-50 p-5">
      <p className="section-label mb-1">{label}</p>
      <h2 className="font-serif text-lg text-ink mb-1">{title}</h2>
      {note && <p className="text-xs text-ink-faint mb-4">{note}</p>}
      <div className={note ? "" : "mt-4"}>{children}</div>
    </section>
  );
}

export function KpiCard({
  label,
  value,
  sub,
}: {
  label: string;
  value: number;
  sub?: string;
}) {
  return (
    <div className="border border-rule rounded-sm bg-parchment-50 p-4">
      <p className="section-label mb-2">{label}</p>
      <p className="font-serif text-3xl text-ink tabular">{value.toLocaleString()}</p>
      {sub && <p className="text-xs text-ink-muted mt-1 tabular">{sub}</p>}
    </div>
  );
}

/** Inline SVG bar chart for a day-bucketed series. */
export function MiniBars({ data }: { data: DayBucket[] }) {
  const max = Math.max(1, ...data.map((d) => d.count));
  const W = 520;
  const H = 96;
  const gap = 2;
  const bw = (W - gap * (data.length - 1)) / data.length;
  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="w-full h-24" role="img" aria-label="Daily counts">
      {data.map((d, i) => {
        const h = (d.count / max) * (H - 16);
        return (
          <rect
            key={d.date}
            x={i * (bw + gap)}
            y={H - h}
            width={bw}
            height={h}
            fill="var(--color-oxblood)"
            opacity={d.count === 0 ? 0.12 : 0.85}
          >
            <title>{`${d.date}: ${d.count}`}</title>
          </rect>
        );
      })}
    </svg>
  );
}

/** Horizontal ranked bars for leaderboards / breakdowns. */
export function BarList({ data, empty = "No data yet." }: { data: Bucket[]; empty?: string }) {
  if (data.length === 0) return <p className="text-sm text-ink-faint">{empty}</p>;
  const max = Math.max(1, ...data.map((d) => d.count));
  return (
    <ul className="space-y-1.5">
      {data.map((d) => (
        <li key={d.key} className="flex items-center gap-3">
          <span className="w-44 truncate font-mono text-xs text-ink" title={d.key}>
            {d.key}
          </span>
          <span className="flex-1 h-3 bg-parchment-200 rounded-sm overflow-hidden">
            <span
              className="block h-full bg-oxblood"
              style={{ width: `${(d.count / max) * 100}%` }}
            />
          </span>
          <span className="w-8 text-right font-mono text-xs text-ink-muted tabular">
            {d.count}
          </span>
        </li>
      ))}
    </ul>
  );
}

export function EmptyNote({ children }: { children: ReactNode }) {
  return <p className="text-sm text-ink-faint">{children}</p>;
}
```

- [ ] **Step 2: Typecheck**

Run: `cd web && pnpm exec tsc --noEmit`
Expected: PASS.

- [ ] **Step 3: Commit**

```bash
git add web/app/admin/_components/ui.tsx
git commit -m "feat(web): admin dashboard presentational components (SVG charts, cards)"
```

---

## Task 9: Dashboard page

Fetches all metrics in parallel and renders the panels. Force-dynamic so numbers are always fresh.

**Files:**
- Create: `web/app/admin/page.tsx`

- [ ] **Step 1: Implement `web/app/admin/page.tsx`**

```tsx
import type { Metadata } from "next";
import {
  getTopline,
  getWaitlistMetrics,
  getGradeRequestMetrics,
  getNotifyMetrics,
  getUntrackedDemand,
} from "@/lib/adminMetrics";
import { Panel, KpiCard, MiniBars, BarList, EmptyNote } from "./_components/ui";

export const dynamic = "force-dynamic";
export const revalidate = 0;
export const metadata: Metadata = { title: "Admin", robots: { index: false } };

export default async function AdminPage() {
  const [top, waitlist, grades, notify, untracked] = await Promise.all([
    getTopline(),
    getWaitlistMetrics(),
    getGradeRequestMetrics(),
    getNotifyMetrics(),
    getUntrackedDemand(),
  ]);

  return (
    <main className="flex-1 mx-auto w-full max-w-5xl px-6 py-12">
      <div className="flex items-baseline justify-between mb-8">
        <div>
          <p className="section-label mb-1">Internal</p>
          <h1 className="font-serif text-2xl text-ink">Usage metrics</h1>
        </div>
        <form method="post" action="/api/admin/logout">
          <button className="font-mono text-xs text-ink-muted hover:text-oxblood">
            Sign out
          </button>
        </form>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-2 md:grid-cols-3 gap-3 mb-10">
        <KpiCard label="Waitlist" value={top.waitlist} />
        <KpiCard
          label="Grade requests"
          value={top.gradeRequests}
          sub={`${top.gradeQueued} queued`}
        />
        <KpiCard
          label="Notify requests"
          value={top.notify}
          sub={`${top.notifyUnfulfilled} unfulfilled`}
        />
        <KpiCard label="Untracked servers" value={top.untrackedServers} />
      </div>

      <div className="grid gap-6 md:grid-cols-2">
        {/* Waitlist */}
        <Panel
          label="§1"
          title="Waitlist"
          note="New emails per day (last 30d), by first_seen_at. Repeat submits count once."
        >
          {waitlist ? (
            <div className="space-y-5">
              <MiniBars data={waitlist.perDay} />
              <div>
                <p className="section-label mb-2">By role</p>
                <BarList data={waitlist.byRole} />
              </div>
              <div>
                <p className="section-label mb-2">By source</p>
                <BarList data={waitlist.bySource} />
              </div>
            </div>
          ) : (
            <EmptyNote>No waitlist data (or Supabase not configured).</EmptyNote>
          )}
        </Panel>

        {/* Grade requests */}
        <Panel label="§2" title="Grade-request queue" note="Requests per day (last 30d).">
          {grades ? (
            <div className="space-y-5">
              <MiniBars data={grades.perDay} />
              <div>
                <p className="section-label mb-2">By status</p>
                <BarList data={grades.byStatus} />
              </div>
              <div>
                <p className="section-label mb-2">Demand leaderboard</p>
                <BarList data={grades.demand} empty="No requests yet." />
              </div>
            </div>
          ) : (
            <EmptyNote>No grade-request data (or Supabase not configured).</EmptyNote>
          )}
        </Panel>

        {/* Notify funnel */}
        <Panel label="§3" title="Notify funnel" note="Requests per day (last 30d).">
          {notify ? (
            <div className="space-y-5">
              <MiniBars data={notify.perDay} />
              <p className="text-sm text-ink-muted tabular">
                {notify.fulfilled} fulfilled · {notify.unfulfilled} unfulfilled
              </p>
              <div>
                <p className="section-label mb-2">Top servers</p>
                <BarList data={notify.topServers} empty="No notify requests yet." />
              </div>
            </div>
          ) : (
            <EmptyNote>No notify data (or Supabase not configured).</EmptyNote>
          )}
        </Panel>

        {/* Untracked demand */}
        <Panel
          label="§4"
          title="Untracked demand"
          note="CLI checks for servers we don't grade yet. Counter — no time-series."
        >
          {untracked ? (
            untracked.length === 0 ? (
              <EmptyNote>No untracked demand recorded yet.</EmptyNote>
            ) : (
              <BarList
                data={untracked.map((r) => ({ key: r.server_ref, count: r.request_count }))}
              />
            )
          ) : (
            <EmptyNote>No untracked-demand data (or Supabase not configured).</EmptyNote>
          )}
        </Panel>
      </div>
    </main>
  );
}
```

- [ ] **Step 2: Typecheck + build**

Run: `cd web && pnpm exec tsc --noEmit && pnpm build`
Expected: PASS. Build succeeds; `/admin` and `/admin/login` appear as dynamic (ƒ) routes.

- [ ] **Step 3: Commit**

```bash
git add web/app/admin/page.tsx
git commit -m "feat(web): admin dashboard page wiring all demand & funnel panels"
```

---

## Task 10: End-to-end verification

**Files:** none (verification only).

- [ ] **Step 1: Run the full unit suite**

Run: `cd web && pnpm test`
Expected: all `adminAuth` + `adminAggregate` tests PASS.

- [ ] **Step 2: Set a local password and start the dev server**

Ensure `web/.env` (gitignored) has `ADMIN_PASSWORD=devpassword` plus `SUPABASE_URL` / `SUPABASE_SERVICE_ROLE_KEY` (if available; panels degrade gracefully without them).
Start via the preview workflow (`preview_start`).

- [ ] **Step 3: Verify the gate redirects**

Navigate to `/admin` while unauthenticated.
Expected: redirected to `/admin/login`. Confirm via `preview_snapshot` showing the login form.

- [ ] **Step 4: Verify wrong password is rejected**

`preview_fill` the password field with `wrong`, submit.
Expected: back on `/admin/login` with "Incorrect password." (`preview_snapshot`).

- [ ] **Step 5: Verify correct password grants access**

`preview_fill` with `devpassword`, submit.
Expected: lands on `/admin`; `preview_snapshot` shows "Usage metrics", the KPI cards, and the four panels (panels show data if Supabase is configured, else empty-state notes). Capture a `preview_screenshot`.

- [ ] **Step 6: Verify logout**

Click "Sign out".
Expected: redirected to `/admin/login`; navigating back to `/admin` redirects to login again (cookie cleared).

- [ ] **Step 7: Check console/server logs**

`preview_console_logs` and `preview_logs`: no errors.

- [ ] **Step 8: Final commit (if any verification fixups were made)**

```bash
git add -A
git commit -m "test(web): verify admin dashboard auth + panels end-to-end"
```

---

## Self-review notes

- **Spec coverage:** auth (Tasks 2–5), all four panels — waitlist, grade requests, notify, untracked (Tasks 7–9), KPIs (Task 9), data-accuracy caveats surfaced as panel `note` text (Task 9), error/empty handling (Tasks 7–9), tests for `adminAuth` + aggregation (Tasks 2, 6), manual verification (Task 10). The spec's optional grades-coverage panel and traffic/CLI analytics remain out of scope by design.
- **Type consistency:** `DayBucket` / `Bucket` defined in `adminAggregate.ts` (Task 6), reused by `adminMetrics.ts` (Task 7) and `ui.tsx` (Task 8). `ADMIN_COOKIE`, `signSession`, `verifySession`, `checkPassword` defined in Task 2 and consumed in Tasks 3–4. Fetcher return types (`Topline`, `WaitlistMetrics`, etc.) defined in Task 7 and consumed in Task 9.
- **Open risk:** the Next 16 Edge-middleware API is assumed stable; Task 3 directs the implementer to `web/node_modules/next/dist/docs/` if anything mismatches. `adminMetrics.ts`'s `countOf` generic has a documented fallback to `any`.
