import "server-only";

/**
 * Admin claim surface for the payment rail's Sablier streams: every verified
 * stream (ecosystem monitoring + Pro plans) with its onchain deposited /
 * withdrawn / withdrawable amounts, and a server-side claim that pulls the
 * withdrawable balance to the stream's recipient (the treasury).
 *
 * The claim signer is a low-value ops key (PAYMENT_OPS_PRIVATE_KEY, server-only
 * env, never NEXT_PUBLIC): Sablier's withdraw is publicly callable as long as
 * `to` IS the stream's recipient (it reverts with WithdrawalAddressNotRecipient
 * otherwise), so this key can only ever spend gas + the v4 native withdraw fee.
 * The tokens land at the treasury no matter who signs.
 */

import { ethers } from "ethers";
import { getSupabaseAdmin } from "@/lib/supabase";
import { lockupContract, paymentProvider } from "@/lib/paymentRail";

export interface RevenueStream {
  kind: "ecosystem" | "plan";
  paymentId: string;
  /** ecosystem slug, or the plan id for a Pro plan stream. */
  label: string;
  streamId: number;
  contract: string;
  payer: string;
  status: string;
  startAt: string;
  endAt: string;
  /** Token display units (POLYGRAPH), safe for UI only — not for math. */
  deposited: number;
  withdrawn: number;
  withdrawable: number;
}

interface PaymentStreamRow {
  id: string;
  stream_id: number;
  sablier_contract: string;
  token_decimals: number;
  payer_address: string;
  status: string;
  start_at: string;
  end_at: string;
}

const STREAM_COLUMNS =
  "id, stream_id, sablier_contract, token_decimals, payer_address, status, start_at, end_at";
const LIST_CAP = 100;

/**
 * All verified payment streams, newest first, with live onchain amounts.
 * Reads are sequential on purpose — the public Base RPC rate-limits bursts
 * (same constraint as readStreamCreation).
 */
export async function listRevenueStreams(): Promise<RevenueStream[]> {
  const db = getSupabaseAdmin();
  if (!db) return [];

  const [eco, plans] = await Promise.all([
    db
      .from("ecosystem_payments")
      .select(`${STREAM_COLUMNS}, ecosystems(slug)`)
      .order("created_at", { ascending: false })
      .limit(LIST_CAP),
    db
      .from("user_plan_payments")
      .select(`${STREAM_COLUMNS}, plan`)
      .order("created_at", { ascending: false })
      .limit(LIST_CAP),
  ]);

  const rows: Array<{ kind: "ecosystem" | "plan"; label: string; row: PaymentStreamRow }> = [];
  for (const r of (eco.data ?? []) as Array<PaymentStreamRow & { ecosystems: { slug: string } | { slug: string }[] | null }>) {
    const ecoRel = Array.isArray(r.ecosystems) ? r.ecosystems[0] : r.ecosystems;
    rows.push({ kind: "ecosystem", label: ecoRel?.slug ?? "—", row: r });
  }
  for (const r of (plans.data ?? []) as Array<PaymentStreamRow & { plan: string }>) {
    rows.push({ kind: "plan", label: r.plan, row: r });
  }
  rows.sort((a, b) => (a.row.start_at < b.row.start_at ? 1 : -1));

  const provider = await paymentProvider();
  const streams: RevenueStream[] = [];
  for (const { kind, label, row } of rows) {
    const lockup = lockupContract(provider, row.sablier_contract);
    let deposited = BigInt(0);
    let withdrawn = BigInt(0);
    let withdrawable = BigInt(0);
    try {
      deposited = BigInt(await lockup.getDepositedAmount(row.stream_id));
      withdrawn = BigInt(await lockup.getWithdrawnAmount(row.stream_id));
      withdrawable = BigInt(await lockup.withdrawableAmountOf(row.stream_id));
    } catch (e) {
      console.error(`[streams] onchain read failed for stream ${row.stream_id}`, e);
    }
    const display = (v: bigint) => Number(ethers.formatUnits(v, row.token_decimals));
    streams.push({
      kind,
      paymentId: row.id,
      label,
      streamId: row.stream_id,
      contract: row.sablier_contract,
      payer: row.payer_address,
      status: row.status,
      startAt: row.start_at,
      endAt: row.end_at,
      deposited: display(deposited),
      withdrawn: display(withdrawn),
      withdrawable: display(withdrawable),
    });
  }
  return streams;
}

export interface OpsSignerStatus {
  configured: boolean;
  address?: string;
  /** Native ETH balance on Base, display units — the gas + withdraw-fee budget. */
  balanceEth?: number;
}

function opsWallet(provider: ethers.JsonRpcProvider): ethers.Wallet | null {
  const key = process.env.PAYMENT_OPS_PRIVATE_KEY?.trim();
  if (!key) return null;
  try {
    return new ethers.Wallet(key, provider);
  } catch {
    console.error("[streams] PAYMENT_OPS_PRIVATE_KEY is set but not a valid key");
    return null;
  }
}

export async function opsSignerStatus(): Promise<OpsSignerStatus> {
  try {
    const provider = await paymentProvider();
    const wallet = opsWallet(provider);
    if (!wallet) return { configured: false };
    const balance = await provider.getBalance(wallet.address);
    return {
      configured: true,
      address: wallet.address,
      balanceEth: Number(ethers.formatEther(balance)),
    };
  } catch {
    return { configured: false };
  }
}

export type ClaimResult =
  | { ok: true; txHash: string; amount: number }
  | { ok: false; reason: string };

/**
 * Withdraw a stream's full withdrawable balance to its recipient. `to` is read
 * from the chain (getRecipient), never from input — combined with Sablier's
 * recipient check this makes the call unable to move funds anywhere else.
 */
export async function claimStream(kind: "ecosystem" | "plan", paymentId: string): Promise<ClaimResult> {
  const db = getSupabaseAdmin();
  if (!db) return { ok: false, reason: "database unavailable" };

  const table = kind === "ecosystem" ? "ecosystem_payments" : "user_plan_payments";
  const { data: row, error } = await db
    .from(table)
    .select(STREAM_COLUMNS)
    .eq("id", paymentId)
    .maybeSingle();
  if (error || !row) return { ok: false, reason: "payment not found" };
  const payment = row as PaymentStreamRow;

  try {
    const provider = await paymentProvider();
    const wallet = opsWallet(provider);
    if (!wallet) return { ok: false, reason: "claim signer not configured (PAYMENT_OPS_PRIVATE_KEY)" };

    const lockup = lockupContract(provider, payment.sablier_contract);
    const withdrawable = BigInt(await lockup.withdrawableAmountOf(payment.stream_id));
    if (withdrawable === BigInt(0)) return { ok: false, reason: "nothing withdrawable yet" };

    const recipient = String(await lockup.getRecipient(payment.stream_id));
    const feeWei = BigInt(await lockup.calculateMinFeeWei(payment.stream_id));
    const balance = await provider.getBalance(wallet.address);
    if (balance <= feeWei) {
      return {
        ok: false,
        reason: `ops wallet ${wallet.address} needs ETH on Base: withdraw fee is ${ethers.formatEther(feeWei)} ETH plus gas`,
      };
    }

    const writable = lockup.connect(wallet) as ethers.Contract;
    const tx = await writable.withdrawMax(payment.stream_id, recipient, { value: feeWei });
    const receipt = await tx.wait();
    if (!receipt || receipt.status !== 1) return { ok: false, reason: "withdraw transaction reverted" };

    return {
      ok: true,
      txHash: String(tx.hash),
      amount: Number(ethers.formatUnits(withdrawable, payment.token_decimals)),
    };
  } catch (e) {
    console.error(`[streams] claim failed for ${kind} payment ${paymentId}`, e);
    const detail = e instanceof Error ? e.message : String(e);
    return { ok: false, reason: `claim failed onchain: ${detail.slice(0, 200)}` };
  }
}
