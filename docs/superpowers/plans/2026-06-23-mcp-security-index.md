# MCP Security Index (`/rankings`) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ship a public, adoption-ranked `polygraph.so/rankings` page that lists the most-adopted MCP servers with their published litmus grades, backed by a daily-refreshed adoption pipeline.

**Architecture:** Part A stands up a daily GitHub Actions cron that runs the existing (dormant) `@polygraph/scoring` pipeline so `adoption_scores` stays fresh, plus a one-time grading sprint (runbook) to grade the top 50. Part B adds a server-rendered `/rankings` page in `core/web` that reads `adoption_scores` and `hosted_runs` directly from Supabase, joins them on the versionless `serverKey`, and renders a preprint-style table. The page degrades to a safe empty state when Supabase is unconfigured or empty.

**Tech Stack:** Next.js 16 (App Router, RSC), Tailwind v4 tokens, `@supabase/supabase-js` (service-role, server-only), Vitest (new to `web`), `@polygraph/scoring` (Node + tsx) in CI.

## Global Constraints

- **Methodology display string:** `litmus-v6` (current). It is a display string only — never gate logic on it.
- **Hosted grades are `A`/`B`/`D`/`F` only** (the live `hosted_runs` CHECK allows no `C`). The `LitmusGrade` type still includes `C`; handle defensively, never assume.
- **Tone (scientific preprint, no hype):** keep the line "a grade is a measurement, not a guarantee"; order the table **by adoption, not by grade**; no "hall of shame" / ranking-worst framing.
- **`web` vendors its own data access and identity helpers** — it does NOT import the workspace packages (`@polygraph/*`). Do NOT add a workspace-package dependency to `web`; replicate the small read query locally, exactly as `web/lib/hostedGrades.ts` and `web/lib/identity.ts` already do.
- **Migrations are append-only**, and this work only READS — introduce no schema changes.
- **No onchain / minting in v1.** Do not link attestations or add wallet code.
- **Versionless join key:** `hosted_runs.target` is `serverKey({registry, owner, name})` (e.g. `npm/@scope/name`, or `pypi/mcp-server-git` with null owner) filtered by `target_kind='registry_ref'`. `adoption_scores` joins via `versions → servers → serverKey`. This is the only correct join.
- **Toolchain:** `pnpm@9.0.0`, Node `>=20.6.0`. Run web package scripts with the path filter `pnpm --filter ./web <script>`.

---

## Part A — Adoption data live (infra + runbook)

The scoring engine (`@polygraph/scoring`) is code-complete but only runs by hand and writes `adoption_scores` from a static 78-server seed (`packages/scoring/src/seed/servers.yaml`). `core` has **no `.github/` directory at all**. The `score`/`seed` scripts hardcode `--env-file=../../.env`, which does not exist in CI — so we add `*:ci` variants that read `process.env` instead.

### Task 1: Daily adoption-score cron (GitHub Actions)

**Files:**
- Modify: `packages/scoring/package.json` (add `seed:ci`, `score:ci` scripts)
- Create: `.github/workflows/score.yml`

**Interfaces:**
- Produces: a scheduled + manually-dispatchable workflow that refreshes `adoption_scores` daily. Consumes repo secrets `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, `SCORING_GITHUB_TOKEN`.

- [ ] **Step 1: Add CI script variants** (no `--env-file`; Node reads `process.env`)

In `packages/scoring/package.json`, inside `"scripts"`, add the two `:ci` lines (keep the existing `seed`/`score`):

```json
    "seed": "node --env-file=../../.env --import tsx ./src/seed/seed.ts",
    "seed:ci": "node --import tsx ./src/seed/seed.ts",
    "score": "node --env-file=../../.env --import tsx ./src/scripts/score.ts",
    "score:ci": "node --import tsx ./src/scripts/score.ts",
```

- [ ] **Step 2: Verify the CI script parses locally** (it will exit non-zero without env, which is expected — we only confirm tsx/entry resolves, not a full run)

Run: `cd packages/scoring && SUPABASE_URL= node --import tsx ./src/scripts/score.ts --dry-run --limit 1; echo "exit=$?"`
Expected: it starts (`[score] starting … [dry-run]`) and then errors on the missing Supabase config — NOT a "module not found" / tsx error. Any startup that reaches the Supabase client is success for this step.

- [ ] **Step 3: Create the workflow**

```yaml
# .github/workflows/score.yml
name: adoption-score

on:
  schedule:
    - cron: "17 6 * * *" # daily 06:17 UTC
  workflow_dispatch: {}

concurrency:
  group: adoption-score
  cancel-in-progress: false

jobs:
  score:
    runs-on: ubuntu-latest
    timeout-minutes: 30
    steps:
      - uses: actions/checkout@v4
      - uses: pnpm/action-setup@v4
        with:
          version: 9
      - uses: actions/setup-node@v4
        with:
          node-version: 20
          cache: pnpm
      - run: pnpm install --frozen-lockfile
      - name: Seed (idempotent — picks up servers.yaml changes)
        run: pnpm --filter @polygraph/scoring seed:ci
        env:
          SUPABASE_URL: ${{ secrets.SUPABASE_URL }}
          SUPABASE_SERVICE_ROLE_KEY: ${{ secrets.SUPABASE_SERVICE_ROLE_KEY }}
          GITHUB_TOKEN: ${{ secrets.SCORING_GITHUB_TOKEN }}
      - name: Score
        run: pnpm --filter @polygraph/scoring score:ci
        env:
          SUPABASE_URL: ${{ secrets.SUPABASE_URL }}
          SUPABASE_SERVICE_ROLE_KEY: ${{ secrets.SUPABASE_SERVICE_ROLE_KEY }}
          GITHUB_TOKEN: ${{ secrets.SCORING_GITHUB_TOKEN }}
```

Note: the scoring github adapter reads `process.env.GITHUB_TOKEN` and throws if missing; we map the dedicated `SCORING_GITHUB_TOKEN` secret (a fine-grained PAT with public-repo read, per `.env.example`) onto it. Do **not** rely on the Actions-injected `GITHUB_TOKEN` — name the secret explicitly so the mapping is unambiguous.

- [ ] **Step 4: Commit**

```bash
git add packages/scoring/package.json .github/workflows/score.yml
git commit -m "feat(scoring): daily adoption-score cron via GitHub Actions"
```

- [ ] **Step 5: Configure secrets, then verify with a manual dispatch** (one-time, by a maintainer with repo admin)

In the GitHub repo: Settings → Secrets and variables → Actions → add `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, `SCORING_GITHUB_TOKEN`. Then Actions → "adoption-score" → "Run workflow".
Expected: the run completes green; the `Score` step logs `[score] complete in …s`, `written: N adoption_scores rows`, and a "Top 10" block. This confirms the pipeline writes fresh rows.

- [ ] **Step 6: Record the decision in the package README**

In `packages/scoring/README.md`, replace the stale "Phase 5 will wrap this in a daily cron" line with: "Scheduled via `.github/workflows/score.yml` (daily 06:17 UTC; `workflow_dispatch` for manual runs). Secrets: `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, `SCORING_GITHUB_TOKEN`." Commit:

```bash
git add packages/scoring/README.md
git commit -m "docs(scoring): record the daily cron + required secrets"
```

### Runbook A2: Grade the top 50 (one-time coverage sprint) — OPS, not a code task

This runs against **production** infra and follows the `fulfilling-grade-requests` memory recipe. It is a prerequisite for a credible launch, not for building Part B (Part B works against whatever is already in `adoption_scores`/`hosted_runs`).

1. Get the current top 50 server refs:
   `pnpm --filter @polygraph/scoring top -- --limit 50 --pretty` (reads the live DB; needs the root `.env`).
2. For each `registry_ref` target, request a grade on the hosted runner: `POST https://<hosted-host>/grade` with `Authorization: Bearer <LITMUS_RUNS_TOKEN>` (token in SSM) and body `{"target":"<serverRef>"}`, then poll `GET /grade/<id>` to completion. The runner is single-flight — submit serially or in a small loop.
3. Publish each completed run (the runner leaves `published_at` NULL): set `published_at` and confirm `status='complete'` on the `hosted_runs` row, per the memory recipe.
4. Verify coverage: `GET https://polygraph.so/api/cli/list` should now return the newly published targets. Remote-only or Docker-skipped servers cap at **B** — that is expected; surface the cap reason, don't hide it.

Coverage bar before public launch: **all of the top 50 graded** (un-gradeable ones labeled with a reason).

---

## Part B — The `/rankings` page (feature, TDD where pure)

All Part B work is in `core/web`. `web` currently has **no test runner**; Task B1 introduces Vitest scoped to pure helpers. The page, OG image, and nav are verified by `pnpm --filter ./web build` (Next type-checks during build) plus a manual `dev` look.

### Task 2: Rankings pure helpers + tests

**Files:**
- Create: `web/vitest.config.ts`
- Modify: `web/package.json` (add `vitest` devDep + `test` script)
- Create: `web/lib/rankings.ts`
- Test: `web/lib/rankings.test.ts`

**Interfaces:**
- Consumes: `serverKey` from `web/lib/identity.ts` (signature `serverKey(parts: { registry; owner: string | null; name }): string`), `LitmusGrade` type from `web/lib/hostedGrades.ts`.
- Produces: pure `formatAdoptionSignal(c)`, `dedupeAndRank(rows, limit)`, `gradeMapFromRows(rows)`, `mergeRankings(ranked, grades)`; impure `fetchTopRanked(db, limit)`, `fetchPublishedGradeDetailMap(db)`; types `RankedServer`, `RankingGrade`, `RankingRow`, `JoinedScoreRow`, `RankingComponents`. Task 3 consumes the fetches + `mergeRankings`.

- [ ] **Step 1: Add Vitest to `web`**

In `web/package.json`, add the script and devDep (match the version used elsewhere in the repo):

```json
  "scripts": {
    "dev": "next dev",
    "build": "next build",
    "start": "next start",
    "test": "vitest run"
  },
```

Add to `devDependencies`: `"vitest": "^2.1.0"`. Then install:

Run: `pnpm install`
Expected: completes; `vitest` resolves under `web`.

- [ ] **Step 2: Create the Vitest config** (so the `@/` alias resolves in tests)

```ts
// web/vitest.config.ts
import { defineConfig } from "vitest/config";
import { fileURLToPath } from "node:url";

export default defineConfig({
  resolve: {
    alias: {
      "@": fileURLToPath(new URL(".", import.meta.url)),
    },
  },
});
```

- [ ] **Step 3: Write the failing test**

```ts
// web/lib/rankings.test.ts
import { describe, it, expect } from "vitest";
import {
  formatAdoptionSignal,
  dedupeAndRank,
  gradeMapFromRows,
  mergeRankings,
  type JoinedScoreRow,
  type RankedServer,
  type RankingGrade,
} from "./rankings";

function joined(
  versionId: string,
  score: number,
  computedAt: string,
  server: { registry: "npm" | "pypi" | "github"; owner: string | null; name: string } | null,
): JoinedScoreRow {
  return {
    version_id: versionId,
    score,
    components: { npm_downloads_last_month: 1000 },
    computed_at: computedAt,
    versions: server ? { servers: server } : null,
  };
}

describe("formatAdoptionSignal", () => {
  it("prefers npm monthly downloads, compacted", () => {
    expect(formatAdoptionSignal({ npm_downloads_last_month: 1_200_000 })).toBe("1.2M npm/mo");
  });
  it("falls back to pypi, then stars, then dash", () => {
    expect(formatAdoptionSignal({ pypi_downloads_last_month: 340_000 })).toBe("340K pypi/mo");
    expect(formatAdoptionSignal({ gh_stars: 1500 })).toBe("1.5K ★");
    expect(formatAdoptionSignal({})).toBe("—");
  });
});

describe("dedupeAndRank", () => {
  it("dedupes by version_id (newest-first input), sorts by score desc, ranks, and limits", () => {
    const rows = [
      joined("v1", 50, "2026-06-23", { registry: "npm", owner: "@a", name: "x" }),
      joined("v1", 10, "2026-06-22", { registry: "npm", owner: "@a", name: "x" }), // stale dup
      joined("v2", 90, "2026-06-23", { registry: "npm", owner: null, name: "y" }),
      joined("v3", 70, "2026-06-23", { registry: "pypi", owner: null, name: "z" }),
    ];
    const out = dedupeAndRank(rows, 2);
    expect(out.map((r) => [r.rank, r.name])).toEqual([
      [1, "y"],
      [2, "z"],
    ]);
  });
  it("skips rows missing the server FK join rather than throwing", () => {
    const out = dedupeAndRank([joined("v1", 5, "2026-06-23", null)], 10);
    expect(out).toEqual([]);
  });
});

describe("gradeMapFromRows", () => {
  it("keeps the first (newest) published grade per target and drops invalid grades", () => {
    const map = gradeMapFromRows([
      { target: "npm/@a/x", grade: "A", c01: "pass", c02: "pass", c03: "pass" },
      { target: "npm/@a/x", grade: "F", c01: "fail", c02: "pass", c03: "pass" }, // stale
      { target: "pypi/z", grade: null, c01: null, c02: null, c03: null }, // dropped
    ]);
    expect(map.get("npm/@a/x")).toEqual({ grade: "A", c01: "pass", c02: "pass", c03: "pass" });
    expect(map.has("pypi/z")).toBe(false);
  });
});

describe("mergeRankings", () => {
  it("joins ranked servers to grades by serverKey; ungraded → null grade", () => {
    const ranked: RankedServer[] = [
      { rank: 1, registry: "npm", owner: "@a", name: "x", score: 90, components: { gh_stars: 10 } },
      { rank: 2, registry: "pypi", owner: null, name: "z", score: 80, components: {} },
    ];
    const grades = new Map<string, RankingGrade>([
      ["npm/@a/x", { grade: "A", c01: "pass", c02: "skip", c03: "pass" }],
    ]);
    const rows = mergeRankings(ranked, grades);
    expect(rows[0]).toMatchObject({ serverKey: "npm/@a/x", grade: "A", c02: "skip", adoptionSignal: "10 ★" });
    expect(rows[1]).toMatchObject({ serverKey: "pypi/z", grade: null, adoptionSignal: "—" });
  });
});
```

- [ ] **Step 4: Run the test to verify it fails**

Run: `pnpm --filter ./web test`
Expected: FAIL — `Cannot find module './rankings'` (the module doesn't exist yet).

- [ ] **Step 5: Implement `web/lib/rankings.ts`**

```ts
// web/lib/rankings.ts
import type { SupabaseClient } from "@supabase/supabase-js";
import { serverKey } from "@/lib/identity";
import type { LitmusGrade } from "@/lib/hostedGrades";

export type Registry = "npm" | "pypi" | "github";

/** The subset of adoption_scores.components we render. */
export interface RankingComponents {
  npm_downloads_last_month?: number | null;
  pypi_downloads_last_month?: number | null;
  gh_stars?: number | null;
  [key: string]: unknown;
}

export interface RankedServer {
  rank: number;
  registry: Registry;
  owner: string | null;
  name: string;
  score: number;
  components: RankingComponents;
}

/** Shape of one adoption_scores row from the Supabase select below. */
export interface JoinedScoreRow {
  version_id: string;
  score: string | number;
  components: RankingComponents;
  computed_at: string;
  versions: {
    servers: { registry: Registry; owner: string | null; name: string } | null;
  } | null;
}

export interface RankingGrade {
  grade: LitmusGrade;
  c01: string | null;
  c02: string | null;
  c03: string | null;
}

export interface RankingRow {
  rank: number;
  serverKey: string;
  registry: Registry;
  adoptionSignal: string;
  grade: LitmusGrade | null;
  c01: string | null;
  c02: string | null;
  c03: string | null;
}

const VALID_GRADES = new Set(["A", "B", "C", "D", "F"]);
const compact = new Intl.NumberFormat("en", { notation: "compact", maximumFractionDigits: 1 });

/** Human adoption signal: npm monthly, else PyPI monthly, else GitHub stars, else "—". */
export function formatAdoptionSignal(c: RankingComponents): string {
  if (typeof c.npm_downloads_last_month === "number" && c.npm_downloads_last_month > 0) {
    return `${compact.format(c.npm_downloads_last_month)} npm/mo`;
  }
  if (typeof c.pypi_downloads_last_month === "number" && c.pypi_downloads_last_month > 0) {
    return `${compact.format(c.pypi_downloads_last_month)} pypi/mo`;
  }
  if (typeof c.gh_stars === "number" && c.gh_stars > 0) {
    return `${compact.format(c.gh_stars)} ★`;
  }
  return "—";
}

/** Dedupe by version (input is newest-first), sort by score desc, take top `limit`, assign rank. */
export function dedupeAndRank(rows: JoinedScoreRow[], limit: number): RankedServer[] {
  const seen = new Set<string>();
  const latest: JoinedScoreRow[] = [];
  for (const row of rows) {
    if (seen.has(row.version_id)) continue;
    seen.add(row.version_id);
    latest.push(row);
  }
  latest.sort((a, b) => Number(b.score) - Number(a.score));

  const out: RankedServer[] = [];
  for (const row of latest) {
    const s = row.versions?.servers;
    if (!s) continue; // skip rows missing the FK join rather than throwing
    out.push({
      rank: out.length + 1,
      registry: s.registry,
      owner: s.owner,
      name: s.name,
      score: Number(row.score),
      components: row.components ?? {},
    });
    if (out.length >= limit) break;
  }
  return out;
}

/** serverKey → grade detail, newest published row per target wins; invalid grades dropped. */
export function gradeMapFromRows(
  rows: Array<{
    target: string;
    grade: string | null;
    c01: string | null;
    c02: string | null;
    c03: string | null;
  }>,
): Map<string, RankingGrade> {
  const map = new Map<string, RankingGrade>();
  for (const r of rows) {
    if (map.has(r.target)) continue; // rows arrive newest-first
    if (r.grade && VALID_GRADES.has(r.grade)) {
      map.set(r.target, { grade: r.grade as LitmusGrade, c01: r.c01, c02: r.c02, c03: r.c03 });
    }
  }
  return map;
}

/** Join ranked servers to their published grades by serverKey. Pure. */
export function mergeRankings(
  ranked: RankedServer[],
  grades: Map<string, RankingGrade>,
): RankingRow[] {
  return ranked.map((r) => {
    const key = serverKey({ registry: r.registry, owner: r.owner, name: r.name });
    const g = grades.get(key) ?? null;
    return {
      rank: r.rank,
      serverKey: key,
      registry: r.registry,
      adoptionSignal: formatAdoptionSignal(r.components),
      grade: g?.grade ?? null,
      c01: g?.c01 ?? null,
      c02: g?.c02 ?? null,
      c03: g?.c03 ?? null,
    };
  });
}

// ── Impure reads (server-side; caller supplies the service-role client) ──────

/** Latest adoption_scores per version, top `limit` by score. Mirrors @polygraph/scoring readTopRanked. */
export async function fetchTopRanked(db: SupabaseClient, limit = 50): Promise<RankedServer[]> {
  const { data, error } = await db
    .from("adoption_scores")
    .select(
      "version_id, score, components, computed_at, versions:version_id(servers:server_id(registry, owner, name))",
    )
    .order("computed_at", { ascending: false })
    .limit(limit * 4);
  if (error) {
    console.warn("[rankings] adoption read soft-failed:", error.message);
    return [];
  }
  return dedupeAndRank((data ?? []) as unknown as JoinedScoreRow[], limit);
}

/** Every published registry_ref grade, keyed by versionless serverKey. */
export async function fetchPublishedGradeDetailMap(
  db: SupabaseClient,
): Promise<Map<string, RankingGrade>> {
  const { data, error } = await db
    .from("hosted_runs")
    .select("target, grade, c01, c02, c03, published_at")
    .eq("target_kind", "registry_ref")
    .eq("status", "complete")
    .not("published_at", "is", null)
    .order("published_at", { ascending: false });
  if (error) {
    console.warn("[rankings] grade read soft-failed:", error.message);
    return new Map();
  }
  return gradeMapFromRows(
    (data ?? []) as Array<{
      target: string;
      grade: string | null;
      c01: string | null;
      c02: string | null;
      c03: string | null;
    }>,
  );
}
```

- [ ] **Step 6: Run the test to verify it passes**

Run: `pnpm --filter ./web test`
Expected: PASS — all four describe blocks green.

- [ ] **Step 7: Commit**

```bash
git add web/package.json web/vitest.config.ts web/lib/rankings.ts web/lib/rankings.test.ts pnpm-lock.yaml
git commit -m "feat(web): rankings join helpers + adoption/grade reads (with tests)"
```

### Task 3: The `/rankings` page + nav

**Files:**
- Create: `web/app/rankings/page.tsx`
- Modify: `web/app/_components/SiteHeader.tsx` (add the nav entry)

**Interfaces:**
- Consumes: `getSupabaseAdmin()` from `web/lib/supabase.ts` (returns `SupabaseClient | null`), `fetchTopRanked`/`fetchPublishedGradeDetailMap`/`mergeRankings`/`RankingRow` from `web/lib/rankings.ts`, `GRADE_HEX`/`UNRATED_HEX` from `web/lib/gradeColors.ts`.

- [ ] **Step 1: Create the page**

```tsx
// web/app/rankings/page.tsx
import type { Metadata } from "next";
import Link from "next/link";
import { getSupabaseAdmin } from "@/lib/supabase";
import { GRADE_HEX, UNRATED_HEX } from "@/lib/gradeColors";
import {
  fetchTopRanked,
  fetchPublishedGradeDetailMap,
  mergeRankings,
  type RankingRow,
} from "@/lib/rankings";

export const metadata: Metadata = {
  title: "The MCP Security Index",
  description:
    "The most-adopted MCP servers, ranked by adoption and graded for behavior with the open litmus harness. A grade is a measurement, not a guarantee — re-run it yourself.",
  alternates: { canonical: "/rankings" },
};

// Re-render at most every 10 min; a fresh score run or regrade surfaces within the window.
export const revalidate = 600;

const TOP_N = 50;

function statusColor(status: string | null): string {
  if (status === "pass") return GRADE_HEX.A;
  if (!status || status.startsWith("skip")) return "var(--color-ink-faint)";
  return "var(--color-oxblood)";
}

export default async function RankingsPage() {
  const db = getSupabaseAdmin();
  let rows: RankingRow[] = [];
  if (db) {
    const [ranked, grades] = await Promise.all([
      fetchTopRanked(db, TOP_N),
      fetchPublishedGradeDetailMap(db),
    ]);
    rows = mergeRankings(ranked, grades);
  }
  const gradedCount = rows.filter((r) => r.grade !== null).length;

  return (
    <main className="flex-1">
      <article className="mx-auto max-w-4xl px-6 pt-14 pb-24 md:pt-20 md:pb-32">
        <header className="mb-12">
          <p className="section-label mb-4">Index · litmus-v6 · adoption-ranked</p>
          <h1 className="font-serif text-4xl md:text-5xl text-ink tracking-tight leading-[1.05]">
            The MCP Security Index
          </h1>
          <p className="mt-5 font-serif italic text-ink-muted text-lg md:text-xl leading-snug max-w-2xl">
            The most-adopted MCP servers, ordered by adoption and graded for
            behavior — what each server <em>does</em> when exercised the way an
            agent would.
          </p>
          <p className="mt-4 max-w-2xl text-ink-muted leading-relaxed text-sm">
            {rows.length > 0 ? (
              <>
                {gradedCount} of the top {rows.length} graded. A grade is a
                measurement, not a guarantee; every grade links to a report you
                can re-run yourself.
              </>
            ) : (
              <>Rankings are being computed. Check back shortly.</>
            )}
          </p>
        </header>

        {rows.length > 0 ? (
          <div className="overflow-x-auto">
            <table className="w-full border-collapse font-mono text-[12.5px]">
              <thead>
                <tr className="border-b hairline text-ink-faint text-left">
                  <th className="py-2 pr-3 font-normal w-10">#</th>
                  <th className="py-2 pr-4 font-normal">Server</th>
                  <th className="py-2 pr-4 font-normal">Adoption</th>
                  <th className="py-2 pr-4 font-normal">Grade</th>
                  <th className="py-2 font-normal">C-01 · C-02 · C-03</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((row) => (
                  <tr key={row.serverKey} className="border-b hairline align-baseline">
                    <td className="py-3 pr-3 tabular text-ink-faint">{row.rank}</td>
                    <td className="py-3 pr-4">
                      <Link
                        href={`/mcp/${row.serverKey}`}
                        className="text-ink hover:text-oxblood transition-colors break-all"
                      >
                        {row.serverKey}
                      </Link>
                    </td>
                    <td className="py-3 pr-4 tabular text-ink-muted whitespace-nowrap">
                      {row.adoptionSignal}
                    </td>
                    <td className="py-3 pr-4">
                      {row.grade ? (
                        <span
                          className="font-serif text-base"
                          style={{ color: GRADE_HEX[row.grade] }}
                          aria-label={`Grade ${row.grade}`}
                        >
                          {row.grade}
                        </span>
                      ) : (
                        <Link
                          href="/request"
                          className="hover:text-oxblood transition-colors"
                          style={{ color: UNRATED_HEX }}
                        >
                          request
                        </Link>
                      )}
                    </td>
                    <td className="py-3">
                      {row.grade ? (
                        <span className="flex gap-2">
                          {[row.c01, row.c02, row.c03].map((s, i) => (
                            <span
                              key={i}
                              aria-label={s ?? "n/a"}
                              title={s ?? "n/a"}
                              className="inline-block w-2.5 h-2.5"
                              style={{ backgroundColor: statusColor(s) }}
                            />
                          ))}
                        </span>
                      ) : (
                        <Link
                          href={`/notify?for=${row.serverKey}`}
                          className="text-ink-faint hover:text-oxblood transition-colors"
                        >
                          notify me
                        </Link>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : null}

        <p className="mt-10 text-ink-faint text-xs leading-relaxed max-w-2xl">
          Ordering is by adoption (npm / PyPI / GitHub signals), not by grade.
          Grades come from the open litmus harness; ungraded popular servers can
          be requested. See the{" "}
          <Link href="/methodology" className="border-b hairline border-dotted hover:text-oxblood">
            methodology
          </Link>
          .
        </p>
      </article>
    </main>
  );
}
```

- [ ] **Step 2: Add `/rankings` to the site nav**

In `web/app/_components/SiteHeader.tsx`, add an entry to the `NAV` array (place it first so the Index is prominent):

```tsx
const NAV: Array<{ href: string; label: string }> = [
  { href: "/rankings", label: "Index" },
  { href: "/#install", label: "Install" },
  { href: "/#checks", label: "Checks" },
  { href: "/#badge", label: "Get a badge" },
  { href: "/request", label: "Request" },
  { href: "/methodology", label: "Methodology" },
];
```

- [ ] **Step 3: Verify the build type-checks and the page renders**

Run: `pnpm --filter ./web build`
Expected: build succeeds (Next type-checks during build). The `/rankings` route appears in the build output's route list.

- [ ] **Step 4: Manual visual check**

Run: `pnpm --filter ./web dev`, open `http://localhost:3000/rankings`.
Expected (with Supabase env set and data present): a preprint-style table — rank, server (links to `/mcp/<key>`), adoption signal, grade letter in grade color (or "request" for ungraded), three category swatches (or "notify me"). With no env: the "Rankings are being computed" empty state, no crash.

- [ ] **Step 5: Commit**

```bash
git add web/app/rankings/page.tsx web/app/_components/SiteHeader.tsx
git commit -m "feat(web): the MCP Security Index page at /rankings + nav entry"
```

### Task 4: Page-level OG image

**Files:**
- Create: `web/app/rankings/opengraph-image.tsx`

**Interfaces:**
- Consumes: `Frame`, `OG_SIZE`, `OG_CONTENT_TYPE`, `OG_COLORS` from `web/app/_og/Frame.tsx`; `ogFonts` from `web/app/_og/fonts.ts`. Mirrors `web/app/opengraph-image.tsx`.

- [ ] **Step 1: Create the OG image route**

```tsx
// web/app/rankings/opengraph-image.tsx
import { ImageResponse } from "next/og";
import { Frame, OG_SIZE, OG_CONTENT_TYPE, OG_COLORS as C } from "../_og/Frame";
import { ogFonts } from "../_og/fonts";

export const alt = "The MCP Security Index — most-adopted MCP servers, graded for behavior";
export const size = OG_SIZE;
export const contentType = OG_CONTENT_TYPE;

export default async function Image() {
  return new ImageResponse(
    (
      <Frame rightLabel="MCP SECURITY INDEX">
        <div style={{ display: "flex", flexDirection: "column" }}>
          <div
            style={{
              display: "flex",
              fontFamily: "Source Serif 4",
              fontWeight: 600,
              fontSize: 84,
              letterSpacing: -2,
              color: C.ink,
            }}
          >
            The MCP Security Index
          </div>
          <div
            style={{
              display: "flex",
              marginTop: 22,
              fontFamily: "Source Serif 4",
              fontWeight: 400,
              fontSize: 36,
              lineHeight: 1.22,
              color: C.muted,
            }}
          >
            Most-adopted MCP servers, graded for behavior.
          </div>
        </div>
      </Frame>
    ),
    { ...size, fonts: await ogFonts() },
  );
}
```

- [ ] **Step 2: Verify it builds and renders**

Run: `pnpm --filter ./web build`
Expected: build succeeds; `/rankings/opengraph-image` appears as a generated route.
Manual: with `pnpm --filter ./web dev`, open `http://localhost:3000/rankings/opengraph-image` — a 1200×630 parchment card with the title and the signature waveform.

- [ ] **Step 3: Commit**

```bash
git add web/app/rankings/opengraph-image.tsx
git commit -m "feat(web): /rankings open-graph card"
```

---

## Self-review notes (resolved during planning)

- **Spec coverage:** WS-A → Task 1 + README (Step 6). WS-B → Runbook A2. WS-C → Task 3 (page) on Task 2 (reads/join). WS-D shareability → Task 4 (page OG); per-report OG + share buttons are a deliberate fast-follow, out of this plan. WS-E demand capture → the ungraded-row CTAs in Task 3 Step 1 (`/request`, `/notify?for=`). WS-F (onchain) → out of scope by decision.
- **Type consistency:** `serverKey`, `LitmusGrade`, `GRADE_HEX`, `UNRATED_HEX`, `getSupabaseAdmin` all match the verbatim signatures in the existing code. `RankingRow`/`RankedServer`/`RankingGrade` are defined in Task 2 and consumed unchanged in Task 3.
- **Known follow-ups (not in this plan):** "recently graded" / "biggest movers" strips; per-category and comparison views; per-`/mcp/[ref]` OG + share buttons; live registry-sync to grow the seed beyond 78; promoting the score cron to the AWS box if the universe outgrows the daily Actions window.
