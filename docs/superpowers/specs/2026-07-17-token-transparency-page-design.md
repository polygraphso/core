# Design: `/transparency` — $POLYGRAPH token transparency page

Date: 2026-07-17
Repo: `core/` (polygraph.so, `web/`, Next.js 16 App Router, Tailwind v4)
Status: approved design, pending implementation plan

## Goal

A public, indexed page at **`/transparency`** that discloses, from live sources:

1. **Team vesting** — the team's $POLYGRAPH locked in Sablier (stream #716), read live.
2. **$POLYGRAPH tokenomics** — total supply, distribution (team-locked / treasury / circulating), price, FDV, market cap.
3. **Revenue** — booked revenue and counts across every paid surface: x402 (agent USDC rail), grade-request fees (web POLYGRAPH rail), ecosystem monitoring (Sablier), and Pro plans (Sablier), plus a 30-day booked-per-day trend.
4. **A "Buy POLYGRAPH" CTA** — the embedded LI.FI swap widget, pinned to POLYGRAPH-on-Base.

The page doubles as the buy thesis: the proof (team locked/aligned, real onchain revenue, treasury holdings, everything reproducible onchain) does the persuading. Tone stays plain and expert per the brand rules — no hype, no "revolutionize/empower", underclaim then over-deliver.

## Decisions (locked with the user)

- Audience/granularity: **fully public + exact figures**, linked in nav, indexed.
- Vesting: **single stream #716, live** (unlock % moves on its own over time).
- Revenue depth: **totals + counts + trend strip**, no customer identities (no wallets/emails/targets).
- Token context: **full tokenomics** (supply, distribution, FDV, price).
- **Pro-plan revenue included** as a fourth revenue line (a transparency page that hides a revenue stream undercuts itself).
- Route name: **`/transparency`**.
- Circulating supply definition: **`totalSupply − team-locked − treasury`**, disclosed in a footnote.
- CTA: **embedded LI.FI widget** — satisfied by **reusing the existing `SwapWidget`** (already pinned to POLYGRAPH-on-Base).

## Known facts from the codebase (grounding)

Onchain / token:
- ethers v6, entry point `paymentProvider()` in `web/lib/paymentRail.ts` (Base mainnet, `PAYMENT_RPC_URL` override, default `https://mainnet.base.org`).
- Token `0x2878cfc54aabdadd9bb5d70dd24d6b91485afba3`, 18 decimals, symbol POLYGRAPH — `web/lib/paymentConfig.ts:20-24`.
- Sablier Lockup v4 `0xc19a09A66887017F603E5dF420ed3Cb9a5c07C0A` — `paymentConfig.ts:30-32`.
- Treasury address: `TREASURY_ADDRESS` = `NEXT_PUBLIC_POLYGRAPH_TREASURY_ADDRESS` — `paymentConfig.ts:38`.
- Canonical USDC on Base `0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913` (used in `SwapWidget.tsx:63`).
- Token price via DexScreener (deepest-liquidity Base pair, cached 60s) in `paymentRail.ts`. DexScreener also returns `fdv`, `marketCap`, `priceUsd`, `liquidity` — reuse/extend that fetch.
- **The vesting stream #716** (the tx the user linked) is a Sablier linear lockup of ~8.87B POLYGRAPH to the team, same Lockup contract as the payment rail.

ABI gaps to fill (vendor from the verified Sablier/ERC20 source, matching the existing "vendored verbatim" convention in `paymentConfig.ts`):
- `ERC20_ABI` has no `totalSupply` — **add `totalSupply()`** (and it already has `balanceOf`).
- `SABLIER_LOCKUP_ABI` has no `streamedAmountOf` / `withdrawnAmountOf` — **add both** so unlocked-to-date is read exactly from the contract (no reimplementing cliff/unlock-amount math). It already has `getDepositedAmount`, `getStartTime`, `getEndTime`, `statusOf`.

Revenue (all in Supabase, schema owned by `packages/core`):
- `grade_request_payments` (status `paid`): carries **both** the x402 rail (token = USDC, decimals 6) and the web $1 rail (token = POLYGRAPH, decimals 18). Split by token address. Fields: `usd_price`, `paid_at`, `token`, `token_decimals`, `payer_address`, `tx_hash`.
- `ecosystem_payments`: `usd_total` (booked), `usd_monthly` (MRR), `status`, `verified_at`, `start_at`, `end_at`.
- `user_plan_payments`: same shape as ecosystem, plus `plan` (`indie`/`team`).
- Pure aggregation helpers already exist and are unit-tested: `sumByDay`, `sumByKey`, `formatUsd` in `web/lib/revenueAggregate.ts`. The admin fetcher `web/lib/revenueMetrics.ts` (`getRevenueMetrics`) returns **top-payer wallets and recent buys** — **do NOT reuse it for the public page**; build a PII-free path.

Wallet/CTA:
- `SwapWidget` (`web/app/_components/wallet/SwapWidget.tsx`) already embeds `@lifi/widget` (installed, v4.3.1), pinned `toToken: POLYGRAPH_TOKEN_ADDRESS` on Base, `disabledUI.toToken`, drawer variant, themed to oxblood/ink/IBM Plex, sharing the app's wagmi session via `EthereumProvider` + AppKit modal.
- It must run inside `WalletIsland` (`web/app/_components/wallet/WalletIsland.tsx`), the scoped `WagmiProvider` + `QueryClientProvider` wrapper. There is **no global wagmi provider** — each payment surface wraps itself. The transparency page's Buy panel wraps its trigger in `WalletIsland`.
- Dynamic-import pattern in the repo: `dynamic(() => import(...), { ssr: false, loading: ... })` (see `ActivateFlow.tsx`).

Route-group convention: public pages live under `web/app/(public)/` (e.g. `/base`, `/pricing`, `/ecosystems`). No charting library in the repo — figures are text/grid; charts here are hand-rolled inline SVG.

## Architecture

### Route & rendering
- New page: `web/app/(public)/transparency/page.tsx` — **server component**, `export const revalidate = 300` (ISR). Server-rendered so the figures are indexable.
- Nav: add a **"Transparency"** entry in `web/app/_components/navConfig.ts`.
- **Fault isolation:** every data source is fetched in its own `try/catch` and returns a nullable result. One failing RPC/DexScreener/Supabase call degrades only its own tile ("temporarily unavailable"); the page never 500s. Each panel renders a clean **empty/zero state** (figures are near-zero pre-traction — the page must read well at `$0` / `0%`).

### Data layer — new server module `web/lib/transparency.ts` (`server-only`)
Three independent, individually fault-isolated fetchers:

1. `getTokenStats()` → `{ totalSupply, priceUsd, fdv, marketCap, treasuryPolygraph, treasuryUsdc, distribution }`
   - `totalSupply()` and `balanceOf(treasury)` on the token via `paymentProvider()` + extended `ERC20_ABI`.
   - `balanceOf(treasury)` on USDC for the treasury's USDC holdings.
   - price/fdv/marketCap from the DexScreener fetch (extend the existing `paymentRail` helper to also return fdv/marketCap/price rather than only the rate).
   - `distribution` = `{ teamLocked, treasury, circulating }` where `circulating = max(0, totalSupply − teamLocked − treasury)`. `teamLocked` comes from the vesting fetcher (see below) — locked = `deposited − streamed`.

2. `getVestingStatus()` → `{ deposited, streamed, withdrawn, locked, startAt, cliffAt, endAt, status, pctUnlocked, txHash, streamId }`
   - Reads stream **#716** via extended `SABLIER_LOCKUP_ABI`: `getDepositedAmount`, `streamedAmountOf`, `withdrawnAmountOf`, `getStartTime`, `getEndTime`, `statusOf`. Cliff read from stream metadata is not exposed by a simple getter in v4 — source cliff from the creation event via `readStreamCreation(txHash)` (already parses `CreateLockupLinearStream`, which carries `cliffTime`), or store the cliff timestamp as a constant alongside the stream id. Prefer reading it from the creation event to keep a single source of truth.
   - `locked = deposited − streamed`; `pctUnlocked = streamed / deposited`.

3. `getPublicRevenue()` → `{ buckets, totalBooked, bookedThisMonth, mrr, activeSubs, byDay }`
   - **PII-free by construction:** selects only non-identifying columns from Supabase (`usd_price`/`usd_total`, `usd_monthly`, `paid_at`/`verified_at`, `end_at`, `status`, and `token` for the split). Does **not** select `payer_address`, `user_id`, `email`, `target`, `tx_hash`.
   - Normalizes into a `PublicRevenueEntry { surface, usd, monthly, at, endAt, status }` (a strict subset of `RevenueEntry` with no `payer`/`userId`/`userEmail`/`label`).
   - Splits `grade_request_payments` by token: USDC → surface `x402`; POLYGRAPH → surface `grade`.
   - `buckets`: per-surface `{ surface, booked, count, monthly }`. Four public rows: `x402`, `grade`, `ecosystem`, and `pro` (indie + team **summed** into one "Pro plans" row — the public page does not split by plan tier).
   - `totalBooked` = Σ usd; `bookedThisMonth` = Σ usd where `at ≥` UTC month start; `mrr` = Σ monthly for active streams (`status='active'` and `end_at > now`); `activeSubs` per surface.
   - `byDay` = `sumByDay(entries, 30, now)` reusing the existing helper.
   - Reuse `sumByDay`/`formatUsd` from `revenueAggregate.ts`.

Circulating supply is disclosed with an inline footnote: "Circulating = total supply minus team-locked (Sablier) minus treasury holdings; includes liquidity pools and public holders."

### UI — `web/app/(public)/transparency/_components/`
- `TokenPanel` — price, total supply, FDV, market cap, and a `DistributionBar` (inline-SVG stacked bar: team-locked / treasury / circulating) with a legend + %s and the circulating footnote.
- `VestingPanel` — deposited, locked, unlocked (%), withdrawn (if any), cliff/start/end, linear; an inline-SVG progress bar; links to the Sablier stream and the Basescan tx.
- `RevenuePanel` — one row per surface (x402, grade requests, ecosystems, Pro plans) with booked + count + MRR where applicable; grand total booked; booked-this-month; a `BookedTrend` inline-SVG bar strip (last 30d). A short honest note that the $1 grade fee is an anti-spam commitment fee (per `paymentConfig.ts:53-59`), so the recurring story is ecosystems + Pro plans (MRR).
- `BuyPanel` — persuasion sentence (plain, evidence-led) + the reused `SwapWidget` trigger, wrapped in `WalletIsland`, dynamically imported `ssr:false`. If the existing subtle text trigger reads as too small for a primary CTA, add an optional `prominent`/`label` prop to `SwapWidget` for a button-styled trigger; otherwise reuse as-is.
- `DistributionBar`, `BookedTrend`, `ProgressBar` — small shared inline-SVG primitives (no chart dep). Pure, given numbers.

Visual language: preprint chrome (parchment `#f5f1e5`, ink `#161512`, oxblood `#7a1f2b`), IBM Plex Mono for figures, matching `/base` and `/pricing`.

## What is explicitly out of scope

- No new charting dependency (inline SVG only).
- No historical time-series beyond the 30-day booked strip.
- No customer identities anywhere on the public page (wallets, emails, targets).
- No cron/snapshot table (SSR + ISR is enough for v1; revisit only if RPC reliability bites).
- No multi-stream team vesting (single stream #716).
- No changes to how payments are recorded — this page is read-only over existing data.

## Testing strategy

- Unit-test the pure transforms in `web/lib/transparency.ts` split out as pure functions given raw rows:
  - revenue bucket splitting (USDC→x402, POLYGRAPH→grade), `totalBooked` / `bookedThisMonth` / `mrr` (active-only) math, distribution math (`circulating = max(0, supply − locked − treasury)`), `pctUnlocked`.
  - **PII guard:** assert the object returned by the public normalizer contains none of `payer`, `userId`, `userEmail`, `payer_address`, `email`, `target`, `tx_hash` — a regression fence against leaking identities onto a public page.
  - zero/empty inputs render sane values (`$0`, `0%`, empty trend), no NaN/Infinity.
- Onchain readers take an **injectable provider** (default `paymentProvider()`) so they're mockable; do one live read against Base to confirm stream #716 and token supply decode correctly.
- `next build` after implementation — per `web/AGENTS.md`, this Next.js differs from training data; consult `node_modules/next/dist/docs/` before writing route/rendering code, and tsc alone misses server-only→client boundary violations.

## Env vars (all already exist; none new required)

- `NEXT_PUBLIC_POLYGRAPH_TOKEN_ADDRESS` (default hardcoded), `NEXT_PUBLIC_POLYGRAPH_TREASURY_ADDRESS` (required for treasury/circulating reads), `NEXT_PUBLIC_SABLIER_LOCKUP_ADDRESS` (default), `PAYMENT_RPC_URL` (optional, recommended for reliable public reads), `NEXT_PUBLIC_REOWN_PROJECT_ID` (already needed by the widget).

## Constants to add

- `POLYGRAPH_VESTING_STREAM_ID = 716` and the vesting tx hash `0x476e33bcfab067005c8681411c13fc88fde3665cedaa02dcd9e9d3d6ecff436f`, in `paymentConfig.ts` (client-safe) or the new transparency module.
- `totalSupply()` on `ERC20_ABI`; `streamedAmountOf(uint256)` + `withdrawnAmountOf(uint256)` on `SABLIER_LOCKUP_ABI`.
