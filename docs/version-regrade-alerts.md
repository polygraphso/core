# New-version regrade alerts

> Public self-serve alerting: a developer subscribes an email to an MCP server;
> when that server publishes a new version, polygraph re-grades it and emails the
> new grade. This is the first working slice of the `/ecosystems` continuous-
> monitoring offering — the Re-grade → Detect → Alert loop, running for anyone.

This spans two repos. Most of it lives in **core** (data model, alert engine,
web surface, cron); **hosted-service** contributes the queue/worker changes that
grade and auto-publish a monitored regrade. `litmus` is untouched.

## Scope (v1)

- **Audience:** public self-serve — email + a server ref, no login. Email-token
  based (nullable `user_id` reserved for a future signed-in mode).
- **Trigger:** fires on **any** new-version regrade (no grade-delta logic). The
  data supports adding "only on change / only on regression" later.
- **Targets:** **npm/pypi registry refs only** — the targets with a version
  stream we can watch. Remote URLs and github-only refs are rejected at
  subscribe (they'd be silent dead subscriptions). Skills are deferred (no
  scheduled skill version stream).
- **Email:** Resend.

## The loop

```
 subscribe (web)              detect + enqueue (GHA cron, hourly)        grade + publish (box worker)
 ┌──────────────┐             ┌─────────────────────────────────┐        ┌──────────────────────────┐
 user → /monitor → monitors    pass 1 (enqueue): for each          worker claims a source='monitor'
 (email + ref)     table       monitored target, if its latest     row, grades it in Docker, and
                               version has no published grade &     (auto-publish branch)
                               no monitor regrade is in flight →    unpublishPrevious + set published_at
                               insert hosted_runs(source='monitor') │
                                          │                          │
 reconcile + email (same cron) ◄──────────┴──────────────────────────┘  (next run, after the grade lands)
 pass 2: for each monitor, if the latest published grade's row id ≠ last_notified_run_id
   → claim alert_deliveries (UNIQUE(monitor_id, hosted_run_id) → dedup) → Resend email → advance watermark
```

**Cadence.** Hour N enqueues; the always-on worker grades within minutes; hour
N+1 reconciles and emails. The ~1-hour enqueue→grade→notify latency is acceptable
for "your server has a new grade" and is intentional (not engineered away).

**Why the split.** The grade must run on the box (the Docker egress sandbox); the
detect/enqueue/email work runs in GitHub Actions (Resend is an HTTP API — no box
access needed). The grader still never holds a minter key and the alert path never
grades — each side keeps its existing responsibility.

## Data model (core, Supabase)

Migrations in `packages/core/supabase/migrations/`:

**`20260701120000_hosted_runs_source.sql`** — adds `hosted_runs.source text not
null default 'paid'`. The default preserves every existing row's behavior; only
`source='monitor'` is special-cased (claimable without payment, auto-published).
Plus a partial index on in-flight monitor rows for the enqueue guard.

**`20260701120100_monitors.sql`** — mirrors `notify_requests`:

- **`monitors`** — one subscription per `(target, identity)`. Columns: `target`,
  `target_kind`, `email` XOR `user_id`, `unsubscribe_token`, `unsubscribed_at`,
  and the watermark `last_notified_run_id` (the dedup key — the `hosted_runs.id`
  last emailed) plus display-only `last_notified_version` / `_grade` / `_at`.
- **`alert_deliveries`** — the send log **and** the double-email defense:
  `unique (monitor_id, hosted_run_id)`. The reconcile pass claims a delivery here
  before sending, so overlapping cron runs can never both email.
- **`record_monitor(p_target, p_email, p_user_id)`** RPC — idempotent subscribe.
  Seeds `last_notified_run_id` to the currently published grade so the watcher is
  not emailed about the version that was already live when they subscribed;
  reactivates a previously-unsubscribed row; a re-subscribe of an active row is a
  no-op.

The scoring/grade seam is joined only by the `target` string: `hosted_runs.target`
is the versionless server_key (`npm/@scope/name`), and `resolved_version` is the
graded version. There is no FK from `hosted_runs` to `servers`/`versions`; the
engine operates on the ref + the npm/pypi adapters + `hosted_runs` directly, so a
user can monitor any npm/pypi MCP whether or not it's in the tracked index.

## The alert engine (core/packages/scoring)

`src/scripts/alerts.ts` → `runAlerts(store, deps)` in `src/alerts/alerts.ts`. Two
idempotent passes over the active monitors:

1. **Enqueue** — per **distinct** monitored target: resolve its latest npm/pypi
   version; if that version has no published grade **and** no monitor regrade is
   already queued/running, insert a `source='monitor'` `hosted_runs` row. Scoped
   to monitored targets only (this is what keeps the free regrade affordable) and
   capped per run as a circuit breaker.
2. **Reconcile** — per active monitor: read the latest published grade row; if its
   **id** differs from the watermark, claim an `alert_deliveries` row
   (`on conflict do nothing`), send the email best-effort, and advance the
   watermark. Dedup is on the **published row id**, not a version comparison —
   this avoids a wall-clock race and npm/pypi "latest" flapping (dist-tag
   rollback).

Structure:

| File | Role |
|---|---|
| `src/alerts/alerts.ts` | `runAlerts` — the two-pass orchestration (pure, over `AlertStore`). |
| `src/alerts/store.ts` | `AlertStore` interface + `supabaseAlertStore` (all the DB queries). |
| `src/alerts/email.ts` | `buildAlertEmail` (pure, testable) + `resendSender`; adds `List-Unsubscribe` headers. |
| `src/scripts/alerts.ts` | CLI entrypoint (`pnpm --filter @polygraph/scoring alerts`). |

Run hourly by **`.github/workflows/alerts.yml`** (`alerts:ci`).

## The queue + worker (hosted-service)

- **`deploy/db/claim_next_hosted_run.sql`** — the claim now drains
  `status='queued' AND (paid_at IS NOT NULL OR source='monitor')`, ordered
  `(source='monitor'), coalesce(paid_at, created_at)` so **paid rows always drain
  first** — a monitor backlog can never starve a paying customer.
- **`packages/runner/src/worker.ts`** — `writeGradeResult` branches on
  `source==='monitor'`: it calls `unpublishPrevious(target, resolvedVersion)` then
  stamps `published_at` (auto-publish). Paid rows stay grade-only — the web mint
  app still publishes those. This makes "the worker publishes monitor rows / the
  web publishes paid rows" an explicit rule rather than a violated invariant.

## Web surface (core/web)

- **`app/api/monitor/route.ts`** — POST subscribe. Rate-limit + honeypot,
  normalizes via `serverKey(parseServerRef(...))`, rejects non-npm/pypi refs,
  calls `record_monitor`. Mirrors `/api/notify`.
- **`app/api/monitor/unsubscribe/route.ts`** — one-click unsubscribe by token.
  GET (human click → confirmation page), POST (RFC 8058 one-click). Idempotent.
- **`app/monitor/page.tsx`** + `_components/MonitorForm.tsx` — the subscribe
  surface (`?for=<ref>`), preprint chrome, anonymous + future signed-in modes.
- A **"Monitor this server"** CTA on the graded branch of `app/mcp/[...ref]/page.tsx`
  (npm/pypi only).

## Correctness guarantees

- **No double emails.** `unique (monitor_id, hosted_run_id)` on `alert_deliveries`
  + claim-before-send makes concurrent/overlapping cron runs idempotent. The
  watermark is a second-line optimization; the constraint is the real defense.
- **No starvation.** Paid grades always drain before monitor regrades.
- **No dead subscriptions.** Non-npm/pypi refs are rejected at subscribe.
- **No inbox noise on failure.** A failed regrade never emails (reconcile reads
  only *published* rows); a failed *send* is not retried (best-effort — the claim
  already advanced). The watermark advances after each attempt so a crashed send
  can't wedge a monitor.

## Deploy handshake — strict order

The base `hosted_runs` table is applied out-of-band (not under migration control),
so verify its live columns before step 1. Then, in order:

1. Apply **`20260701120000_hosted_runs_source.sql`** (the `source` column) **first**.
   If the claim SQL ships before the column exists, `source` is referenced before
   it exists and **every claim errors — the whole queue stalls, paid grades
   included.**
2. Apply **`20260701120100_monitors.sql`**.
3. Apply the widened **`hosted-service/deploy/db/claim_next_hosted_run.sql`**.
4. Deploy the **runner worker**. (`claimNextRun` silently drops unknown columns, so
   a lagging worker just writes monitor rows grade-only until it catches up —
   harmless.)
5. Set the **`RESEND_API_KEY`** GHA secret (optional `ALERT_FROM_EMAIL` /
   `POLYGRAPH_SITE_URL` repo vars) and verify the Resend sending domain.

The cron must not run until steps 1–3 are live, or enqueued monitor rows never
publish.

## Operations

- **Cron:** `.github/workflows/alerts.yml`, hourly (`23 * * * *`), `workflow_dispatch`
  enabled for manual runs.
- **Env:** `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, `RESEND_API_KEY`; optional
  `ALERT_FROM_EMAIL` (default `polygraph <alerts@polygraph.so>`), `POLYGRAPH_SITE_URL`
  (default `https://polygraph.so`).
- **Manual run:** `pnpm --filter @polygraph/scoring alerts` (prints monitors /
  targets / enqueued / sent / failed / skipped).
- **Inspect:** `select status, count(*) from alert_deliveries group by status;` and
  the per-run `hosted_runs where source='monitor'` rows.

## Deferred (roadmap, not v1)

Skills monitoring (needs a content-hash re-fetch loop) · remote/github monitoring ·
grade-change / regression-only / rug-pull-fingerprint alerts · double-opt-in
confirmation email. Separate ticket: `web/app/api/admin/publish/route.ts` sets
`published_at` without `unpublishPrevious` (a latent unique-index violation on
re-publish).
