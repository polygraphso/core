import "server-only";

/**
 * The I/O half of the /transparency page: live onchain reads (token supply,
 * treasury balances, the team vesting stream) + the PII-free revenue query.
 * Each fetcher is independently fault-isolated — it returns null on failure so a
 * flaky RPC or an unconfigured Supabase degrades one tile, never the page. Pure
 * math lives in transparency.ts (unit-tested); this module only fetches and
 * shapes.
 */

import { ethers } from "ethers";
import { paymentProvider, lockupContract, getTokenUsdRate } from "@/lib/paymentRail";
import {
  ERC20_ABI,
  POLYGRAPH_TOKEN_ADDRESS,
  POLYGRAPH_TOKEN_DECIMALS,
  STREAM_STATUS,
  TREASURY_ADDRESS,
} from "@/lib/paymentConfig";
import { getSupabaseAdmin } from "@/lib/supabase";
import {
  buildPublicRevenue,
  distribution,
  pctUnlocked,
  USDC_BASE_ADDRESS,
  VESTING_STREAM_ID,
  VESTING_TX_HASH,
  type PublicRevenue,
  type TokenStats,
  type VestingStatus,
} from "@/lib/transparency";

const USDC_DECIMALS = 6;

function statusLabel(status: number): string {
  switch (status) {
    case STREAM_STATUS.PENDING:
      return "pending";
    case STREAM_STATUS.STREAMING:
      return "streaming";
    case STREAM_STATUS.SETTLED:
      return "settled";
    case STREAM_STATUS.CANCELED:
      return "canceled";
    case STREAM_STATUS.DEPLETED:
      return "depleted";
    default:
      return "unknown";
  }
}

const toTokens = (raw: bigint, decimals = POLYGRAPH_TOKEN_DECIMALS): number =>
  Number(ethers.formatUnits(raw, decimals));

/**
 * The team vesting stream, read via per-stream getters on the Lockup contract.
 * The creation tx is an account-abstraction UserOp, so its hash has no plain
 * eth_getTransactionReceipt — we read the immutable facts (deposit, start, end,
 * cliff) and the live ones (streamed, withdrawn, status) straight from stream
 * #716 instead. Sequential reads — the default public Base RPC rate-limits
 * parallel bursts. The tx hash is still used only for the Basescan link.
 */
export async function getVestingStatus(): Promise<VestingStatus | null> {
  try {
    const lockup = lockupContract(await paymentProvider());
    const id = VESTING_STREAM_ID;

    const deposited = toTokens(BigInt(await lockup.getDepositedAmount(id)));
    const streamed = toTokens(BigInt(await lockup.streamedAmountOf(id)));
    const withdrawn = toTokens(BigInt(await lockup.getWithdrawnAmount(id)));
    const statusNum = Number(await lockup.statusOf(id));
    const startAt = Number(await lockup.getStartTime(id));
    const endAt = Number(await lockup.getEndTime(id));
    let cliffAt: number | null = null;
    try {
      const c = Number(await lockup.getCliffTime(id));
      cliffAt = c > 0 ? c : null;
    } catch {
      cliffAt = null; // some shapes have no cliff getter — degrade that one field
    }

    return {
      streamId: String(id),
      txHash: VESTING_TX_HASH,
      deposited,
      streamed,
      withdrawn,
      locked: Math.max(0, deposited - streamed),
      pctUnlocked: pctUnlocked(streamed, deposited),
      startAt,
      cliffAt,
      endAt,
      status: statusLabel(statusNum),
    };
  } catch (e) {
    console.error("[transparency] vesting read failed", e);
    return null;
  }
}

/**
 * Total supply, treasury holdings, price, and the derived distribution. Takes the
 * team-locked amount (from getVestingStatus) so circulating is the residual
 * supply − team-locked − treasury. Price is best-effort; the rest still renders
 * if DexScreener is down.
 */
export async function getTokenStats(teamLocked: number | null): Promise<TokenStats | null> {
  try {
    const provider = await paymentProvider();
    const token = new ethers.Contract(POLYGRAPH_TOKEN_ADDRESS, ERC20_ABI, provider);
    const totalSupply = toTokens(BigInt(await token.totalSupply()));

    let treasuryPolygraph = 0;
    let treasuryUsdc = 0;
    if (TREASURY_ADDRESS) {
      treasuryPolygraph = toTokens(BigInt(await token.balanceOf(TREASURY_ADDRESS)));
      const usdc = new ethers.Contract(USDC_BASE_ADDRESS, ERC20_ABI, provider);
      treasuryUsdc = toTokens(BigInt(await usdc.balanceOf(TREASURY_ADDRESS)), USDC_DECIMALS);
    }

    let priceUsd: number | null = null;
    try {
      priceUsd = await getTokenUsdRate();
    } catch {
      priceUsd = null; // price tile degrades on its own; supply/distribution stay
    }

    const slices = distribution(totalSupply, teamLocked ?? 0, treasuryPolygraph);
    const circulating = slices.find((s) => s.key === "circulating")?.amount ?? 0;

    return {
      contract: POLYGRAPH_TOKEN_ADDRESS,
      decimals: POLYGRAPH_TOKEN_DECIMALS,
      totalSupply,
      priceUsd,
      fdv: priceUsd != null ? priceUsd * totalSupply : null,
      marketCap: priceUsd != null ? priceUsd * circulating : null,
      treasuryAddress: TREASURY_ADDRESS,
      treasuryPolygraph,
      treasuryUsdc,
      distribution: slices,
    };
  } catch (e) {
    console.error("[transparency] token stats read failed", e);
    return null;
  }
}

/**
 * Booked revenue across every paid surface, de-identified. Selects only
 * non-identifying columns — payer wallet, email, graded target, and tx hash are
 * never fetched, so they cannot leak onto a public page. Returns null only when
 * Supabase is unconfigured or every table read fails; otherwise each surface
 * degrades independently.
 */
export async function getPublicRevenue(): Promise<PublicRevenue | null> {
  const db = getSupabaseAdmin();
  if (!db) return null;

  const [eco, plan, grade] = await Promise.all([
    db.from("ecosystem_payments").select("usd_total, usd_monthly, status, verified_at, end_at"),
    db.from("user_plan_payments").select("usd_total, usd_monthly, status, verified_at, end_at"),
    db.from("grade_request_payments").select("usd_price, token, paid_at").eq("status", "paid"),
  ]);

  if (eco.error) console.error("[transparency] ecosystem_payments:", eco.error.message);
  if (plan.error) console.error("[transparency] user_plan_payments:", plan.error.message);
  if (grade.error) console.error("[transparency] grade_request_payments:", grade.error.message);
  if (eco.error && plan.error && grade.error) return null;

  return buildPublicRevenue(
    {
      eco: (eco.data ?? []) as never[],
      plan: (plan.data ?? []) as never[],
      grade: (grade.data ?? []) as never[],
    },
    new Date(),
  );
}
