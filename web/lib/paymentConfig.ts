/**
 * Ecosystem-payment constants + contract surface, in a client-safe module (NO
 * `server-only`) — the activation page's wallet island needs the same addresses
 * and ABI fragments the server verify route uses. Runtime logic (status checks,
 * quotes, onchain reads) lives in lib/ecosystemPayments (server-only).
 *
 * The payment rail: a subscription paid as a cancelable Sablier Lockup
 * stream of $POLYGRAPH to the polygraph treasury on Base. One stream = one
 * billing term — a month by default, or a year billed as 10 months
 * (billedMonths); renew by creating the next one. A longer stream at the
 * same monthly rate prepays more months. Verified onchain by the server; the
 * stream IS the subscription (cancel = unstreamed remainder refunds,
 * monitoring stops).
 */

/** Base mainnet — the only chain the payment flow supports. */
export const PAYMENT_CHAIN_ID = 8453;

/** $POLYGRAPH on Base. Decimals verified onchain (0x313ce567 → 18). */
export const POLYGRAPH_TOKEN_ADDRESS =
  process.env.NEXT_PUBLIC_POLYGRAPH_TOKEN_ADDRESS ??
  "0x2878cfc54aabdadd9bb5d70dd24d6b91485afba3";
export const POLYGRAPH_TOKEN_DECIMALS = 18;
export const POLYGRAPH_TOKEN_SYMBOL = "POLYGRAPH";

/**
 * SablierLockup v4.0 on Base (source-verified on Basescan/Blockscout; ABI
 * fragments below vendored from the verified source, 2026-07).
 */
export const SABLIER_LOCKUP_ADDRESS =
  process.env.NEXT_PUBLIC_SABLIER_LOCKUP_ADDRESS ??
  "0xc19a09A66887017F603E5dF420ed3Cb9a5c07C0A";

/**
 * The stream recipient. Deliberately NEXT_PUBLIC so the client builds the create
 * tx against the same address the server verifies against.
 */
export const TREASURY_ADDRESS = process.env.NEXT_PUBLIC_POLYGRAPH_TREASURY_ADDRESS ?? "";

/**
 * The onchain tag binding a stream to its ecosystem, written into Sablier's
 * free-form `shape` field at creation and required back by the verify route.
 * Without it, a freshly created (not-yet-verified) stream could be claimed by
 * anyone who saw it onchain and pasted it for a different ecosystem. Sablier
 * caps shape at 32 bytes; slugs are ASCII ([a-z0-9-]), so slice is byte-safe.
 */
export function paymentShapeTag(slug: string): string {
  return `pg:${slug}`.slice(0, 32);
}

export const DEFAULT_MONTHLY_PRICE_USD = 199;

/**
 * The grading fee: the one-time $1 every /request pays before grading starts
 * (payment starts the 48h clock). Buys the run, never the grade. Priced as a
 * nominal commitment fee, not a revenue line (supersedes the earlier $99–299
 * priority band): $1 per server or skill filters spam while keeping grading
 * open to everyone. Env-overridable.
 */
export const PRIORITY_GRADE_PRICE_USD = Number.parseFloat(
  process.env.NEXT_PUBLIC_PRIORITY_GRADE_PRICE_USD ?? "1",
);

/** What GET /api/grade-requests/[id]/priority/quote returns. */
export interface PriorityQuote {
  requestId: string;
  target: string;
  usdPrice: number;
  /** Raw token units (18 decimals) INCLUDING the unique dust digits — pay exactly this. */
  tokenAmount: string;
  tokenAmountDisplay: number;
  tokenUsdRate: number;
  /** Epoch ms after which the client should re-fetch. */
  expiresAt: number;
  chainId: number;
  token: string;
  treasury: string;
}

// ── Per-user plans (monitor quota) ───────────────────────────────────────────

export type PlanId = "indie" | "team";

/** USD/month, paid as the same Sablier stream rail as ecosystem monitoring. */
export const PLAN_PRICES_USD: Record<PlanId, number> = { indie: 15, team: 59 };

/**
 * Active monitor slots per plan. The free tier's 1 and these numbers are
 * duplicated in record_monitor (packages/core migrations) — the RPC enforces,
 * this renders; change both together.
 */
export const PLAN_QUOTAS: Record<PlanId | "free", number> = { free: 1, indie: 25, team: 100 };

const B64URL = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-_";

/**
 * The onchain tag binding a plan stream to its buyer, same role as
 * paymentShapeTag below. Sablier caps shape at 32 bytes and `pgu:<uuid>` is 40
 * chars, so the uuid's 16 bytes go base64url (22 chars, 26 total). The pgu:
 * namespace also guarantees a plan stream can never verify as an ecosystem
 * payment (pg:<slug>) or vice versa.
 */
export function planShapeTag(userId: string): string {
  const hex = userId.replace(/-/g, "").toLowerCase();
  if (!/^[0-9a-f]{32}$/.test(hex)) throw new Error(`planShapeTag: not a uuid: ${userId}`);
  const bytes = Array.from({ length: 16 }, (_, i) => parseInt(hex.slice(i * 2, i * 2 + 2), 16));
  let out = "";
  for (let i = 0; i < bytes.length; i += 3) {
    const b = bytes[i + 1];
    const c = bytes[i + 2];
    const n = (bytes[i] << 16) | ((b ?? 0) << 8) | (c ?? 0);
    out += B64URL[(n >>> 18) & 63];
    out += B64URL[(n >>> 12) & 63];
    if (b !== undefined) out += B64URL[(n >>> 6) & 63];
    if (c !== undefined) out += B64URL[n & 63];
  }
  return `pgu:${out}`;
}
/** One billing month of streaming. */
export const MONTH_SECONDS = 30 * 24 * 60 * 60;
/**
 * A verified stream must span at least this (a hair under a month, tolerating
 * clock/duration slop), and its deposit must cover the monthly price × its
 * duration at 95% — tolerance for the token price moving between the quote
 * and the tx landing.
 */
export const MIN_STREAM_SECONDS = 27 * 24 * 60 * 60;
export const DEPOSIT_TOLERANCE = 0.95;

// ── Billing terms ────────────────────────────────────────────────────────────

export type BillingTerm = "monthly" | "yearly";

/** A year of streaming spans 12 billing months… */
export const YEAR_MONTHS = 12;
/** …but bills as 10 — the yearly deal, 12 months for the price of 10. */
export const YEARLY_BILLED_MONTHS = 10;

/** Stream duration (the create tx's durations.total) for a billing term. */
export function termDurationSeconds(term: BillingTerm): number {
  return term === "yearly" ? YEAR_MONTHS * MONTH_SECONDS : MONTH_SECONDS;
}

/**
 * Months to charge for a stream spanning `months`: every full 12-month block
 * bills as YEARLY_BILLED_MONTHS, the remainder at the plain monthly rate. The
 * slop term credits a block to a stream up to ~3 days short of a 12-month
 * multiple — the same tolerance MIN_STREAM_SECONDS grants the monthly check.
 * Deliberate discontinuity: an 11.5-month stream bills 11.5 (more than a
 * year's 10); the UI only creates 1- or 12-month streams, and a hand-crafted
 * in-between duration simply doesn't get the deal.
 */
export function billedMonths(months: number): number {
  const slop = (MONTH_SECONDS - MIN_STREAM_SECONDS) / MONTH_SECONDS;
  const years = Math.floor((months + slop) / YEAR_MONTHS);
  return years * YEARLY_BILLED_MONTHS + Math.max(0, months - years * YEAR_MONTHS);
}

/** Lockup.Status enum order, from the verified source. */
export const STREAM_STATUS = {
  PENDING: 0,
  STREAMING: 1,
  SETTLED: 2,
  CANCELED: 3,
  DEPLETED: 4,
} as const;

/** What GET /api/manage/[slug]/payment/quote returns. */
export interface PaymentQuote {
  term: BillingTerm;
  /** Stream duration the client must pass as the create tx's durations.total. */
  durationSeconds: number;
  usdMonthly: number;
  /** The charge for the whole term: usdMonthly × billedMonths(term). */
  usdTotal: number;
  /** Raw token units (18 decimals), as a decimal string. */
  tokenAmount: string;
  /** Same amount in whole tokens, for display. */
  tokenAmountDisplay: number;
  /** USD per token used for the conversion. */
  tokenUsdRate: number;
  /** Epoch ms after which the client should re-fetch. */
  expiresAt: number;
  chainId: number;
  token: string;
  treasury: string;
  lockup: string;
}

/** What GET /api/account/plan/quote returns — a PaymentQuote for a plan. */
export interface PlanQuote extends PaymentQuote {
  plan: PlanId;
}

/**
 * Minimal SablierLockup v4 ABI: the LL create call (client) + the per-stream
 * getters the verify route reads (server). Vendored verbatim from the verified
 * contract at SABLIER_LOCKUP_ADDRESS — v4 has no monolithic getStream.
 * `createWithDurationsLL` notes: granularity 0 is the documented sentinel for
 * per-second streaming; the function is payable but creation requires no fee
 * (msg.value is only checked on withdraw) — send 0.
 */
export const SABLIER_LOCKUP_ABI = [
  {
    inputs: [
      {
        components: [
          { internalType: "address", name: "sender", type: "address" },
          { internalType: "address", name: "recipient", type: "address" },
          { internalType: "uint128", name: "depositAmount", type: "uint128" },
          { internalType: "contract IERC20", name: "token", type: "address" },
          { internalType: "bool", name: "cancelable", type: "bool" },
          { internalType: "bool", name: "transferable", type: "bool" },
          { internalType: "string", name: "shape", type: "string" },
        ],
        internalType: "struct Lockup.CreateWithDurations",
        name: "params",
        type: "tuple",
      },
      {
        components: [
          { internalType: "uint128", name: "start", type: "uint128" },
          { internalType: "uint128", name: "cliff", type: "uint128" },
        ],
        internalType: "struct LockupLinear.UnlockAmounts",
        name: "unlockAmounts",
        type: "tuple",
      },
      { internalType: "uint40", name: "granularity", type: "uint40" },
      {
        components: [
          { internalType: "uint40", name: "cliff", type: "uint40" },
          { internalType: "uint40", name: "total", type: "uint40" },
        ],
        internalType: "struct LockupLinear.Durations",
        name: "durations",
        type: "tuple",
      },
    ],
    name: "createWithDurationsLL",
    outputs: [{ internalType: "uint256", name: "streamId", type: "uint256" }],
    stateMutability: "payable",
    type: "function",
  },
  {
    inputs: [{ internalType: "uint256", name: "streamId", type: "uint256" }],
    name: "getUnderlyingToken",
    outputs: [{ internalType: "contract IERC20", name: "token", type: "address" }],
    stateMutability: "view",
    type: "function",
  },
  {
    inputs: [{ internalType: "uint256", name: "streamId", type: "uint256" }],
    name: "getRecipient",
    outputs: [{ internalType: "address", name: "recipient", type: "address" }],
    stateMutability: "view",
    type: "function",
  },
  {
    inputs: [{ internalType: "uint256", name: "streamId", type: "uint256" }],
    name: "getSender",
    outputs: [{ internalType: "address", name: "sender", type: "address" }],
    stateMutability: "view",
    type: "function",
  },
  {
    inputs: [{ internalType: "uint256", name: "streamId", type: "uint256" }],
    name: "getDepositedAmount",
    outputs: [{ internalType: "uint128", name: "depositedAmount", type: "uint128" }],
    stateMutability: "view",
    type: "function",
  },
  {
    inputs: [{ internalType: "uint256", name: "streamId", type: "uint256" }],
    name: "getStartTime",
    outputs: [{ internalType: "uint40", name: "startTime", type: "uint40" }],
    stateMutability: "view",
    type: "function",
  },
  {
    inputs: [{ internalType: "uint256", name: "streamId", type: "uint256" }],
    name: "getEndTime",
    outputs: [{ internalType: "uint40", name: "endTime", type: "uint40" }],
    stateMutability: "view",
    type: "function",
  },
  {
    inputs: [{ internalType: "uint256", name: "streamId", type: "uint256" }],
    name: "statusOf",
    outputs: [{ internalType: "enum Lockup.Status", name: "status", type: "uint8" }],
    stateMutability: "view",
    type: "function",
  },
  // Sender-only: stops the stream, refunds the unstreamed remainder to the
  // payer. The client calls this from the cancel button; the server then
  // re-reads statusOf and flips the payment row.
  {
    inputs: [{ internalType: "uint256", name: "streamId", type: "uint256" }],
    name: "cancel",
    outputs: [],
    stateMutability: "nonpayable",
    type: "function",
  },
  {
    inputs: [{ internalType: "uint256", name: "streamId", type: "uint256" }],
    name: "wasCanceled",
    outputs: [{ internalType: "bool", name: "result", type: "bool" }],
    stateMutability: "view",
    type: "function",
  },
  {
    inputs: [{ internalType: "uint256", name: "streamId", type: "uint256" }],
    name: "isDepleted",
    outputs: [{ internalType: "bool", name: "result", type: "bool" }],
    stateMutability: "view",
    type: "function",
  },
  // Emitted by createWithDurationsLL; streamId is indexed, so the client can
  // pull it straight from the receipt.
  {
    anonymous: false,
    inputs: [
      { indexed: true, internalType: "uint256", name: "streamId", type: "uint256" },
      {
        components: [
          { internalType: "address", name: "funder", type: "address" },
          { internalType: "address", name: "sender", type: "address" },
          { internalType: "address", name: "recipient", type: "address" },
          { internalType: "uint128", name: "depositAmount", type: "uint128" },
          { internalType: "contract IERC20", name: "token", type: "address" },
          { internalType: "bool", name: "cancelable", type: "bool" },
          { internalType: "bool", name: "transferable", type: "bool" },
          {
            components: [
              { internalType: "uint40", name: "start", type: "uint40" },
              { internalType: "uint40", name: "end", type: "uint40" },
            ],
            internalType: "struct Lockup.Timestamps",
            name: "timestamps",
            type: "tuple",
          },
          { internalType: "string", name: "shape", type: "string" },
        ],
        indexed: false,
        internalType: "struct Lockup.CreateEventCommon",
        name: "commonParams",
        type: "tuple",
      },
      { indexed: false, internalType: "uint40", name: "cliffTime", type: "uint40" },
      { indexed: false, internalType: "uint40", name: "granularity", type: "uint40" },
      {
        components: [
          { internalType: "uint128", name: "start", type: "uint128" },
          { internalType: "uint128", name: "cliff", type: "uint128" },
        ],
        indexed: false,
        internalType: "struct LockupLinear.UnlockAmounts",
        name: "unlockAmounts",
        type: "tuple",
      },
    ],
    name: "CreateLockupLinearStream",
    type: "event",
  },
] as const;

/**
 * Minimal ERC-20 surface: approve/allowance/balance for the stream checkout,
 * transfer + the Transfer event for the one-time priority-grading payment
 * (client sends the transfer; the server matches the event log).
 */
export const ERC20_ABI = [
  {
    inputs: [
      { internalType: "address", name: "spender", type: "address" },
      { internalType: "uint256", name: "amount", type: "uint256" },
    ],
    name: "approve",
    outputs: [{ internalType: "bool", name: "", type: "bool" }],
    stateMutability: "nonpayable",
    type: "function",
  },
  {
    inputs: [
      { internalType: "address", name: "to", type: "address" },
      { internalType: "uint256", name: "amount", type: "uint256" },
    ],
    name: "transfer",
    outputs: [{ internalType: "bool", name: "", type: "bool" }],
    stateMutability: "nonpayable",
    type: "function",
  },
  {
    anonymous: false,
    inputs: [
      { indexed: true, internalType: "address", name: "from", type: "address" },
      { indexed: true, internalType: "address", name: "to", type: "address" },
      { indexed: false, internalType: "uint256", name: "value", type: "uint256" },
    ],
    name: "Transfer",
    type: "event",
  },
  {
    inputs: [
      { internalType: "address", name: "owner", type: "address" },
      { internalType: "address", name: "spender", type: "address" },
    ],
    name: "allowance",
    outputs: [{ internalType: "uint256", name: "", type: "uint256" }],
    stateMutability: "view",
    type: "function",
  },
  {
    inputs: [{ internalType: "address", name: "account", type: "address" }],
    name: "balanceOf",
    outputs: [{ internalType: "uint256", name: "", type: "uint256" }],
    stateMutability: "view",
    type: "function",
  },
] as const;
