/**
 * Ecosystem-payment constants + contract surface, in a client-safe module (NO
 * `server-only`) — the activation page's wallet island needs the same addresses
 * and ABI fragments the server verify route uses. Runtime logic (status checks,
 * quotes, onchain reads) lives in lib/ecosystemPayments (server-only).
 *
 * The payment rail: a monthly subscription paid as a cancelable Sablier Lockup
 * stream of $POLYGRAPH to the polygraph treasury on Base. One stream = one
 * month by default (renew by creating the next one); a longer stream at the
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

export const DEFAULT_MONTHLY_PRICE_USD = 199;
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
  usdMonthly: number;
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

/** Minimal ERC-20 surface for the approve step. */
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
