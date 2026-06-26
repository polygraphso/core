# @polygraph/scoring

Daily adoption-signal pipeline for MCP servers. Lifts behaviors from the proven mcp-tool pipeline in `agentic-talent-app`, pruned to what `scoring-brief.md` defines as in-scope (npm/pypi/github + OpenSSF + Glama/Smithery as components + deps.dev vulns).

## Status

Live. All adapters (npm, pypi, github, OpenSSF, Glama, Smithery, deps.dev) ship, the
compute/rank/tier pass and the `LISTEN/NOTIFY` emit are wired, and the daily ranking runs on a
**GitHub Actions cron** (`.github/workflows/score.yml`, 06:17 UTC; `workflow_dispatch` for
manual runs). The public **MCP Security Index** (`/rankings` on polygraph.so) reads the latest
`adoption_scores` for its ordering; adoption is the ordering/coverage axis, not a published grade.

## Setup

The package reads `SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY` from the repo-root `.env`. Migrations in `packages/core/supabase/migrations/` must already be applied — the seed script writes to the `servers` table created there.

```bash
# from repo root
cp .env.example .env   # fill in Supabase values (see packages/core/README.md)
pnpm install
pnpm --filter @polygraph/scoring seed
```

The seed script is idempotent — re-running it updates `last_seen` and is a no-op otherwise. Unique key is `(registry, owner, name)` with `nulls not distinct`, so unscoped npm packages (e.g. `npm/lodash`) round-trip correctly.

## Probe — single-server adapter dry run

For ad-hoc debugging ("what does scoring see for X?"), without touching the DB:

```bash
pnpm --filter @polygraph/scoring probe npm/@modelcontextprotocol/server-filesystem
pnpm --filter @polygraph/scoring probe npm/lodash
pnpm --filter @polygraph/scoring probe github/modelcontextprotocol/servers
```

Resolves a `{registry}/{owner}/{name}` ref, runs every available adapter against it, and prints the result. For npm refs, the github adapter chains automatically when npm's `repository` field points at github — same composition the daily loop uses.

## Score — full ranking pass

Runs the orchestrator end-to-end: scrapes every tracked server through its adapters, builds component snapshots, computes raw dimensions, applies the shared-repo mask, normalizes / weights / ranks across the batch, assigns tiers, and writes one `adoption_scores` row per server.

```bash
pnpm --filter @polygraph/scoring score                        # full run, writes to DB
pnpm --filter @polygraph/scoring score -- --limit 5           # first 5 servers only
pnpm --filter @polygraph/scoring score -- --dry-run           # compute + rank, no DB write
pnpm --filter @polygraph/scoring score -- --limit 10 --dry-run
```

At 78 servers and ~6 adapters per npm server (sequential across servers, parallel within), expect ~5-10 minutes for a full run. Scheduled via `.github/workflows/score.yml` (daily 06:17 UTC; `workflow_dispatch` for manual runs). Secrets: `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, `SCORING_GITHUB_TOKEN`.

## Top — read current rankings as JSON

```bash
pnpm --filter @polygraph/scoring top                          # default top 50, compact JSON
pnpm --filter @polygraph/scoring top -- --limit 10 --pretty   # top 10, indented
```

Reads from `adoption_scores`, dedupes by `version_id` (keeping the latest run), sorts by score, joins server identity, returns the top N.

## Poll — hourly version-detection pass

```bash
pnpm --filter @polygraph/scoring poll                         # check every npm/pypi-tracked server
pnpm --filter @polygraph/scoring poll -- --limit 10
```

Light pass: per server, hits only the npm/pypi metadata endpoint to read the current latest version, compares to `versions`, and inserts + emits `version_detected` when a new one appears. **No scoring.** The daily `score` job catches the new `version_id` through the same `ensureVersionId` code path and writes adoption_scores.

github-only refs are skipped — GitHub "versions" mean tags, which is a different (and noisier) concept that's not in v1.

## Events — LISTEN/NOTIFY

Scoring emits two channels via the `polygraph_notify(channel, payload)` Postgres RPC (defined in `20260518170000_polygraph_notify_function.sql`):

| channel | payload | when |
|---|---|---|
| `version_detected` | `{ version_id, server_id }` | a new `versions` row is inserted (by `poll` or `score`) |
| `grade_computed` | `{ version_id, kind: "adoption", new_value }` | after a `score` run writes the adoption_scores row |

Consumers listen via `pg-listen` or direct `LISTEN` SQL on a long-lived Postgres connection. Supabase Realtime is intentionally **not** used — the contracts doc specifies direct LISTEN/NOTIFY. The RPC allowlists channel names; passing an unknown one raises at the DB layer.

NOTIFY failures log and swallow — a dropped notification shouldn't fail the broader scoring run. Symptom of silent drops is litmus / alert workers not firing.

## Deployment

The daily ranking runs as a **GitHub Actions cron** (`.github/workflows/score.yml`), the chosen
scheduler: a ~5–10 min daily pass fits inside the free Actions allowance, runs the existing
`pnpm score` unchanged, and gets native repo-secret management (`SUPABASE_URL`,
`SUPABASE_SERVICE_ROLE_KEY`, `SCORING_GITHUB_TOKEN`), built-in logs, and failure notification —
no always-on infra. (The earlier Hetzner-worker / Supabase-Edge-Function options were dropped:
Edge Functions are Deno with a short timeout a 5–10 min run would exceed, and a dedicated box
adds ops burden for no gain at this size. Revisit only if the tracked universe outgrows the
daily Actions window.) The hourly `poll` is optional and **not currently scheduled** — the daily
`score` keeps the ranking fresh enough for the Index.

## Notify-funnel fulfillment

When a server transitions from untracked → tracked, the scoring brief calls for an email to anyone who'd requested notification. The `notify_requests` table now exists (migration `20260521120000_notify_requests.sql`) and the `/notify` funnel (`web/app/api/notify/route.ts`) writes to it, but the **fulfillment hook is not yet wired** into the `score` orchestrator — it belongs right after `writeAdoptionScores`, reading pending `notify_requests` rows for the newly-tracked server.

## Seed sources

`src/seed/servers.yaml` is hand-curated from four verified sources (see the comment block at the top of the file):

1. The Official MCP Registry at `registry.modelcontextprotocol.io` — every listing is vetted by the MCP team. We snapshot the npm/pypi-published subset.
2. `@modelcontextprotocol/*` reference servers verified live on npm.
3. `mcp-server-*` canonical pypi packages (the Python-implemented reference servers).
4. Well-known third-party MCP packages (Notion, Cloudflare, Supabase, Upstash).

The brief's floor is ≥30 servers; the current seed is ~78. Tier is rank-based, so low-signal entries simply rank low and don't pollute the matrix. **Adding entries** is append-only: new YAML rows; the script upserts. **Removing** should be done by commenting out (the DB row + its history stays); hard-deletes would orphan downstream `versions`/`adoption_scores` rows.

## Shipped & what's next

Phases 1–6 have all shipped: seed list → npm/github/pypi/openssf/depsdev/glama/smithery
adapters (with tests) → the pruned compute + rank-based tier writer → hourly version `poll`,
daily `score` loop, and `LISTEN/NOTIFY` emit → deploy, which landed as the GitHub Actions cron
above. Remaining, out of v1 scope:

- A live **registry-sync** adapter (official MCP registry / Glama / Smithery) to replace the
  static seed snapshot and grow the tracked universe automatically.
- Wiring the **notify-funnel fulfillment** hook (above) into the `score` orchestrator.
