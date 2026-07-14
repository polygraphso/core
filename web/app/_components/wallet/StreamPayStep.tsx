"use client";

/**
 * The generic "connect → approve → create the Sablier stream → verify" step,
 * shared by every stream checkout (ecosystem activation, plan upgrades). The
 * caller owns the quote (its endpoint and refresh), the verify call (its
 * endpoint re-reads the stream onchain — nothing signed client-side is
 * trusted), and the shape tag that binds the stream to what's being bought.
 * Must render inside WalletIsland.
 */

import { useCallback, useState, type ReactNode } from "react";
import { useAppKit } from "@reown/appkit/react";
import { useAccount, useConfig, useDisconnect } from "wagmi";
import {
  readContract,
  switchChain,
  waitForTransactionReceipt,
  writeContract,
} from "@wagmi/core";
import {
  ERC20_ABI,
  MONTH_SECONDS,
  PAYMENT_CHAIN_ID,
  POLYGRAPH_TOKEN_SYMBOL,
  SABLIER_LOCKUP_ABI,
  type PaymentQuote,
} from "@/lib/paymentConfig";

export type VerifyFn = (
  txHash: string,
) => Promise<{ ok: true } | { ok: false; message: string }>;

type Step =
  | { id: "idle" }
  | { id: "approving" }
  | { id: "streaming" }
  | { id: "verifying" }
  | { id: "done" }
  | { id: "error"; message: string };

export function StreamPayStep({
  quote,
  shapeTag,
  verify,
  idleLabel,
  doneLabel,
  helper,
  success,
}: {
  quote: PaymentQuote | null;
  /** Onchain tag written into the stream's shape field; the verify route requires it back. */
  shapeTag: string;
  verify: VerifyFn;
  idleLabel: string;
  doneLabel: string;
  /** The paragraph under the pay button explaining the commitment. */
  helper: ReactNode;
  /** Rendered once the payment verified (when the caller doesn't navigate away). */
  success?: ReactNode;
}) {
  const config = useConfig();
  const { address, isConnected, chainId } = useAccount();
  const { open } = useAppKit();
  const { disconnect } = useDisconnect();
  const [step, setStep] = useState<Step>({ id: "idle" });

  const busy = step.id === "approving" || step.id === "streaming" || step.id === "verifying";

  const pay = useCallback(async () => {
    if (!quote || !address) return;
    try {
      if (chainId !== PAYMENT_CHAIN_ID) {
        await switchChain(config, { chainId: PAYMENT_CHAIN_ID });
      }
      const amount = BigInt(quote.tokenAmount);
      const token = quote.token as `0x${string}`;
      const lockup = quote.lockup as `0x${string}`;

      const balance = (await readContract(config, {
        abi: ERC20_ABI,
        address: token,
        functionName: "balanceOf",
        args: [address],
      })) as bigint;
      if (balance < amount) {
        setStep({
          id: "error",
          message: `This wallet holds ${formatTokens(balance)} ${POLYGRAPH_TOKEN_SYMBOL}; the stream needs ${formatTokens(amount)}. Use the swap above to top up, then retry.`,
        });
        return;
      }

      const allowance = (await readContract(config, {
        abi: ERC20_ABI,
        address: token,
        functionName: "allowance",
        args: [address, lockup],
      })) as bigint;
      if (allowance < amount) {
        setStep({ id: "approving" });
        const approveHash = await writeContract(config, {
          abi: ERC20_ABI,
          address: token,
          functionName: "approve",
          args: [lockup, amount],
          chainId: PAYMENT_CHAIN_ID,
        });
        await waitForTransactionReceipt(config, { hash: approveHash });
      }

      setStep({ id: "streaming" });
      const createHash = await writeContract(config, {
        abi: SABLIER_LOCKUP_ABI,
        address: lockup,
        functionName: "createWithDurationsLL",
        args: [
          {
            sender: address,
            recipient: quote.treasury as `0x${string}`,
            depositAmount: amount,
            token,
            cancelable: true,
            transferable: false,
            // Binds the stream to what's being bought; the verify route
            // requires it back from the creation event.
            shape: shapeTag,
          },
          { start: BigInt(0), cliff: BigInt(0) },
          0, // granularity: 0 is Sablier's sentinel for per-second streaming
          { cliff: 0, total: MONTH_SECONDS },
        ],
        value: BigInt(0),
        chainId: PAYMENT_CHAIN_ID,
      });
      await waitForTransactionReceipt(config, { hash: createHash });
      setStep({ id: "verifying" });
      const r = await verify(createHash);
      setStep(r.ok ? { id: "done" } : { id: "error", message: r.message });
    } catch (e) {
      const message = e instanceof Error ? e.message : String(e);
      setStep({ id: "error", message: shortenTxError(message) });
    }
  }, [address, chainId, config, quote, shapeTag, verify]);

  return (
    <div>
      {!isConnected ? (
        <button
          onClick={() => void open()}
          className="inline-flex items-center gap-2 rounded-[3px] bg-ink px-6 py-3.5 font-mono text-sm tracking-wide text-parchment transition-colors hover:bg-oxblood"
        >
          Connect wallet
        </button>
      ) : (
        <div>
          <div className="mb-4 flex flex-wrap items-center gap-x-4 gap-y-2 font-mono text-[12px] text-ink-muted">
            <span>
              {address?.slice(0, 6)}…{address?.slice(-4)} on Base
            </span>
            <button
              onClick={() => disconnect()}
              className="text-ink-faint underline decoration-dotted hover:text-oxblood"
            >
              disconnect
            </button>
          </div>
          <button
            disabled={!quote || busy}
            onClick={() => void pay()}
            className="inline-flex items-center gap-2 rounded-[3px] bg-ink px-6 py-3.5 font-mono text-sm tracking-wide text-parchment transition-colors hover:bg-oxblood disabled:opacity-50"
          >
            {step.id === "approving"
              ? "Approving…"
              : step.id === "streaming"
                ? "Creating the stream…"
                : step.id === "verifying"
                  ? "Verifying onchain…"
                  : step.id === "done"
                    ? doneLabel
                    : idleLabel}
          </button>
          <p className="mt-3 text-[13px] leading-relaxed text-ink-faint max-w-xl">{helper}</p>
        </div>
      )}

      {step.id === "done" && success ? success : null}

      {step.id === "error" ? (
        <div className="mt-5 border-l-2 pl-4" style={{ borderColor: "var(--color-oxblood)" }}>
          <p className="text-[14px] leading-relaxed text-ink">{step.message}</p>
          <button
            onClick={() => setStep({ id: "idle" })}
            className="mt-1 font-mono text-[12px] uppercase tracking-[0.14em] text-oxblood hover:underline"
          >
            dismiss
          </button>
        </div>
      ) : null}
    </div>
  );
}

/**
 * Recovery for a payment whose verify never ran (tab closed mid-flow, network
 * blip). Takes the creation TRANSACTION, not a stream id — the server derives
 * the stream from it and requires the right shape tag, so someone else's
 * stream can't be claimed here.
 */
export function ManualStreamVerify({
  verify,
  success,
}: {
  verify: VerifyFn;
  success?: ReactNode;
}) {
  const [txHash, setTxHash] = useState("");
  const [state, setState] = useState<
    { id: "idle" } | { id: "verifying" } | { id: "done" } | { id: "error"; message: string }
  >({ id: "idle" });

  return (
    <div className="mt-10 border-t hairline pt-5">
      <p className="font-mono text-[11px] uppercase tracking-[0.16em] text-ink-faint mb-2">
        Paid here but it didn&rsquo;t register?
      </p>
      <div className="flex flex-wrap items-center gap-3">
        <input
          value={txHash}
          onChange={(e) => setTxHash(e.target.value)}
          placeholder="stream creation tx hash (0x…)"
          spellCheck={false}
          className="w-96 max-w-full rounded-[3px] border border-rule bg-parchment-50 px-3 py-2 font-mono text-[13px] text-ink placeholder:text-ink-faint focus:outline-none focus:border-ink"
        />
        <button
          disabled={state.id === "verifying" || !/^0x[0-9a-fA-F]{64}$/.test(txHash.trim())}
          onClick={async () => {
            setState({ id: "verifying" });
            const r = await verify(txHash.trim());
            setState(r.ok ? { id: "done" } : { id: "error", message: r.message });
          }}
          className="font-mono text-[12px] uppercase tracking-[0.14em] text-ink-muted border border-rule rounded-[3px] px-4 py-2 hover:text-oxblood hover:border-oxblood/40 transition-colors disabled:opacity-50"
        >
          {state.id === "verifying" ? "verifying…" : "verify it"}
        </button>
      </div>
      {state.id === "error" ? (
        <p className="mt-2 text-[13px] text-ink leading-relaxed max-w-xl">{state.message}</p>
      ) : null}
      {state.id === "done" && success ? success : null}
    </div>
  );
}

export function formatTokens(raw: bigint): string {
  const whole = raw / BigInt("1000000000000000000"); // 18 decimals
  return new Intl.NumberFormat("en-US", { maximumFractionDigits: 0 }).format(whole);
}

/** Wallet errors arrive as multi-paragraph essays; keep the first line. */
function shortenTxError(message: string): string {
  const first = message.split("\n")[0]?.trim() ?? message;
  return first.length > 240 ? `${first.slice(0, 240)}…` : first;
}
