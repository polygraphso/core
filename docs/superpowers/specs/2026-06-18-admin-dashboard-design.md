# Admin dashboard — design spec

**Date:** 2026-06-18
**Status:** Approved (design), pending implementation plan
**Scope:** Password-gated internal admin dashboard surfacing demand & funnel metrics from existing Supabase data.

## Goal

Give the founder (and anyone he shares the password with) a single internal page that shows real demand and funnel signals for polygraph.so, read straight from the existing Supabase tables. No new tracking infrastructure, no new dependencies.

## Non-goals (parking-lot)

- **Traffic analytics** (pageviews, unique visitors, sessions, referrers) — requires adding an analytics layer first. Out.
- **CLI-lookup time-series** (volume of `npx polygraphso check` over time, hit/miss rate) — today only *misses* are counted, as a bare per-server counter. Out until instrumentation exists.
- **Grades-coverage panel** (grade distribution A–F, coverage gaps from `hosted_runs`) — not requested. Out.
- **Multi-user accounts / roles / SSO** — single shared password only.
- **`rate_limits` data** — ephemeral (self-prunes ~1 day), IP-keyed; not a durable analytics source. Out.

## Architecture

A single server-rendered route group `web/app/admin/` inside the existing Next.js 16 app (App Router, React 19, Tailwind v4). All data is fetched server-side via the existing `getSupabaseAdmin()` accessor (`web/lib/supabase.ts`) using the service-role key. No client-side data fetching; no public API route exposes any of these numbers or any PII.

Posture matches the rest of the codebase: fail-closed, service-role-only, no PII to the client, no `NEXT_PUBLIC_` secrets.

### Auth — login page + signed cookie

Decided gate style: a branded login page that sets a signed, HTTP-only session cookie.

- **Secret:** new server-only env var `ADMIN_PASSWORD`. Added to `.env.example` with a comment forbidding a `NEXT_PUBLIC_` prefix, same convention as `SUPABASE_SERVICE_ROLE_KEY`. A single shared password; sharing the password is how access is granted.
- **Middleware:** `web/middleware.ts` matches `/admin/:path*`, allows `/admin/login` and the admin auth API routes through unauthenticated, and otherwise requires a valid session cookie. Missing/invalid cookie → 307 redirect to `/admin/login`.
  - NOTE: This Next.js version diverges from training-data conventions (`web/AGENTS.md`). Consult `web/node_modules/next/dist/docs/` for the correct middleware + `matcher` API before writing it. Confirm the Edge-runtime constraint: if Node's `crypto` is unavailable in middleware, verify the cookie with the Web Crypto API (`crypto.subtle`) instead, or do the signature check in the route handlers and have middleware check only for cookie presence + expiry. Resolve this during planning.
- **Cookie:** an HMAC-SHA256 signed token. Payload is a fixed marker plus an expiry timestamp; signature is HMAC keyed by `ADMIN_PASSWORD`. The password itself is never stored in the cookie, and the token cannot be forged without the secret. Attributes: `HttpOnly`, `Secure`, `SameSite=Lax`, ~30-day max-age. Verification recomputes the HMAC (constant-time compare) and checks the expiry.
- **Login route:** `web/app/api/admin/login/route.ts` (POST) — constant-time-compares the submitted password against `ADMIN_PASSWORD`, and on success sets the signed cookie and returns a redirect to `/admin`. Wrapped in the existing `enforceRateLimit` helper (`web/lib/rateLimit.ts`) to throttle brute-force attempts.
- **Logout route:** `web/app/api/admin/logout/route.ts` (POST) — clears the cookie, redirects to `/admin/login`.
- **Login page:** `web/app/admin/login/page.tsx` — on-brand (warm parchment background, ink text, oxblood accent, Source Serif 4 / IBM Plex Sans / IBM Plex Mono). Single password field. Shows a generic "incorrect password" error without leaking which part failed.

### Auth helper module

`web/lib/adminAuth.ts` (new), `import "server-only"` where applicable:
- `signSession(expiresAt): string` — produce the cookie token.
- `verifySession(token): boolean` — verify signature + expiry, constant-time.
- `checkPassword(input): boolean` — constant-time compare against `ADMIN_PASSWORD`.
- Cookie name + max-age constants live here.

If the signature must be verified in Edge middleware, this module (or a thin sibling) must use Web Crypto (`crypto.subtle`) so it is Edge-compatible. Decide during planning per the middleware note above.

## Panels

A single `/admin` page (`web/app/admin/page.tsx`), with `export const dynamic = 'force-dynamic'` and `revalidate = 0` so internal numbers are always fresh and never cached. The page is a shell; each panel is its own server component under `web/app/admin/_components/`, each reading one table so it can be understood and tested independently. Aggregation queries live in `web/lib/adminMetrics.ts` (one function per panel, returning typed shapes).

Charts are lightweight inline SVG (small bar / sparkline components) — no chart library, consistent with the scientific-preprint aesthetic and zero new deps.

### 1. Top-line KPIs
Cards: total waitlist signups; total grade requests (and how many still `queued`); total notify requests (and how many unfulfilled, `fulfilled_at is null`); distinct untracked servers being asked for.

Sources: `waitlist_signups`, `grade_requests`, `notify_requests`, `untracked_demand`.

### 2. Waitlist
- New signups per day for the last 30 days, grouped by `first_seen_at::date`. **Honest caveat:** `waitlist_signups` is upserted per email, so "per day" means *new emails by first_seen_at*; repeat submissions increment `signup_count`, they do not appear as new dots.
- Breakdown by `role` (developer/security/founder/researcher/other/null) and by `source`.
- Recent signups table: email, role, source, `first_seen_at`.

Source: `waitlist_signups` (`email`, `role`, `source`, `signup_count`, `first_seen_at`, `last_seen_at`).

### 3. Grade-request queue
- Status breakdown: queued / in_progress / completed / declined.
- Requests per day (true per-row time-series on `requested_at`).
- **Demand leaderboard:** targets ranked by distinct requester count (rows per `target`).
- Recent requests table: target, target_kind, status, `requested_at`.

Source: `grade_requests` (`target`, `target_kind`, `email`, `status`, `requested_at`, `fulfilled_at`). One row per `(target, email)`.

### 4. Notify funnel
- Top servers by notify count (`server_ref`).
- Fulfilled vs unfulfilled split (`fulfilled_at`).
- Requests per day on `requested_at`.

Source: `notify_requests` (`server_ref`, `server_id`, `email`/`user_id`, `requested_at`, `fulfilled_at`). One row per `(server_ref, identity)`.

### 5. Untracked demand
- Leaderboard of `server_ref` by `request_count` — servers people CLI-check that we don't grade yet.
- First/last seen per ref.
- **Caveat:** pure counter, no per-event rows → leaderboard + recency only, no time-series.

Source: `untracked_demand` (`server_ref`, `request_count`, `first_seen_at`, `last_seen_at`).

## File plan

| File | Status | Purpose |
|---|---|---|
| `web/middleware.ts` | new | Gate `/admin/*`, allow `/admin/login` + admin auth routes |
| `web/lib/adminAuth.ts` | new | Sign/verify cookie, constant-time password compare |
| `web/app/admin/login/page.tsx` | new | Branded login form |
| `web/app/api/admin/login/route.ts` | new | Verify password, set cookie (rate-limited) |
| `web/app/api/admin/logout/route.ts` | new | Clear cookie |
| `web/app/admin/page.tsx` | new | Dashboard shell (force-dynamic) |
| `web/app/admin/_components/*` | new | One server component per panel + SVG bar/sparkline |
| `web/lib/adminMetrics.ts` | new | Supabase aggregation queries (one fn per panel) |
| `.env.example` | edit | Add `ADMIN_PASSWORD` |

## Data-accuracy contract

- `grade_requests`, `notify_requests`: true per-row timestamps → daily charts are exact.
- `waitlist_signups`: upserted per email → "per day" = new emails by `first_seen_at`; repeats counted via `signup_count`, not as new rows.
- `untracked_demand`: counter only → leaderboard + first/last seen, no time-series.

These caveats are surfaced honestly in the UI (small labels), never papered over.

## Error handling

- `getSupabaseAdmin()` returns `null` when env is unconfigured. Each panel renders a graceful "not configured" / "no data yet" state instead of throwing, matching existing server components (`ChecksSoFar.tsx`).
- Empty tables render empty-state copy, not errors.
- Login: generic error message; never reveal whether the password or the request shape was wrong.
- Brute-force: login route rate-limited via `enforceRateLimit`.

## Testing

- `adminAuth.ts`: unit tests for sign→verify round-trip, expired-token rejection, tampered-token rejection, constant-time password compare (correct vs incorrect).
- `adminMetrics.ts`: tests for each aggregation against representative fixtures (empty, single, multi-row; day-bucketing boundaries; null role/source handling).
- Middleware: redirect-when-unauthenticated and pass-through-when-valid (per the resolved Edge/Node decision).
- Manual verification via the preview workflow: login flow, panels render with seeded data, logout clears access.
