# On-chain grade attestations (Base / EAS)

**Date:** 2026-06-17
**Status:** Approved design — ready for implementation planning

## Goal

Publish polygraph grades as on-chain attestations on **Base** so that each grade
is (a) **tamper-proof provenance** — a public, timestamped, independently
verifiable record that polygraph issued grade X for server Y at time T, signed by
polygraph's attester address — and (b) **composable** — readable by other
on-chain systems (agent registries, smart contracts) that want to gate on a
polygraph grade.

Operated from the **app side**: an admin-only interface lists published grades
and lets the operator click a button to generate and submit each attestation
on-chain.

## Non-goals

- No full user/auth system. Single-operator (founder) access via an env token.
- No custom Solidity contract — use the existing EAS infrastructure on Base.
- No off-chain/IPFS attestation flow (fails the composability goal).
- No automatic/batch attestation — manual, per-grade, button-driven for now.
- No "verify on-chain" badge added to the *existing* grade displays (hero card,
  §03 list) yet — parking-lot. (The new per-grade evidence page below *does* show
  the on-chain link; wiring it into the other surfaces is deferred.)

## Approach

Use the **Ethereum Attestation Service (EAS)** on Base with **on-chain**
attestations. EAS is the de facto attestation standard on Base: one-time schema
registration, then one attestation per published grade, each visible at
`base.easscan.org` and readable by any contract. This meets both goals with the
least surface area (no contract to write, audit, or deploy).

Rejected alternatives:
- **Custom Solidity contract** — reinvents schema registry/explorer; high effort,
  audit + deploy + maintenance burden. Overkill.
- **EAS off-chain (signed/IPFS)** — cheapest, but not contract-readable, so it
  fails composability.

## Network & signing (decided)

- **Network:** Base **mainnet** in production. Build **network-agnostic** via env
  so the full flow can be dry-run on **Base Sepolia** first (strongly recommended
  before the first public mainnet write).
- **Signing:** **Server hot wallet.** A private key in server env (same trust
  model as `SUPABASE_SERVICE_ROLE_KEY` today). Clicking the button has the server
  build, sign, and submit the transaction. One issuer address = clean provenance.

## Attestation schema

Registered once on Base (and once on Sepolia for testing), then reused. Fields
chosen for both querying (composability) and tamper-proofing (provenance):

```
string  server            // versionless server_key (e.g. the registry ref)
string  version           // evidence.resolvedVersion ("" for unresolved/HTTP targets)
string  grade             // "A".."F"
string  methodologyVersion
string  toolDefsFingerprint
bytes32 evidenceHash       // keccak256 of the canonical-serialized evidence bundle
string  evidenceURI        // version-pinned public evidence page (see below)
uint64  issuedAt           // published_at, unix seconds
```

- **Revocable: yes.** A grade issued in error can be revoked. Re-grades for a new
  version are *new* attestations, not revocations of old ones.
- `recipient` = `0x0` (servers have no on-chain address); identity lives in the
  `server` field. The attester (polygraph's wallet) is the provenance signal.
- **`evidenceHash` is the tamper-proof anchor.** It is the keccak256 of the
  evidence bundle serialized with a **canonical, deterministic** serialization
  (stable key ordering) so the hash is reproducible. Anyone can re-hash the
  published evidence bundle and confirm it matches what was attested.

## Data source

Grades come from the existing Supabase `hosted_runs` table. A grade is eligible
for attestation when `status='complete'` and `published_at` is set (the same
definition the CLI/site use). Fields used:

- `target` → `server`
- `evidence.resolvedVersion` → `version`
- `grade` → `grade`
- `evidence.methodologyVersion` (fallback `"litmus"`) → `methodologyVersion`
- `evidence.toolDefsFingerprint` (fallback `tool_defs_fingerprint`) → `toolDefsFingerprint`
- `evidence` (whole bundle, canonical-serialized) → `evidenceHash`
- `published_at` → `issuedAt`

The existing `detailFromRow` / fetch helpers in `web/lib/hostedGrades.ts` already
do the bundle-vs-column fallback resolution and should be reused so the attested
values match exactly what the site/CLI display.

## Public per-grade evidence page

The `evidenceURI` in each attestation points at a **public, version-pinned**
evidence page so anyone can read the grade in human-readable form and cross-check
it against the on-chain `evidenceHash`.

- **Route:** `web/app/grade/[...slug]/page.tsx` — a catch-all that captures the
  server key path (`npm/owner/name`, `github/owner/repo`, `pypi/name`, including a
  leading `@scope`). The version is a query param: `?v=<version>`.
- **Canonical URL:** `https://polygraph.so/grade/<serverKey>?v=<version>`. Version
  is included so the URL is **immutable** for the attested grade. When the grade
  has no resolved version (HTTP/unresolved targets), `?v` is omitted.
- **Resolution:** reuse `fetchPublishedGrade(db, serverKey, version)` from
  `web/lib/hostedGrades.ts` so the page shows exactly what the CLI/site show. A
  missing grade renders a 404 (`not-found`).
- **Renders:** server, resolved version, grade, the per-category results
  (C-01/C-02/C-03), rationale, methodology version, tool-defs fingerprint, and
  published date — plus, if attested, the on-chain section: attester address,
  `evidenceHash`, and a link to the attestation on `base.easscan.org`.
- **Verifiability:** the page documents that `evidenceHash` is
  `keccak256(canonical(evidence))` and shows the value, so a third party can
  reproduce it. (Exposing the raw canonical bundle for download is a nice-to-have;
  acceptable to show the structured fields plus the hash.)

**Ordering:** this page is independent of attestation (no circular dependency) and
must be live before the first attestation is written, so the `evidenceURI` resolves
the moment the attestation lands.

## Data model (Supabase)

New table `grade_attestations` — keeps history; one grade can be re-attested if a
prior tx failed.

```
id                bigint / uuid, pk
hosted_run_id     fk -> hosted_runs (the attested grade)
server            text
version           text
grade             text
schema_uid        text
attestation_uid   text          // null until confirmed
tx_hash           text          // set when submitted
chain_id          integer       // 8453 base / 84532 base-sepolia
attester_address  text
evidence_hash     text          // 0x-prefixed
status            text          // 'pending' | 'confirmed' | 'failed'
error             text          // null unless failed
created_at        timestamptz   default now()
confirmed_at      timestamptz
```

Accessed server-side only via the existing service-role client
(`getSupabaseAdmin()` in `web/lib/supabase.ts`).

Rationale for a separate table over columns on `hosted_runs`: keeps the grade
store clean, records failed attempts, and supports re-attestation without
clobbering the grade row.

## Admin interface & auth

There is no auth in the app today. Smallest secure thing for a single operator:

- **Auth:** env `ADMIN_TOKEN`. A simple login form posts the token; on match the
  server sets an httpOnly cookie. Next.js middleware gates `/admin/*` and
  `/api/admin/*`, redirecting/401-ing without a valid cookie. No user system, no
  DB rows for auth — just the operator. Can grow into real auth later.
- **Page `/admin/attestations`:** server component that lists published
  `hosted_runs` joined with their latest `grade_attestations` status. Each row
  shows: server, version, grade, published date, and attestation status —
  *Not attested* / *Pending* / *✅ Confirmed* (with an `base.easscan.org` link to
  the attestation UID) / *Failed* (with error + retry).
- **Button:** "Generate & submit on-chain" per not-yet-attested grade.

## Flow

1. Operator clicks the button → `POST /api/admin/attestations` with
   `{ hosted_run_id }`.
2. Server (never trusting client-supplied grade data):
   a. Re-reads the grade from `hosted_runs` by id; rejects if not published.
   b. **Idempotency guard:** rejects if a `confirmed` attestation already exists
      for that `hosted_run_id` (returns the existing easscan link instead).
   c. Resolves the attested values (reusing `hostedGrades.ts` helpers).
   d. Computes `evidenceHash` (canonical serialize → keccak256) and builds the
      version-pinned `evidenceURI` for the public evidence page.
   e. Inserts a `grade_attestations` row with `status='pending'`, `tx_hash` null.
   f. Encodes the schema (eas-sdk `SchemaEncoder`), signs with the hot wallet,
      submits the on-chain attestation to Base.
   g. On receipt: updates the row to `status='confirmed'`, sets
      `attestation_uid`, `tx_hash`, `confirmed_at`.
   h. On failure: updates the row to `status='failed'` with the error message.
3. UI reflects the new status (revalidate / refetch).

## Error handling

Surfaced inline in the admin UI and returned as structured JSON from the route:

- Wallet/env not configured (`ATTESTER_PRIVATE_KEY`, `EAS_SCHEMA_UID`, RPC) →
  clear "not configured" message, no row written.
- Grade not found / not published → 400, no row.
- Already confirmed → 409 with the existing easscan link.
- RPC down / tx revert / insufficient gas → row marked `failed` with the error;
  button offers retry (a retry creates a fresh attempt).

## Dependencies & config

- **`@ethereum-attestation-service/eas-sdk`** (+ its `ethers` peer) — server-only,
  isolated to a single attestation module. Chosen over hand-rolling schema
  encoding with viem because it is faster to get correct for an admin-only,
  low-frequency action.
- **New env vars:**
  - `ATTESTER_PRIVATE_KEY` — hot wallet that signs/pays.
  - `BASE_RPC_URL` — RPC endpoint (mainnet or Sepolia per `EAS_CHAIN`).
  - `EAS_CHAIN` — `base` | `base-sepolia` (selects EAS contract address +
    chain id; default `base` in prod).
  - `EAS_SCHEMA_UID` — the registered schema UID for the active chain.
  - `ADMIN_TOKEN` — gates the admin surface.
- **One-off script `scripts/register-schema.ts`** — registers the schema on the
  target chain and prints the UID to paste into env. Run once per chain.

## Module boundaries

- `web/lib/attestations/eas.ts` — thin EAS client: construct provider/signer from
  env, register-schema helper, `attestGrade(fields)` → `{ uid, txHash }`,
  `revokeAttestation(uid)`. Pure I/O against the chain.
- `web/lib/attestations/encode.ts` — pure functions: canonical evidence
  serialization, `evidenceHash`, version-pinned `evidenceURI` builder, schema
  field assembly from a `HostedGradeRow`. Unit-testable with no chain.
- `web/app/grade/[...slug]/page.tsx` (+ `not-found`) — the public per-grade
  evidence page described above. Reuses `hostedGrades.ts` for resolution and the
  attestations store to show the on-chain section when present.
- `web/lib/attestations/store.ts` — `grade_attestations` reads/writes via the
  service-role client (insert pending, mark confirmed/failed, idempotency lookup,
  list-with-status join for the admin page).
- `web/app/api/admin/attestations/route.ts` — the POST handler orchestrating the
  flow above.
- `web/app/admin/attestations/page.tsx` + small client component for the button.
- `web/middleware.ts` — env-token gate for `/admin/*` and `/api/admin/*`.

## Testing

- **Unit (no chain):** canonical serialization is deterministic (key-order
  independent), `evidenceHash` is stable, `evidenceURI` builder produces the
  expected version-pinned URL (and omits `?v` when unresolved), schema encoding
  round-trips, idempotency guard rejects a second confirmed attestation, value
  resolution matches `hostedGrades.ts` output.
- **Evidence page:** renders a published grade from a server-key slug (+ version),
  404s an unknown grade, and surfaces the on-chain section once attested.
- **Integration (Base Sepolia):** register schema, attest a real published grade
  end-to-end, confirm it appears on `base-sepolia.easscan.org`, verify the stored
  `attestation_uid` resolves, verify re-hashing the evidence matches
  `evidenceHash`.
- **Cutover:** flip `EAS_CHAIN=base` + mainnet `EAS_SCHEMA_UID` + funded wallet,
  attest one grade, verify on `base.easscan.org`.

## Open / deferred

- Public "verify on-chain" badge/link on grade displays — parking-lot.
- Batch/auto attestation on publish — parking-lot.
- Migrating from env-token auth to a real auth system — when more than one
  operator needs access.
- Tying attestations to `$POLYGRAPH` token mechanics — out of scope here.
- **Concurrency / stale-pending hardening (deferred, single-operator scope):**
  there is no DB unique constraint on `(hosted_run_id)`, so two simultaneous
  POSTs could both attest; and a `pending` row left by a crash between
  `insertPending` and resolution blocks UI retry until reconciled by hand.
  Acceptable for one operator; revisit (e.g. a partial unique index
  `(hosted_run_id) where status <> 'failed'`, or a pending-timeout retry) if
  attestation is automated or multi-operator.
- **Signed admin session (deferred):** the admin cookie currently stores the
  raw `ADMIN_TOKEN` (HttpOnly + Secure + SameSite=Lax). Move to a signed/derived
  session value if more than one operator or token rotation is needed.
