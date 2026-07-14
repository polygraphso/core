import "server-only";

/**
 * Shared onchain plumbing for the $POLYGRAPH payment rail: the Base-mainnet
 * provider, the Sablier Lockup surface, pricing, and the one read every verify
 * route does — derive a stream's immutable facts from its CREATION TRANSACTION
 * (never from a client-supplied stream id). Consumers (ecosystemPayments,
 * userPlans) own their tables, policies, and DB writes; this module owns the
 * chain.
 */

import { ethers } from "ethers";
import {
  PAYMENT_CHAIN_ID,
  POLYGRAPH_TOKEN_ADDRESS,
  POLYGRAPH_TOKEN_DECIMALS,
  SABLIER_LOCKUP_ABI,
  SABLIER_LOCKUP_ADDRESS,
  STREAM_STATUS,
} from "@/lib/paymentConfig";

/**
 * The payment rail is Base MAINNET by definition, independent of the EAS
 * attestation chain — BASE_RPC_URL is deliberately NOT reused here (in dev it
 * points at Base Sepolia for attestation testing, which made every payment
 * read look up the wrong chain). PAYMENT_RPC_URL overrides the default public
 * endpoint; the chain id is asserted so a misconfigured RPC fails loudly
 * instead of "transaction not found".
 */
export async function paymentProvider(): Promise<ethers.JsonRpcProvider> {
  const rpc = process.env.PAYMENT_RPC_URL?.trim() || "https://mainnet.base.org";
  const provider = new ethers.JsonRpcProvider(rpc);
  const net = await provider.getNetwork();
  if (Number(net.chainId) !== PAYMENT_CHAIN_ID) {
    throw new Error(
      `payment RPC serves chain ${net.chainId}, expected Base mainnet (${PAYMENT_CHAIN_ID})`,
    );
  }
  return provider;
}

export function lockupContract(
  provider: ethers.JsonRpcProvider,
  address: string = SABLIER_LOCKUP_ADDRESS,
): ethers.Contract {
  return new ethers.Contract(address, SABLIER_LOCKUP_ABI, provider);
}

/** The immutable creation facts + the two mutable flags a verify needs. */
export interface StreamCreationFacts {
  streamId: bigint;
  token: string;
  recipient: string;
  sender: string;
  deposited: bigint;
  startTime: number;
  endTime: number;
  shape: string;
  canceled: boolean;
  depleted: boolean;
}

export type StreamReadResult =
  | { ok: true; onchain: StreamCreationFacts }
  | { ok: false; reason: string };

/**
 * Read a Sablier stream from its creation tx. Sequential reads on purpose: the
 * default public Base RPC rate-limits parallel call bursts (observed live).
 */
export async function readStreamCreation(txHash: string): Promise<StreamReadResult> {
  try {
    const provider = await paymentProvider();
    const receipt = await provider.getTransactionReceipt(txHash);
    if (!receipt) {
      return {
        ok: false,
        reason:
          "transaction not found on Base mainnet — if it just went through, retry in a few seconds; make sure it's a Base transaction",
      };
    }
    if (receipt.status !== 1) return { ok: false, reason: "transaction reverted" };

    const iface = new ethers.Interface(SABLIER_LOCKUP_ABI);
    let created: ethers.LogDescription | null = null;
    for (const log of receipt.logs) {
      if (log.address.toLowerCase() !== SABLIER_LOCKUP_ADDRESS.toLowerCase()) continue;
      let parsed: ethers.LogDescription | null = null;
      try {
        parsed = iface.parseLog({ topics: [...log.topics], data: log.data });
      } catch {
        continue;
      }
      if (parsed?.name === "CreateLockupLinearStream") {
        created = parsed;
        break;
      }
    }
    if (!created) {
      return { ok: false, reason: "transaction did not create a Sablier stream on this contract" };
    }
    const cp = created.args.commonParams;
    const streamId = BigInt(created.args.streamId);

    const lockup = lockupContract(provider);
    const canceled = await lockup.wasCanceled(streamId);
    const depleted = await lockup.isDepleted(streamId);

    return {
      ok: true,
      onchain: {
        streamId,
        token: String(cp.token),
        recipient: String(cp.recipient),
        sender: String(cp.sender),
        deposited: BigInt(cp.depositAmount),
        startTime: Number(cp.timestamps.start),
        endTime: Number(cp.timestamps.end),
        shape: String(cp.shape),
        canceled: Boolean(canceled),
        depleted: Boolean(depleted),
      },
    };
  } catch (e) {
    console.error("[payments] stream read failed", e);
    return { ok: false, reason: "could not read the transaction onchain" };
  }
}

/**
 * The live status of a stream, reduced to what a payment gate cares about.
 * Throws on RPC failure — callers keep their row untouched (never lock a
 * paying customer out on RPC flake).
 */
export async function liveStreamStatus(
  sablierContract: string,
  streamId: number,
): Promise<"live" | "canceled" | "ended"> {
  const lockup = lockupContract(await paymentProvider(), sablierContract);
  const status = Number(await lockup.statusOf(streamId));
  if (status === STREAM_STATUS.CANCELED) return "canceled";
  if (status === STREAM_STATUS.DEPLETED) return "ended";
  return "live";
}

// ── Pricing ──────────────────────────────────────────────────────────────────

const DEXSCREENER_URL = `https://api.dexscreener.com/latest/dex/tokens/${POLYGRAPH_TOKEN_ADDRESS}`;
const PRICE_TTL_MS = 60 * 1000;

let priceCache: { rate: number; fetchedAt: number } | null = null;

interface DexScreenerPair {
  chainId?: string;
  priceUsd?: string;
  liquidity?: { usd?: number };
}

/** USD per $POLYGRAPH from the deepest Base pair. Throws when unavailable. */
export async function getTokenUsdRate(): Promise<number> {
  if (priceCache && Date.now() - priceCache.fetchedAt < PRICE_TTL_MS) return priceCache.rate;
  const res = await fetch(DEXSCREENER_URL, { cache: "no-store" });
  if (!res.ok) throw new Error(`dexscreener ${res.status}`);
  const body = (await res.json()) as { pairs?: DexScreenerPair[] };
  const best = (body.pairs ?? [])
    .filter((p) => p.chainId === "base" && p.priceUsd)
    .sort((a, b) => (b.liquidity?.usd ?? 0) - (a.liquidity?.usd ?? 0))[0];
  const rate = best ? Number.parseFloat(best.priceUsd as string) : NaN;
  if (!Number.isFinite(rate) || rate <= 0) throw new Error("no usable POLYGRAPH price");
  priceCache = { rate, fetchedAt: Date.now() };
  return rate;
}

/** Convert a USD total into raw token units at the given rate. */
export function usdToRawTokens(usdTotal: number, rate: number): bigint {
  const tokens = usdTotal / rate;
  // 6 fractional digits is far inside the 5% verify tolerance; parseUnits keeps
  // the 1e18 scaling exact.
  return ethers.parseUnits(tokens.toFixed(6), POLYGRAPH_TOKEN_DECIMALS);
}
