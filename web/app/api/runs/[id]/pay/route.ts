/**
 * POST /api/runs/:id/pay — verify a USDC-on-Base payment and queue the run.
 *
 * Body: { tx_hash: string }
 *
 * Modes (PAYMENT_MODE env):
 *   onchain  — verify the tx via JSON-RPC: receipt success, a USDC Transfer
 *              log to TREASURY_ADDRESS with value ≥ RUN_PRICE_USDC, and
 *              ≥ MIN_CONFIRMATIONS confirmations. The unique constraint on
 *              hosted_runs.payment_tx is the replay guard (one tx = one run).
 *   mock     — mark paid without verification. Dev only; never set in prod.
 *   disabled — 503. Default when unset/misconfigured: nothing half-works.
 *
 * Verification is intentionally conservative: any ambiguity → 402 with a
 * human-readable reason, run stays 'created', the user can retry. Money
 * errors should fail closed.
 */

import { NextResponse } from "next/server";
import {
  getRunsSupabase,
  paymentConfig,
  publicRun,
  MIN_CONFIRMATIONS,
  RUN_SELECT_COLUMNS,
  USDC_BASE_CONTRACT,
  type HostedRunRow,
} from "@/lib/runs";

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const TX_HASH_RE = /^0x[0-9a-f]{64}$/i;

// keccak256("Transfer(address,address,uint256)")
const TRANSFER_TOPIC =
  "0xddf252ad1be2c89b69c2b068fc378daa952ba7f163c4a11628f55a4df523b3ef";

interface RpcLog {
  address: string;
  topics: string[];
  data: string;
}

interface RpcReceipt {
  status: string;
  blockNumber: string;
  logs: RpcLog[];
}

async function rpc<T>(url: string, method: string, params: unknown[]): Promise<T> {
  const res = await fetch(url, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ jsonrpc: "2.0", id: 1, method, params }),
    // Payment verification must not hang the route.
    signal: AbortSignal.timeout(10_000),
  });
  if (!res.ok) throw new Error(`RPC ${method} HTTP ${res.status}`);
  const body = (await res.json()) as { result?: T; error?: { message: string } };
  if (body.error) throw new Error(`RPC ${method}: ${body.error.message}`);
  return body.result as T;
}

function topicToAddress(topic: string): string {
  // indexed address topics are left-padded to 32 bytes
  return ("0x" + topic.slice(-40)).toLowerCase();
}

/** Returns the payer address on success, or a refusal. `retryable` marks
 *  refusals that resolve by waiting (pending tx, confirmation window) so
 *  the client can poll instead of surfacing an error. */
async function verifyOnchain(
  rpcUrl: string,
  txHash: string,
  treasury: string,
  priceUnits: bigint,
): Promise<{ payer: string } | { refusal: string; retryable: boolean }> {
  const receipt = await rpc<RpcReceipt | null>(
    rpcUrl,
    "eth_getTransactionReceipt",
    [txHash],
  );
  if (!receipt) {
    return {
      refusal: "Transaction not found yet — wait for it to confirm and retry.",
      retryable: true,
    };
  }
  if (receipt.status !== "0x1") {
    return { refusal: "Transaction reverted on-chain.", retryable: false };
  }

  const treasuryLower = treasury.toLowerCase();
  const transfer = receipt.logs.find(
    (log) =>
      log.address.toLowerCase() === USDC_BASE_CONTRACT.toLowerCase() &&
      log.topics[0] === TRANSFER_TOPIC &&
      log.topics.length >= 3 &&
      topicToAddress(log.topics[2]) === treasuryLower &&
      BigInt(log.data) >= priceUnits,
  );
  if (!transfer) {
    return {
      refusal:
        "No USDC transfer to the treasury address covering the price was found in that transaction.",
      retryable: false,
    };
  }

  const currentBlockHex = await rpc<string>(rpcUrl, "eth_blockNumber", []);
  const confirmations =
    Number(BigInt(currentBlockHex) - BigInt(receipt.blockNumber)) + 1;
  if (confirmations < MIN_CONFIRMATIONS) {
    return {
      refusal: `Waiting for confirmations (${confirmations}/${MIN_CONFIRMATIONS}) — retry in a few seconds.`,
      retryable: true,
    };
  }

  return { payer: topicToAddress(transfer.topics[1]) };
}

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  if (!UUID_RE.test(id)) {
    return NextResponse.json(
      { ok: false, message: "Invalid run id." },
      { status: 400 },
    );
  }

  const pay = paymentConfig();
  if (pay.mode === "disabled") {
    return NextResponse.json(
      { ok: false, message: "Payments aren't open yet." },
      { status: 503 },
    );
  }

  let payload: unknown;
  try {
    payload = await request.json();
  } catch {
    return NextResponse.json(
      { ok: false, message: "Invalid JSON body." },
      { status: 400 },
    );
  }
  const { tx_hash } = (payload ?? {}) as { tx_hash?: unknown };

  if (pay.mode === "onchain" && (typeof tx_hash !== "string" || !TX_HASH_RE.test(tx_hash))) {
    return NextResponse.json(
      { ok: false, message: "Enter the transaction hash (0x…, 64 hex chars)." },
      { status: 400 },
    );
  }

  const supabase = getRunsSupabase();

  const { data: existing, error: lookupError } = await supabase
    .from("hosted_runs")
    .select("id, status, price_usdc")
    .eq("id", id)
    .maybeSingle();

  if (lookupError) {
    console.error("[runs/pay] lookup failed:", lookupError.message);
    return NextResponse.json(
      { ok: false, message: "Lookup failed. Try again." },
      { status: 500 },
    );
  }
  if (!existing) {
    return NextResponse.json(
      { ok: false, message: "Run not found." },
      { status: 404 },
    );
  }
  if (existing.status !== "created") {
    return NextResponse.json(
      { ok: false, message: "This run is already paid." },
      { status: 409 },
    );
  }

  let payer: string | null = null;
  let verifiedTx: string | null = null;

  if (pay.mode === "onchain") {
    // Price locked at creation when configured; fall back to current config.
    const price = existing.price_usdc
      ? BigInt(existing.price_usdc)
      : pay.priceUnits;
    if (!price || !pay.treasury) {
      return NextResponse.json(
        { ok: false, message: "Payments aren't open yet." },
        { status: 503 },
      );
    }
    try {
      const result = await verifyOnchain(
        pay.rpcUrl,
        (tx_hash as string).toLowerCase(),
        pay.treasury,
        price,
      );
      if ("refusal" in result) {
        return NextResponse.json(
          { ok: false, message: result.refusal, retryable: result.retryable },
          { status: 402 },
        );
      }
      payer = result.payer;
      verifiedTx = (tx_hash as string).toLowerCase();
    } catch (err) {
      console.error(
        "[runs/pay] verification error:",
        err instanceof Error ? err.message : String(err),
      );
      return NextResponse.json(
        { ok: false, message: "Couldn't verify the transaction. Try again." },
        { status: 502 },
      );
    }
  } else {
    // mock mode — dev convenience only
    verifiedTx = `mock-${id}`;
  }

  const { data: updated, error: updateError } = await supabase
    .from("hosted_runs")
    .update({
      status: "queued",
      payment_tx: verifiedTx,
      // Rail-agnostic columns (20260611220000 migration): the open
      // Stripe-vs-onchain decision lands here as a new provider value,
      // not a schema change.
      payment_provider: pay.mode === "onchain" ? "usdc_base" : null,
      payment_ref: verifiedTx,
      payer_address: payer,
      paid_at: new Date().toISOString(),
    })
    .eq("id", id)
    .eq("status", "created") // guard against double-pay races
    .select(RUN_SELECT_COLUMNS)
    .maybeSingle();

  if (updateError) {
    // 23505 = payment_tx unique violation → that tx already paid for a run
    const isReplay = updateError.code === "23505";
    if (!isReplay) console.error("[runs/pay] update failed:", updateError.message);
    return NextResponse.json(
      {
        ok: false,
        message: isReplay
          ? "That transaction already paid for another run."
          : "Couldn't record the payment. Contact hello@polygraph.so with your tx hash.",
      },
      { status: isReplay ? 409 : 500 },
    );
  }
  if (!updated) {
    return NextResponse.json(
      { ok: false, message: "This run is already paid." },
      { status: 409 },
    );
  }

  return NextResponse.json({ ok: true, run: publicRun(updated as HostedRunRow) });
}
