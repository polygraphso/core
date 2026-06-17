# On-chain Grade Attestations (Base / EAS) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Let an operator publish each polygraph grade as a tamper-proof, composable on-chain EAS attestation on Base from an admin button, with a public version-pinned evidence page that the attestation links to.

**Architecture:** A small `web/lib/attestations/` module owns chain config, schema encoding, the EAS client, and the Supabase `grade_attestations` store. An env-token-gated `/admin/attestations` page lists published grades and POSTs to `/api/admin/attestations`, which re-reads the grade server-side, computes a canonical `evidenceHash`, signs with a server hot wallet, submits to EAS, and records the result. A public `/grade/[...slug]` page renders the grade evidence and links to the on-chain attestation.

**Tech Stack:** Next.js 16 (App Router, async params), TypeScript, Supabase (service-role, server-only), `@ethereum-attestation-service/eas-sdk` + `ethers` v6, EAS on Base. Unit tests via `vitest`. One-off schema registration via `tsx`.

---

## Conventions for this plan

- All commands run from `web/` unless stated. Package manager is **pnpm**.
- This Next.js version uses **async** `params`/`searchParams` (`await params`) — see the existing `web/app/blog/[slug]/page.tsx` for the pattern. Per `web/AGENTS.md`, consult `node_modules/next/dist/docs/` before inventing any Next API.
- Per-task quick typecheck: `npx tsc --noEmit`. Full check (also typechecks): `pnpm build`.
- Commit after every task.

## File structure (created/modified)

- Create `web/lib/attestations/schema.ts` — the single canonical schema string.
- Create `web/lib/attestations/chains.ts` — per-chain EAS config + URL helpers (pure).
- Create `web/lib/attestations/encode.ts` — canonical serialize, `evidenceHash`, `evidenceURI`, field assembly + EAS encoding (pure).
- Create `web/lib/attestations/eas.ts` — EAS client: `attestGrade` (chain I/O).
- Create `web/lib/attestations/store.ts` — `grade_attestations` reads/writes + pure join helper.
- Create `web/db/grade_attestations.sql` — table DDL (run manually in Supabase).
- Create `web/scripts/register-schema.ts` — one-off schema registration.
- Create `web/middleware.ts` — env-token gate for `/admin/*` and `/api/admin/*`.
- Create `web/app/admin/login/page.tsx` + `web/app/api/admin/login/route.ts` — login.
- Create `web/app/admin/attestations/page.tsx` + `web/app/admin/attestations/AttestButton.tsx` — admin UI.
- Create `web/app/api/admin/attestations/route.ts` — the attestation orchestration.
- Create `web/app/grade/[...slug]/page.tsx` + `web/app/grade/[...slug]/not-found.tsx` — public evidence page.
- Create `web/vitest.config.ts`; modify `web/package.json` (deps + `test` script).
- Modify `web/.env.example` (or create) to document new env vars.

---

## Task 1: Tooling — deps + vitest

**Files:**
- Modify: `web/package.json`
- Create: `web/vitest.config.ts`

- [ ] **Step 1: Install runtime + dev deps**

Run:
```bash
pnpm add @ethereum-attestation-service/eas-sdk ethers
pnpm add -D vitest tsx
```
Expected: installs succeed; `ethers` resolves to v6.x (peer of eas-sdk).

- [ ] **Step 2: Add the test script**

In `web/package.json`, add to `"scripts"`:
```json
"test": "vitest run"
```

- [ ] **Step 3: Create the vitest config (so `@/` imports resolve)**

Create `web/vitest.config.ts`:
```ts
import { defineConfig } from "vitest/config";
import { resolve } from "node:path";

export default defineConfig({
  test: { environment: "node" },
  resolve: { alias: { "@": resolve(__dirname, ".") } },
});
```

- [ ] **Step 4: Verify the runner works (no tests yet is fine)**

Run: `pnpm vitest run`
Expected: exits 0 with "No test files found" (or similar). Not an error.

- [ ] **Step 5: Commit**

```bash
git add web/package.json web/pnpm-lock.yaml web/vitest.config.ts
git commit -m "chore: add eas-sdk, ethers, vitest, tsx tooling"
```

---

## Task 2: Canonical schema string

**Files:**
- Create: `web/lib/attestations/schema.ts`

- [ ] **Step 1: Write the schema constant**

Create `web/lib/attestations/schema.ts`:
```ts
/**
 * The EAS schema for polygraph grade attestations. This EXACT string is used
 * both to register the schema on-chain (scripts/register-schema.ts) and to
 * encode each attestation (encode.ts). It must never drift between the two.
 */
export const GRADE_SCHEMA =
  "string server,string version,string grade,string methodologyVersion,string toolDefsFingerprint,bytes32 evidenceHash,string evidenceURI,uint64 issuedAt";
```

- [ ] **Step 2: Typecheck**

Run: `npx tsc --noEmit`
Expected: PASS (no errors).

- [ ] **Step 3: Commit**

```bash
git add web/lib/attestations/schema.ts
git commit -m "feat: add canonical EAS grade schema string"
```

---

## Task 3: Chain config (pure)

**Files:**
- Create: `web/lib/attestations/chains.ts`
- Test: `web/lib/attestations/chains.test.ts`

- [ ] **Step 1: Write the failing test**

Create `web/lib/attestations/chains.test.ts`:
```ts
import { describe, it, expect } from "vitest";
import { getChainConfig, attestationUrl } from "./chains";

describe("getChainConfig", () => {
  it("returns Base mainnet config", () => {
    const c = getChainConfig("base");
    expect(c.chainId).toBe(8453);
    expect(c.easContract).toBe("0x4200000000000000000000000000000000000021");
    expect(c.schemaRegistry).toBe("0x4200000000000000000000000000000000000020");
    expect(c.easscanBase).toBe("https://base.easscan.org");
  });

  it("returns Base Sepolia config", () => {
    const c = getChainConfig("base-sepolia");
    expect(c.chainId).toBe(84532);
    expect(c.easscanBase).toBe("https://base-sepolia.easscan.org");
  });

  it("throws on unknown chain", () => {
    expect(() => getChainConfig("ethereum")).toThrow();
  });
});

describe("attestationUrl", () => {
  it("builds an easscan attestation URL", () => {
    const c = getChainConfig("base");
    expect(attestationUrl(c, "0xabc")).toBe(
      "https://base.easscan.org/attestation/view/0xabc",
    );
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm vitest run chains`
Expected: FAIL — cannot find module `./chains`.

- [ ] **Step 3: Write the implementation**

Create `web/lib/attestations/chains.ts`:
```ts
/**
 * Per-chain EAS deployment config. EAS + SchemaRegistry share the same
 * predeploy addresses on both Base networks (OP-stack predeploys).
 * Verified against docs.attest.org/docs/quick--start/contracts.
 */
export type EasChain = "base" | "base-sepolia";

export interface ChainConfig {
  chain: EasChain;
  chainId: number;
  easContract: string;
  schemaRegistry: string;
  easscanBase: string;
}

const CONFIGS: Record<EasChain, ChainConfig> = {
  base: {
    chain: "base",
    chainId: 8453,
    easContract: "0x4200000000000000000000000000000000000021",
    schemaRegistry: "0x4200000000000000000000000000000000000020",
    easscanBase: "https://base.easscan.org",
  },
  "base-sepolia": {
    chain: "base-sepolia",
    chainId: 84532,
    easContract: "0x4200000000000000000000000000000000000021",
    schemaRegistry: "0x4200000000000000000000000000000000000020",
    easscanBase: "https://base-sepolia.easscan.org",
  },
};

/** Resolve the active chain config. Defaults to `base` (mainnet) in prod. */
export function getChainConfig(name: string = process.env.EAS_CHAIN ?? "base"): ChainConfig {
  const cfg = CONFIGS[name as EasChain];
  if (!cfg) {
    throw new Error(`Unknown EAS_CHAIN "${name}" (expected "base" or "base-sepolia")`);
  }
  return cfg;
}

/** Public easscan link for a given attestation UID. */
export function attestationUrl(cfg: ChainConfig, uid: string): string {
  return `${cfg.easscanBase}/attestation/view/${uid}`;
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm vitest run chains`
Expected: PASS (4 tests).

- [ ] **Step 5: Commit**

```bash
git add web/lib/attestations/chains.ts web/lib/attestations/chains.test.ts
git commit -m "feat: add EAS chain config for Base"
```

---

## Task 4: Canonical evidence hashing (pure)

**Files:**
- Create: `web/lib/attestations/encode.ts` (first slice: canonicalize + evidenceHash)
- Test: `web/lib/attestations/encode.test.ts`

- [ ] **Step 1: Write the failing test**

Create `web/lib/attestations/encode.test.ts`:
```ts
import { describe, it, expect } from "vitest";
import { canonicalize, evidenceHash } from "./encode";

describe("canonicalize", () => {
  it("sorts object keys deterministically regardless of input order", () => {
    expect(canonicalize({ b: 1, a: 2 })).toBe(canonicalize({ a: 2, b: 1 }));
  });

  it("recurses into nested objects and arrays", () => {
    const out = canonicalize({ z: [{ y: 1, x: 2 }], a: "v" });
    expect(out).toBe('{"a":"v","z":[{"x":2,"y":1}]}');
  });

  it("omits undefined-valued keys", () => {
    expect(canonicalize({ a: 1, b: undefined })).toBe('{"a":1}');
  });
});

describe("evidenceHash", () => {
  it("is stable for key-reordered equivalents", () => {
    expect(evidenceHash({ a: 1, b: 2 })).toBe(evidenceHash({ b: 2, a: 1 }));
  });

  it("is a 0x-prefixed 32-byte keccak hash", () => {
    const h = evidenceHash({ a: 1 });
    expect(h).toMatch(/^0x[0-9a-f]{64}$/);
  });

  it("changes when content changes", () => {
    expect(evidenceHash({ a: 1 })).not.toBe(evidenceHash({ a: 2 }));
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm vitest run encode`
Expected: FAIL — cannot find module `./encode`.

- [ ] **Step 3: Write the implementation**

Create `web/lib/attestations/encode.ts`:
```ts
import { keccak256, toUtf8Bytes } from "ethers";

/**
 * Deterministic JSON serialization: object keys sorted, undefined values
 * dropped, arrays preserved in order. Two structurally-equal objects always
 * produce the same string, so keccak256 over it is a stable content hash.
 */
export function canonicalize(value: unknown): string {
  if (value === null || typeof value !== "object") {
    return JSON.stringify(value);
  }
  if (Array.isArray(value)) {
    return `[${value.map(canonicalize).join(",")}]`;
  }
  const obj = value as Record<string, unknown>;
  const entries = Object.keys(obj)
    .sort()
    .filter((k) => obj[k] !== undefined)
    .map((k) => `${JSON.stringify(k)}:${canonicalize(obj[k])}`);
  return `{${entries.join(",")}}`;
}

/** keccak256 of the canonical serialization of the evidence bundle. */
export function evidenceHash(evidence: unknown): string {
  return keccak256(toUtf8Bytes(canonicalize(evidence ?? {})));
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm vitest run encode`
Expected: PASS (6 tests).

- [ ] **Step 5: Commit**

```bash
git add web/lib/attestations/encode.ts web/lib/attestations/encode.test.ts
git commit -m "feat: add canonical evidence hashing"
```

---

## Task 5: Evidence URI builder (pure)

**Files:**
- Modify: `web/lib/attestations/encode.ts`
- Modify: `web/lib/attestations/encode.test.ts`

- [ ] **Step 1: Add the failing test**

Append to `web/lib/attestations/encode.test.ts`:
```ts
import { evidenceURI } from "./encode";

describe("evidenceURI", () => {
  it("builds a version-pinned URL", () => {
    expect(evidenceURI("npm/@scope/pkg", "1.2.3")).toBe(
      "https://polygraph.so/grade/npm/@scope/pkg?v=1.2.3",
    );
  });

  it("omits ?v when there is no resolved version", () => {
    expect(evidenceURI("github/owner/repo", null)).toBe(
      "https://polygraph.so/grade/github/owner/repo",
    );
  });

  it("encodes special characters in the version", () => {
    expect(evidenceURI("pypi/pkg", "1.0+local")).toBe(
      "https://polygraph.so/grade/pypi/pkg?v=1.0%2Blocal",
    );
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm vitest run encode`
Expected: FAIL — `evidenceURI` is not exported.

- [ ] **Step 3: Implement**

Append to `web/lib/attestations/encode.ts`:
```ts
/** Canonical public site origin used for evidence URIs. */
const SITE_URL = "https://polygraph.so";

/**
 * Version-pinned public evidence page URL for a grade. The server key forms
 * the path (slashes preserved); the resolved version is a query param so the
 * URL is immutable for the attested grade. Null version → no `?v`.
 */
export function evidenceURI(serverKey: string, version: string | null): string {
  const base = `${SITE_URL}/grade/${serverKey}`;
  return version ? `${base}?v=${encodeURIComponent(version)}` : base;
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm vitest run encode`
Expected: PASS (9 tests).

- [ ] **Step 5: Commit**

```bash
git add web/lib/attestations/encode.ts web/lib/attestations/encode.test.ts
git commit -m "feat: add version-pinned evidence URI builder"
```

---

## Task 6: Field assembly + EAS encoding (pure)

**Files:**
- Modify: `web/lib/attestations/encode.ts`
- Modify: `web/lib/attestations/encode.test.ts`

Reuses `detailFromRow` and `HostedGradeRow` from `web/lib/hostedGrades.ts` so attested values match exactly what the site/CLI show.

- [ ] **Step 1: Add the failing test**

Append to `web/lib/attestations/encode.test.ts`:
```ts
import { SchemaEncoder } from "@ethereum-attestation-service/eas-sdk";
import { buildFields, encodeFields } from "./encode";
import { GRADE_SCHEMA } from "./schema";
import type { HostedGradeRow } from "@/lib/hostedGrades";

const ROW: HostedGradeRow & { id: number } = {
  id: 7,
  target: "npm/some-mcp",
  target_kind: "registry_ref",
  grade: "B",
  rationale: "ok",
  evidence: {
    resolvedVersion: "2.1.0",
    methodologyVersion: "litmus-v1",
    toolDefsFingerprint: "fp123",
    categories: [],
  },
  tool_defs_fingerprint: "fp123",
  c01: null,
  c02: null,
  c03: null,
  published_at: "2026-01-02T00:00:00.000Z",
};

describe("buildFields", () => {
  it("maps a hosted_runs row into attestation fields", () => {
    const f = buildFields(ROW)!;
    expect(f.server).toBe("npm/some-mcp");
    expect(f.version).toBe("2.1.0");
    expect(f.grade).toBe("B");
    expect(f.methodologyVersion).toBe("litmus-v1");
    expect(f.toolDefsFingerprint).toBe("fp123");
    expect(f.evidenceURI).toBe("https://polygraph.so/grade/npm/some-mcp?v=2.1.0");
    expect(f.evidenceHash).toMatch(/^0x[0-9a-f]{64}$/);
    expect(f.issuedAt).toBe(BigInt(Date.parse("2026-01-02T00:00:00.000Z") / 1000));
  });

  it("returns null when the row has no valid grade", () => {
    expect(buildFields({ ...ROW, grade: null })).toBeNull();
  });

  it("uses empty string for an unresolved version", () => {
    const f = buildFields({ ...ROW, evidence: { ...ROW.evidence, resolvedVersion: null } })!;
    expect(f.version).toBe("");
    expect(f.evidenceURI).toBe("https://polygraph.so/grade/npm/some-mcp");
  });
});

describe("encodeFields", () => {
  it("produces EAS data that round-trips through the schema decoder", () => {
    const f = buildFields(ROW)!;
    const encoded = encodeFields(f);
    const decoded = new SchemaEncoder(GRADE_SCHEMA).decodeData(encoded);
    const byName = Object.fromEntries(decoded.map((d) => [d.name, d.value.value]));
    expect(byName.server).toBe("npm/some-mcp");
    expect(byName.grade).toBe("B");
    expect(String(byName.issuedAt)).toBe(String(f.issuedAt));
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm vitest run encode`
Expected: FAIL — `buildFields`/`encodeFields` not exported.

- [ ] **Step 3: Implement**

Append to `web/lib/attestations/encode.ts`:
```ts
import { SchemaEncoder } from "@ethereum-attestation-service/eas-sdk";
import { detailFromRow, type HostedGradeRow } from "@/lib/hostedGrades";
import { GRADE_SCHEMA } from "./schema";

export interface GradeAttestationFields {
  server: string;
  version: string;
  grade: string;
  methodologyVersion: string;
  toolDefsFingerprint: string;
  evidenceHash: string;
  evidenceURI: string;
  issuedAt: bigint;
}

/**
 * Build attestation fields from a published hosted_runs row. Returns null if
 * the row carries no valid grade. Value resolution (bundle-vs-column fallback)
 * is delegated to detailFromRow so attested values equal site/CLI values.
 */
export function buildFields(row: HostedGradeRow): GradeAttestationFields | null {
  const resolved = detailFromRow(row);
  if (!resolved) return null;
  const { detail } = resolved;
  const issuedAt = row.published_at
    ? BigInt(Math.floor(Date.parse(row.published_at) / 1000))
    : 0n;
  return {
    server: row.target,
    version: detail.resolved_version ?? "",
    grade: detail.grade,
    methodologyVersion: detail.methodology_version,
    toolDefsFingerprint: detail.tool_defs_fingerprint ?? "",
    evidenceHash: evidenceHash(row.evidence ?? {}),
    evidenceURI: evidenceURI(row.target, detail.resolved_version),
    issuedAt,
  };
}

/** ABI-encode the fields for an EAS attestation, per GRADE_SCHEMA. */
export function encodeFields(f: GradeAttestationFields): string {
  const encoder = new SchemaEncoder(GRADE_SCHEMA);
  return encoder.encodeData([
    { name: "server", value: f.server, type: "string" },
    { name: "version", value: f.version, type: "string" },
    { name: "grade", value: f.grade, type: "string" },
    { name: "methodologyVersion", value: f.methodologyVersion, type: "string" },
    { name: "toolDefsFingerprint", value: f.toolDefsFingerprint, type: "string" },
    { name: "evidenceHash", value: f.evidenceHash, type: "bytes32" },
    { name: "evidenceURI", value: f.evidenceURI, type: "string" },
    { name: "issuedAt", value: f.issuedAt, type: "uint64" },
  ]);
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm vitest run encode`
Expected: PASS (all encode tests, including the 4 new ones).

- [ ] **Step 5: Commit**

```bash
git add web/lib/attestations/encode.ts web/lib/attestations/encode.test.ts
git commit -m "feat: assemble and EAS-encode grade attestation fields"
```

---

## Task 7: Database table

**Files:**
- Create: `web/db/grade_attestations.sql`

`hosted_run_id` is stored as `text` (no FK) so it works regardless of whether `hosted_runs.id` is `bigint` or `uuid`; we only ever look it up by equality.

- [ ] **Step 1: Write the DDL**

Create `web/db/grade_attestations.sql`:
```sql
-- Run once in the Supabase SQL editor (and once per environment/project).
-- Records each on-chain EAS attestation attempt for a published grade.
create table if not exists grade_attestations (
  id                bigint generated always as identity primary key,
  hosted_run_id     text        not null,
  server            text        not null,
  version           text        not null default '',
  grade             text        not null,
  schema_uid        text        not null,
  attestation_uid   text,
  tx_hash           text,
  chain_id          integer     not null,
  attester_address  text,
  evidence_hash     text        not null,
  status            text        not null default 'pending',  -- pending | confirmed | failed
  error             text,
  created_at        timestamptz not null default now(),
  confirmed_at      timestamptz
);

create index if not exists grade_attestations_run_idx
  on grade_attestations (hosted_run_id);
create index if not exists grade_attestations_server_version_idx
  on grade_attestations (server, version);
```

- [ ] **Step 2: Apply it**

In the Supabase dashboard → SQL editor, paste and run the file contents.
Expected: "Success. No rows returned." Verify the table exists under Table editor.

- [ ] **Step 3: Commit**

```bash
git add web/db/grade_attestations.sql
git commit -m "feat: add grade_attestations table DDL"
```

---

## Task 8: Attestation store + join helper

**Files:**
- Create: `web/lib/attestations/store.ts`
- Test: `web/lib/attestations/store.test.ts` (covers only the pure join helper)

- [ ] **Step 1: Write the failing test for the pure join helper**

Create `web/lib/attestations/store.test.ts`:
```ts
import { describe, it, expect } from "vitest";
import { joinRunsWithAttestations } from "./store";

const runs = [
  { id: 1, target: "npm/a", grade: "A", evidence: { resolvedVersion: "1.0.0" } },
  { id: 2, target: "npm/b", grade: "C", evidence: { resolvedVersion: null } },
];

describe("joinRunsWithAttestations", () => {
  it("marks runs with no attestation as 'none'", () => {
    const out = joinRunsWithAttestations(runs, []);
    expect(out[0]).toMatchObject({ hosted_run_id: "1", server: "npm/a", version: "1.0.0", grade: "A", status: "none" });
    expect(out[1].version).toBe("");
  });

  it("attaches the most recent attestation per run", () => {
    const atts = [
      { hosted_run_id: "1", status: "confirmed", attestation_uid: "0xnew", error: null },
      { hosted_run_id: "1", status: "failed", attestation_uid: null, error: "old" },
    ];
    const out = joinRunsWithAttestations(runs, atts);
    expect(out[0]).toMatchObject({ status: "confirmed", attestation_uid: "0xnew" });
  });
});
```
(The store list/query passes attestations already ordered `created_at` DESC, so the first seen per run is the most recent.)

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm vitest run store`
Expected: FAIL — cannot find module `./store`.

- [ ] **Step 3: Implement the store**

Create `web/lib/attestations/store.ts`:
```ts
import type { SupabaseClient } from "@supabase/supabase-js";

export interface AttestationRow {
  id: number;
  hosted_run_id: string;
  server: string;
  version: string;
  grade: string;
  schema_uid: string;
  attestation_uid: string | null;
  tx_hash: string | null;
  chain_id: number;
  attester_address: string | null;
  evidence_hash: string;
  status: "pending" | "confirmed" | "failed";
  error: string | null;
  created_at: string;
  confirmed_at: string | null;
}

export interface AdminRow {
  hosted_run_id: string;
  server: string;
  version: string;
  grade: string;
  status: "none" | "pending" | "confirmed" | "failed";
  attestation_uid: string | null;
  error: string | null;
}

interface RunLite {
  id: number | string;
  target: string;
  grade: string | null;
  evidence: { resolvedVersion?: string | null } | null;
}

/** Pure join: pair each published run with its most-recent attestation row.
 *  `atts` MUST be ordered created_at DESC (first seen per run wins). */
export function joinRunsWithAttestations(
  runs: RunLite[],
  atts: Array<Pick<AttestationRow, "hosted_run_id" | "status" | "attestation_uid" | "error">>,
): AdminRow[] {
  const latest = new Map<string, (typeof atts)[number]>();
  for (const a of atts) {
    const k = String(a.hosted_run_id);
    if (!latest.has(k)) latest.set(k, a);
  }
  return runs.map((r) => {
    const a = latest.get(String(r.id));
    return {
      hosted_run_id: String(r.id),
      server: r.target,
      version: r.evidence?.resolvedVersion ?? "",
      grade: r.grade ?? "?",
      status: a?.status ?? "none",
      attestation_uid: a?.attestation_uid ?? null,
      error: a?.error ?? null,
    };
  });
}

const TABLE = "grade_attestations";

/** Existing CONFIRMED attestation for a run, if any (idempotency guard). */
export async function findConfirmed(
  db: SupabaseClient,
  hostedRunId: string,
): Promise<AttestationRow | null> {
  const { data } = await db
    .from(TABLE)
    .select("*")
    .eq("hosted_run_id", hostedRunId)
    .eq("status", "confirmed")
    .limit(1)
    .maybeSingle();
  return (data as AttestationRow | null) ?? null;
}

/** Most-recent confirmed attestation for a (server, version) pair. */
export async function findLatestConfirmedByServerVersion(
  db: SupabaseClient,
  server: string,
  version: string,
): Promise<AttestationRow | null> {
  const { data } = await db
    .from(TABLE)
    .select("*")
    .eq("server", server)
    .eq("version", version)
    .eq("status", "confirmed")
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  return (data as AttestationRow | null) ?? null;
}

export interface InsertPendingInput {
  hosted_run_id: string;
  server: string;
  version: string;
  grade: string;
  schema_uid: string;
  chain_id: number;
  evidence_hash: string;
}

/** Insert a pending row before sending the tx; returns its id. */
export async function insertPending(
  db: SupabaseClient,
  input: InsertPendingInput,
): Promise<number> {
  const { data, error } = await db
    .from(TABLE)
    .insert({ ...input, status: "pending" })
    .select("id")
    .single();
  if (error) throw new Error(`insertPending failed: ${error.message}`);
  return (data as { id: number }).id;
}

export async function markConfirmed(
  db: SupabaseClient,
  id: number,
  fields: { attestation_uid: string; tx_hash: string; attester_address: string },
): Promise<void> {
  const { error } = await db
    .from(TABLE)
    .update({ ...fields, status: "confirmed", confirmed_at: new Date().toISOString() })
    .eq("id", id);
  if (error) throw new Error(`markConfirmed failed: ${error.message}`);
}

export async function markFailed(db: SupabaseClient, id: number, message: string): Promise<void> {
  await db.from(TABLE).update({ status: "failed", error: message.slice(0, 1000) }).eq("id", id);
}

/** Published grades joined with their latest attestation status (admin list). */
export async function listPublishedWithStatus(db: SupabaseClient): Promise<AdminRow[]> {
  const { data: runs } = await db
    .from("hosted_runs")
    .select("id, target, grade, evidence, published_at")
    .eq("status", "complete")
    .not("published_at", "is", null)
    .order("published_at", { ascending: false });
  const { data: atts } = await db
    .from(TABLE)
    .select("hosted_run_id, status, attestation_uid, error, created_at")
    .order("created_at", { ascending: false });
  return joinRunsWithAttestations(
    (runs as RunLite[]) ?? [],
    (atts as AttestationRow[]) ?? [],
  );
}
```

- [ ] **Step 4: Run test + typecheck**

Run: `pnpm vitest run store && npx tsc --noEmit`
Expected: tests PASS (3); typecheck PASS.

- [ ] **Step 5: Commit**

```bash
git add web/lib/attestations/store.ts web/lib/attestations/store.test.ts
git commit -m "feat: add grade_attestations store + join helper"
```

---

## Task 9: EAS client

**Files:**
- Create: `web/lib/attestations/eas.ts`

Chain I/O — not unit-tested; validated end-to-end on Base Sepolia in Task 14.

- [ ] **Step 1: Implement**

Create `web/lib/attestations/eas.ts`:
```ts
import { EAS } from "@ethereum-attestation-service/eas-sdk";
import { ethers } from "ethers";
import { getChainConfig } from "./chains";
import { encodeFields, type GradeAttestationFields } from "./encode";

function makeSigner(): ethers.Wallet {
  const pk = process.env.ATTESTER_PRIVATE_KEY;
  const rpc = process.env.BASE_RPC_URL;
  if (!pk || !rpc) {
    throw new Error("ATTESTER_PRIVATE_KEY and BASE_RPC_URL must be set");
  }
  const provider = new ethers.JsonRpcProvider(rpc);
  return new ethers.Wallet(pk, provider);
}

export interface AttestResult {
  uid: string;
  txHash: string;
  attester: string;
}

/** Build, sign, and submit an on-chain EAS attestation for a grade. */
export async function attestGrade(fields: GradeAttestationFields): Promise<AttestResult> {
  const schemaUid = process.env.EAS_SCHEMA_UID;
  if (!schemaUid) throw new Error("EAS_SCHEMA_UID must be set");

  const cfg = getChainConfig();
  const wallet = makeSigner();
  const eas = new EAS(cfg.easContract);
  eas.connect(wallet);

  const data = encodeFields(fields);
  const tx = await eas.attest({
    schema: schemaUid,
    data: {
      recipient: ethers.ZeroAddress,
      expirationTime: 0n,
      revocable: true,
      data,
    },
  });
  const uid = await tx.wait();
  return { uid, txHash: tx.tx.hash, attester: wallet.address };
}
```

- [ ] **Step 2: Typecheck**

Run: `npx tsc --noEmit`
Expected: PASS. (If the eas-sdk `Transaction` wrapper exposes the hash differently than `tx.tx.hash`, the compiler flags it here — adjust to the property TS reports, e.g. `tx.receipt?.hash`.)

- [ ] **Step 3: Commit**

```bash
git add web/lib/attestations/eas.ts
git commit -m "feat: add EAS attestation client"
```

---

## Task 10: Schema registration script

**Files:**
- Create: `web/scripts/register-schema.ts`

- [ ] **Step 1: Implement**

Create `web/scripts/register-schema.ts`:
```ts
/**
 * One-off: register the grade schema on the active chain and print its UID.
 * Run once per chain (Base Sepolia first, then Base mainnet) and paste the
 * printed UID into EAS_SCHEMA_UID for that environment.
 *
 *   npx tsx --env-file=.env.local scripts/register-schema.ts
 */
import { SchemaRegistry } from "@ethereum-attestation-service/eas-sdk";
import { ethers } from "ethers";
import { getChainConfig } from "../lib/attestations/chains";
import { GRADE_SCHEMA } from "../lib/attestations/schema";

async function main() {
  const pk = process.env.ATTESTER_PRIVATE_KEY;
  const rpc = process.env.BASE_RPC_URL;
  if (!pk || !rpc) throw new Error("Set ATTESTER_PRIVATE_KEY and BASE_RPC_URL");

  const cfg = getChainConfig();
  const wallet = new ethers.Wallet(pk, new ethers.JsonRpcProvider(rpc));
  console.log(`Registering on ${cfg.chain} (chainId ${cfg.chainId}) as ${wallet.address}`);

  const registry = new SchemaRegistry(cfg.schemaRegistry);
  registry.connect(wallet);

  const tx = await registry.register({
    schema: GRADE_SCHEMA,
    resolverAddress: ethers.ZeroAddress,
    revocable: true,
  });
  const uid = await tx.wait();
  console.log(`\nSchema registered. EAS_SCHEMA_UID=${uid}`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
```

- [ ] **Step 2: Typecheck**

Run: `npx tsc --noEmit`
Expected: PASS.

- [ ] **Step 3: Commit**

```bash
git add web/scripts/register-schema.ts
git commit -m "feat: add EAS schema registration script"
```

(The script is RUN later in Task 14, after the wallet is funded.)

---

## Task 11: Admin auth (middleware + login)

**Files:**
- Create: `web/middleware.ts`
- Create: `web/app/api/admin/login/route.ts`
- Create: `web/app/admin/login/page.tsx`

Single-operator gate: a correct `ADMIN_TOKEN` sets an httpOnly cookie; middleware checks it on `/admin/*` and `/api/admin/*` (except the login endpoints).

- [ ] **Step 1: Middleware**

Create `web/middleware.ts`:
```ts
import { NextResponse, type NextRequest } from "next/server";

const COOKIE = "polygraph_admin";

export function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;

  // Allow the login page and login endpoint through unauthenticated.
  if (pathname === "/admin/login" || pathname === "/api/admin/login") {
    return NextResponse.next();
  }

  const token = process.env.ADMIN_TOKEN;
  const cookie = req.cookies.get(COOKIE)?.value;
  if (token && cookie === token) {
    return NextResponse.next();
  }

  if (pathname.startsWith("/api/")) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const url = req.nextUrl.clone();
  url.pathname = "/admin/login";
  return NextResponse.redirect(url);
}

export const config = {
  matcher: ["/admin/:path*", "/api/admin/:path*"],
};
```

- [ ] **Step 2: Login route**

Create `web/app/api/admin/login/route.ts`:
```ts
const COOKIE = "polygraph_admin";

export async function POST(request: Request) {
  let body: { token?: unknown };
  try {
    body = (await request.json()) as { token?: unknown };
  } catch {
    return Response.json({ error: "Invalid JSON" }, { status: 400 });
  }
  const expected = process.env.ADMIN_TOKEN;
  if (!expected) {
    return Response.json({ error: "Admin not configured" }, { status: 503 });
  }
  if (typeof body.token !== "string" || body.token !== expected) {
    return Response.json({ error: "Invalid token" }, { status: 401 });
  }
  const res = Response.json({ ok: true });
  res.headers.set(
    "Set-Cookie",
    `${COOKIE}=${expected}; Path=/; HttpOnly; SameSite=Lax; Secure; Max-Age=604800`,
  );
  return res;
}
```

- [ ] **Step 3: Login page**

Create `web/app/admin/login/page.tsx`:
```tsx
"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export default function AdminLoginPage() {
  const [token, setToken] = useState("");
  const [err, setErr] = useState<string | null>(null);
  const router = useRouter();

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setErr(null);
    const res = await fetch("/api/admin/login", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ token }),
    });
    if (res.ok) {
      router.push("/admin/attestations");
      router.refresh();
    } else {
      const j = await res.json().catch(() => ({}));
      setErr(j.error ?? "Login failed");
    }
  }

  return (
    <main className="mx-auto max-w-sm px-6 py-24">
      <h1 className="font-serif text-2xl mb-6">Admin</h1>
      <form onSubmit={submit} className="flex flex-col gap-3">
        <input
          type="password"
          value={token}
          onChange={(e) => setToken(e.target.value)}
          placeholder="Admin token"
          className="border px-3 py-2 font-mono text-sm"
        />
        <button type="submit" className="border px-3 py-2 font-mono text-sm hover:bg-ink/5">
          Sign in
        </button>
        {err && <p className="text-oxblood text-xs">{err}</p>}
      </form>
    </main>
  );
}
```

- [ ] **Step 4: Typecheck**

Run: `npx tsc --noEmit`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add web/middleware.ts web/app/api/admin/login/route.ts web/app/admin/login/page.tsx
git commit -m "feat: add env-token admin auth (middleware + login)"
```

---

## Task 12: Attestation API route

**Files:**
- Create: `web/app/api/admin/attestations/route.ts`

- [ ] **Step 1: Implement the orchestration**

Create `web/app/api/admin/attestations/route.ts`:
```ts
import { getSupabaseAdmin } from "@/lib/supabase";
import { HOSTED_GRADE_COLUMNS, type HostedGradeRow } from "@/lib/hostedGrades";
import { buildFields } from "@/lib/attestations/encode";
import { attestGrade } from "@/lib/attestations/eas";
import { getChainConfig, attestationUrl } from "@/lib/attestations/chains";
import {
  findConfirmed,
  insertPending,
  markConfirmed,
  markFailed,
} from "@/lib/attestations/store";

export async function POST(request: Request) {
  let body: { hosted_run_id?: unknown };
  try {
    body = (await request.json()) as { hosted_run_id?: unknown };
  } catch {
    return Response.json({ error: "Invalid JSON" }, { status: 400 });
  }
  const rawId = body.hosted_run_id;
  if (typeof rawId !== "string" && typeof rawId !== "number") {
    return Response.json({ error: "hosted_run_id is required" }, { status: 400 });
  }
  const hostedRunId = String(rawId);

  const db = getSupabaseAdmin();
  if (!db) return Response.json({ error: "Database not configured" }, { status: 500 });

  if (!process.env.ATTESTER_PRIVATE_KEY || !process.env.BASE_RPC_URL || !process.env.EAS_SCHEMA_UID) {
    return Response.json({ error: "Attestation wallet not configured" }, { status: 503 });
  }
  const cfg = getChainConfig();

  // Idempotency: never double-attest a run that already has a confirmed record.
  const existing = await findConfirmed(db, hostedRunId);
  if (existing?.attestation_uid) {
    return Response.json(
      {
        status: "already",
        attestation_uid: existing.attestation_uid,
        url: attestationUrl(cfg, existing.attestation_uid),
      },
      { status: 409 },
    );
  }

  // Re-read the grade server-side; never trust client-supplied grade data.
  const { data: row, error } = await db
    .from("hosted_runs")
    .select(`id, ${HOSTED_GRADE_COLUMNS}`)
    .eq("id", hostedRunId)
    .eq("status", "complete")
    .not("published_at", "is", null)
    .maybeSingle();
  if (error || !row) {
    return Response.json({ error: "Published grade not found" }, { status: 400 });
  }

  const fields = buildFields(row as HostedGradeRow);
  if (!fields) {
    return Response.json({ error: "Row has no valid grade" }, { status: 400 });
  }

  const pendingId = await insertPending(db, {
    hosted_run_id: hostedRunId,
    server: fields.server,
    version: fields.version,
    grade: fields.grade,
    schema_uid: process.env.EAS_SCHEMA_UID,
    chain_id: cfg.chainId,
    evidence_hash: fields.evidenceHash,
  });

  try {
    const { uid, txHash, attester } = await attestGrade(fields);
    await markConfirmed(db, pendingId, {
      attestation_uid: uid,
      tx_hash: txHash,
      attester_address: attester,
    });
    return Response.json({
      status: "confirmed",
      attestation_uid: uid,
      tx_hash: txHash,
      url: attestationUrl(cfg, uid),
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    await markFailed(db, pendingId, msg);
    return Response.json({ status: "failed", error: msg }, { status: 502 });
  }
}
```

- [ ] **Step 2: Typecheck**

Run: `npx tsc --noEmit`
Expected: PASS.

- [ ] **Step 3: Commit**

```bash
git add web/app/api/admin/attestations/route.ts
git commit -m "feat: add admin attestation API route"
```

---

## Task 13: Admin attestations page + button

**Files:**
- Create: `web/app/admin/attestations/page.tsx`
- Create: `web/app/admin/attestations/AttestButton.tsx`

- [ ] **Step 1: Button (client component)**

Create `web/app/admin/attestations/AttestButton.tsx`:
```tsx
"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export function AttestButton({ hostedRunId }: { hostedRunId: string }) {
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const router = useRouter();

  async function go() {
    setBusy(true);
    setErr(null);
    try {
      const res = await fetch("/api/admin/attestations", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ hosted_run_id: hostedRunId }),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok && res.status !== 409) setErr(json.error ?? "Failed");
      router.refresh();
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Failed");
    } finally {
      setBusy(false);
    }
  }

  return (
    <span className="inline-flex items-center gap-2">
      <button
        type="button"
        disabled={busy}
        onClick={go}
        className="font-mono text-[11px] border px-2 py-1 hover:bg-ink/5 disabled:opacity-50"
      >
        {busy ? "submitting…" : "Generate & submit on-chain"}
      </button>
      {err && <span className="text-oxblood text-[11px]">{err}</span>}
    </span>
  );
}
```

- [ ] **Step 2: Page (server component)**

Create `web/app/admin/attestations/page.tsx`:
```tsx
import { getSupabaseAdmin } from "@/lib/supabase";
import { getChainConfig, attestationUrl } from "@/lib/attestations/chains";
import { listPublishedWithStatus } from "@/lib/attestations/store";
import { AttestButton } from "./AttestButton";

export const dynamic = "force-dynamic";

export default async function AdminAttestationsPage() {
  const db = getSupabaseAdmin();
  if (!db) return <main className="p-8 font-mono text-sm">Database not configured.</main>;

  const cfg = getChainConfig();
  const rows = await listPublishedWithStatus(db);

  return (
    <main className="mx-auto max-w-4xl px-6 py-12">
      <h1 className="font-serif text-3xl mb-1">Grade attestations</h1>
      <p className="font-mono text-[11px] text-ink/60 mb-8">
        Network: {cfg.chain} (chainId {cfg.chainId})
      </p>

      <table className="w-full text-sm border-collapse">
        <thead>
          <tr className="text-left border-b hairline font-mono text-[11px] uppercase tracking-wide">
            <th className="py-2 pr-3">Server</th>
            <th className="py-2 pr-3">Version</th>
            <th className="py-2 pr-3">Grade</th>
            <th className="py-2 pr-3">Status</th>
            <th className="py-2" />
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => (
            <tr key={r.hosted_run_id} className="border-b hairline align-middle">
              <td className="py-2 pr-3 font-mono text-[12px]">{r.server}</td>
              <td className="py-2 pr-3 font-mono text-[12px]">{r.version || "—"}</td>
              <td className="py-2 pr-3">{r.grade}</td>
              <td className="py-2 pr-3 text-[12px]">
                {r.status === "confirmed" && r.attestation_uid ? (
                  <a
                    className="text-oxblood underline"
                    href={attestationUrl(cfg, r.attestation_uid)}
                    target="_blank"
                    rel="noreferrer"
                  >
                    ✅ on-chain
                  </a>
                ) : r.status === "pending" ? (
                  "⏳ pending"
                ) : r.status === "failed" ? (
                  <span className="text-oxblood">failed: {r.error}</span>
                ) : (
                  "not attested"
                )}
              </td>
              <td className="py-2">
                {r.status !== "confirmed" && r.status !== "pending" && (
                  <AttestButton hostedRunId={r.hosted_run_id} />
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </main>
  );
}
```

- [ ] **Step 3: Typecheck**

Run: `npx tsc --noEmit`
Expected: PASS.

- [ ] **Step 4: Commit**

```bash
git add web/app/admin/attestations/page.tsx web/app/admin/attestations/AttestButton.tsx
git commit -m "feat: add admin attestations page + button"
```

---

## Task 14: Public per-grade evidence page

**Files:**
- Create: `web/app/grade/[...slug]/page.tsx`
- Create: `web/app/grade/[...slug]/not-found.tsx`

- [ ] **Step 1: not-found**

Create `web/app/grade/[...slug]/not-found.tsx`:
```tsx
export default function GradeNotFound() {
  return (
    <main className="mx-auto max-w-2xl px-6 py-24 text-center">
      <h1 className="font-serif text-3xl mb-3">No published grade</h1>
      <p className="text-ink/70 text-sm">
        We don&apos;t have a published polygraph grade for that server and version.
      </p>
    </main>
  );
}
```

- [ ] **Step 2: Page**

Create `web/app/grade/[...slug]/page.tsx`:
```tsx
import { notFound } from "next/navigation";
import { getSupabaseAdmin } from "@/lib/supabase";
import { fetchPublishedGrade } from "@/lib/hostedGrades";
import { getChainConfig, attestationUrl } from "@/lib/attestations/chains";
import { findLatestConfirmedByServerVersion } from "@/lib/attestations/store";

export const dynamic = "force-dynamic";

function fmtDate(iso: string | null): string {
  if (!iso) return "—";
  return new Date(iso).toLocaleDateString("en-US", {
    year: "numeric",
    month: "long",
    day: "numeric",
    timeZone: "UTC",
  });
}

export default async function GradePage({
  params,
  searchParams,
}: {
  params: Promise<{ slug: string[] }>;
  searchParams: Promise<{ v?: string }>;
}) {
  const { slug } = await params;
  const { v } = await searchParams;
  const serverKey = slug.join("/");

  const db = getSupabaseAdmin();
  if (!db) notFound();

  const result = await fetchPublishedGrade(db, serverKey, v ?? null);
  if (!result) notFound();
  const { grade, detail } = result;

  const att = await findLatestConfirmedByServerVersion(
    db,
    serverKey,
    detail.resolved_version ?? "",
  );
  const cfg = getChainConfig();

  const cats: Array<[string, string | null]> = [
    ["C-01", detail.c01],
    ["C-02", detail.c02],
    ["C-03", detail.c03],
  ];

  return (
    <main className="mx-auto max-w-3xl px-6 pt-14 pb-24">
      <p className="section-label mb-4">Polygraph grade</p>
      <h1 className="font-mono text-2xl text-ink break-all mb-1">{serverKey}</h1>
      <p className="font-mono text-xs text-ink/60 mb-8">
        version {detail.resolved_version || "—"} · methodology {detail.methodology_version} ·
        graded {fmtDate(detail.computed_at)}
      </p>

      <div className="flex items-baseline gap-4 mb-10">
        <span className="font-serif text-6xl text-oxblood">{grade}</span>
        {detail.rationale && <p className="text-ink/80 text-sm">{detail.rationale}</p>}
      </div>

      <dl className="grid grid-cols-1 gap-2 mb-10 text-sm">
        {cats.map(([code, status]) => (
          <div key={code} className="flex justify-between border-b hairline py-2">
            <dt className="font-mono text-xs">{code}</dt>
            <dd className="text-ink/80">{status ?? "—"}</dd>
          </div>
        ))}
        <div className="flex justify-between border-b hairline py-2">
          <dt className="font-mono text-xs">tool-defs fingerprint</dt>
          <dd className="font-mono text-xs text-ink/80 break-all">
            {detail.tool_defs_fingerprint ?? "—"}
          </dd>
        </div>
      </dl>

      <section className="mt-10 pt-6 border-t hairline">
        <p className="section-label mb-3">On-chain attestation</p>
        {att?.attestation_uid ? (
          <div className="text-sm">
            <p className="mb-2">
              <a
                className="text-oxblood underline"
                href={attestationUrl(cfg, att.attestation_uid)}
                target="_blank"
                rel="noreferrer"
              >
                View on {cfg.chain} EAS explorer ↗
              </a>
            </p>
            <p className="font-mono text-[11px] text-ink/60 break-all">
              attester {att.attester_address}
            </p>
            <p className="font-mono text-[11px] text-ink/60 break-all">
              evidenceHash {att.evidence_hash}
            </p>
            <p className="text-[11px] text-ink/50 mt-3">
              evidenceHash is keccak256 of the canonical evidence bundle; anyone can
              recompute it to verify this grade was not altered.
            </p>
          </div>
        ) : (
          <p className="text-sm text-ink/60">Not yet attested on-chain.</p>
        )}
      </section>
    </main>
  );
}
```

- [ ] **Step 3: Typecheck + full build**

Run: `pnpm build`
Expected: build + typecheck PASS.

- [ ] **Step 4: Commit**

```bash
git add web/app/grade/[...slug]/page.tsx web/app/grade/[...slug]/not-found.tsx
git commit -m "feat: add public per-grade evidence page"
```

---

## Task 15: Env documentation

**Files:**
- Create/modify: `web/.env.example`

- [ ] **Step 1: Document the new vars**

Create or append to `web/.env.example`:
```bash
# Supabase (existing)
SUPABASE_URL=
SUPABASE_SERVICE_ROLE_KEY=

# Admin gate for /admin/* and /api/admin/*
ADMIN_TOKEN=

# On-chain attestations (EAS on Base)
EAS_CHAIN=base                 # "base" (mainnet) | "base-sepolia"
BASE_RPC_URL=                  # JSON-RPC endpoint for the active chain
ATTESTER_PRIVATE_KEY=          # hot wallet that signs/pays (server-only)
EAS_SCHEMA_UID=                # printed by scripts/register-schema.ts
```

- [ ] **Step 2: Commit**

```bash
git add web/.env.example
git commit -m "docs: document attestation env vars"
```

---

## Task 16: End-to-end on Base Sepolia (manual verification)

No code — proves the full path before spending real ETH. Do this with `EAS_CHAIN=base-sepolia`.

- [ ] **Step 1: Provision a hot wallet + RPC**

Generate a fresh wallet (e.g. `node -e "const {Wallet}=require('ethers');const w=Wallet.createRandom();console.log(w.address, w.privateKey)"` from `web/`). Fund the address with Base Sepolia ETH from a faucet. Get a Base Sepolia RPC URL (public `https://sepolia.base.org` or a provider).

- [ ] **Step 2: Configure `.env.local`**

In `web/.env.local` set `EAS_CHAIN=base-sepolia`, `BASE_RPC_URL=<sepolia rpc>`, `ATTESTER_PRIVATE_KEY=<key>`, plus the existing Supabase vars and an `ADMIN_TOKEN`.

- [ ] **Step 3: Register the schema**

Run: `npx tsx --env-file=.env.local scripts/register-schema.ts`
Expected: prints `EAS_SCHEMA_UID=0x...`. Paste that value into `EAS_SCHEMA_UID` in `.env.local`.

- [ ] **Step 4: Apply the DB table** (if not already) to the Supabase project — Task 7 Step 2.

- [ ] **Step 5: Run the app and attest**

Run: `pnpm dev`. Visit `http://localhost:3000/admin/login`, sign in with `ADMIN_TOKEN`, go to `/admin/attestations`, click **Generate & submit on-chain** on one published grade.
Expected: row flips to "✅ on-chain" with a working `base-sepolia.easscan.org` link.

- [ ] **Step 6: Verify provenance + composability**

Open the easscan link: confirm the decoded fields (server, version, grade, evidenceHash, evidenceURI) are correct and the attester is your wallet. Visit the `evidenceURI` (the `/grade/...` page) and confirm it renders the grade and shows the on-chain section.

- [ ] **Step 7: Verify idempotency**

Confirm the button is gone for that row (status confirmed). Optionally POST again via curl with the same `hosted_run_id` and confirm a `409 already` with the existing UID.

- [ ] **Step 8: Note results**

No commit. Record the Sepolia attestation UID in the PR description as evidence.

---

## Task 17: Base mainnet cutover (manual)

- [ ] **Step 1: Register the schema on mainnet**

Set production env `EAS_CHAIN=base`, a Base **mainnet** `BASE_RPC_URL`, and a **funded mainnet** `ATTESTER_PRIVATE_KEY`. Run `npx tsx --env-file=.env.production.local scripts/register-schema.ts` (or against prod env) and capture the mainnet `EAS_SCHEMA_UID`.

- [ ] **Step 2: Set production env vars**

In the Vercel/host project settings, set `EAS_CHAIN=base`, `BASE_RPC_URL`, `ATTESTER_PRIVATE_KEY`, `EAS_SCHEMA_UID` (mainnet UID), and `ADMIN_TOKEN`. Apply the DB table to the production Supabase project.

- [ ] **Step 3: Attest one grade in production**

From the deployed `/admin/attestations`, attest a single grade. Verify on `base.easscan.org` and that the `/grade/...` page shows the on-chain section. Done.

---

## Self-review notes (already applied)

- **Spec coverage:** EAS on-chain approach (Tasks 2,9,10), schema fields (Task 6), data model (Task 7), store + idempotency (Task 8,12), admin auth (Task 11), admin UI + button (Task 13), flow/error handling (Task 12), public evidence page with version-pinned URI (Tasks 5,14), network-agnostic via `EAS_CHAIN` (Task 3), Sepolia-first then mainnet (Tasks 16,17), testing of pure pieces (Tasks 3–6,8). All spec sections map to tasks.
- **Known risk to confirm during build:** the eas-sdk `Transaction` wrapper's hash accessor (`tx.tx.hash`) — Task 9 Step 2 flags adjusting to whatever the compiler/SDK exposes (e.g. `tx.receipt?.hash`).
- **Type consistency:** `GradeAttestationFields`, `AttestationRow`, `AdminRow`, `HostedGradeRow` used consistently; `GRADE_SCHEMA` is the single schema source for both registration and encoding; `hosted_run_id` is `string` end-to-end.
