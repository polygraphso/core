# @polygraph/scoring

Daily adoption-signal pipeline for MCP servers. Lifts behaviors from the proven mcp-tool pipeline in `agentic-talent-app`, pruned to what `scoring-brief.md` defines as in-scope (npm/pypi/github + OpenSSF + Glama/Smithery as components + deps.dev vulns).

## Current phase

Phase 1: package skeleton + curated seed list + seed script. Adapters, compute, and the daily loop land in later PRs.

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

NOTIFY failures log and swallow — a dropped notification shouldn't fail the broader scoring run. Symptom of silent drops is litmus / alert workers not firing, which Phase 5b's metrics will catch.

## Deployment (Phase 5b)

The cron-runnable scripts above (`poll`, `score`) are ready to wrap in a scheduler. Two options the brief calls out:

- **Hetzner Node worker** — a small Node process with `node-cron` or two systemd timers. Co-locates with the litmus harness (which needs Hetzner anyway for the sandboxed probe runs).
- **Supabase Edge Functions on a cron** — `pnpm score` and `pnpm poll` wrapped as Edge Function entrypoints, scheduled via Supabase's pg_cron extension.

Hetzner is the leading choice — easier to observe, no Edge Function cold-start, and no cap on long-running scoring passes. Phase 5b will land the deploy plumbing once the litmus team has settled their Hetzner setup.

## Notify-funnel fulfillment

When a server transitions from untracked → tracked, the scoring brief calls for an email to anyone who'd requested notification. This depends on the `notify_requests` table, which is **onboarding's territory** and hasn't landed yet. The hook will be wired into the `score` orchestrator (right after `writeAdoptionScores`) once `notify_requests` is available.

## Seed sources

`src/seed/servers.yaml` is hand-curated from four verified sources (see the comment block at the top of the file):

1. The Official MCP Registry at `registry.modelcontextprotocol.io` — every listing is vetted by the MCP team. We snapshot the npm/pypi-published subset.
2. `@modelcontextprotocol/*` reference servers verified live on npm.
3. `mcp-server-*` canonical pypi packages (the Python-implemented reference servers).
4. Well-known third-party MCP packages (Notion, Cloudflare, Supabase, Upstash).

The brief's floor is ≥30 servers; the current seed is ~78. Tier is rank-based, so low-signal entries simply rank low and don't pollute the matrix. **Adding entries** is append-only: new YAML rows; the script upserts. **Removing** should be done by commenting out (the DB row + its history stays); hard-deletes would orphan downstream `versions`/`adoption_scores` rows.

## Next phases (sketch)

- **Phase 2** — npm + github adapters with tests (the two biggest signal contributors).
- **Phase 3** — pypi, openssf, depsdev, glama, smithery adapters.
- **Phase 4** — pruned `computeMcpToolAdoption` + rank-based tier writer.
- **Phase 5** — hourly version poll + daily scoring loop + `LISTEN/NOTIFY` emit.
- **Phase 6** — deploy plumbing (Hetzner worker or Edge Function — pending litmus' deploy choice).
