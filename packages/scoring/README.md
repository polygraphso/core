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
