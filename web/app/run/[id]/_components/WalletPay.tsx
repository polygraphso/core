"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import {
  WagmiProvider,
  createConfig,
  http,
  useAccount,
  useConnect,
  useDisconnect,
  useSwitchChain,
  useWriteContract,
  useWaitForTransactionReceipt,
} from "wagmi";
import { base } from "wagmi/chains";
import { injected, coinbaseWallet } from "wagmi/connectors";
import { erc20Abi } from "viem";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";

// One-click USDC payment, kept as a self-contained island: the wagmi +
// react-query providers live inside this component so the rest of the
// site ships zero wallet JS. Manual tx-hash paste (in RunView) remains
// the fallback for wallets we can't connect to.
//
// Flow: connect → ensure Base → erc20 transfer(treasury, price) → wait
// for the receipt → hand the tx hash to the parent, which submits it to
// /api/runs/:id/pay (the server re-verifies on-chain; the client is
// never trusted about money).

const USDC_BASE = "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913" as const;

const wagmiConfig = createConfig({
  chains: [base],
  connectors: [injected(), coinbaseWallet({ appName: "polygraph.so" })],
  transports: { [base.id]: http() },
});

type Props = {
  treasury: string;
  priceUnits: string; // USDC 6-decimal units, stringified bigint
  priceDisplay: string;
  onTxConfirmed: (txHash: string) => void;
  busy: boolean; // parent is submitting/verifying the hash server-side
};

export function WalletPay(props: Props) {
  const [queryClient] = useState(() => new QueryClient());
  return (
    <WagmiProvider config={wagmiConfig}>
      <QueryClientProvider client={queryClient}>
        <WalletPayInner {...props} />
      </QueryClientProvider>
    </WagmiProvider>
  );
}

function WalletPayInner({
  treasury,
  priceUnits,
  priceDisplay,
  onTxConfirmed,
  busy,
}: Props) {
  const { address, isConnected, chainId } = useAccount();
  const { connectors, connect, isPending: connecting } = useConnect();
  const { disconnect } = useDisconnect();
  const { switchChainAsync } = useSwitchChain();
  const { writeContractAsync } = useWriteContract();
  const [txHash, setTxHash] = useState<`0x${string}` | undefined>(undefined);
  const [error, setError] = useState("");
  const [sending, setSending] = useState(false);

  const receipt = useWaitForTransactionReceipt({
    hash: txHash,
    chainId: base.id,
    query: { enabled: Boolean(txHash) },
  });

  // Receipt landed → hand off to the server exactly once. Effect, not
  // render-time: calling the parent's setState during render is a React
  // error and could double-fire under strict mode.
  const handedOff = useRef(false);
  useEffect(() => {
    if (receipt.isSuccess && txHash && !handedOff.current) {
      handedOff.current = true;
      onTxConfirmed(txHash);
    }
  }, [receipt.isSuccess, txHash, onTxConfirmed]);

  // Dedupe connectors by name (injected can shadow specific wallets).
  const visibleConnectors = useMemo(() => {
    const seen = new Set<string>();
    return connectors.filter((c) => {
      if (seen.has(c.name)) return false;
      seen.add(c.name);
      return true;
    });
  }, [connectors]);

  async function pay() {
    setError("");
    setSending(true);
    try {
      if (chainId !== base.id) {
        await switchChainAsync({ chainId: base.id });
      }
      const hash = await writeContractAsync({
        abi: erc20Abi,
        address: USDC_BASE,
        functionName: "transfer",
        args: [treasury as `0x${string}`, BigInt(priceUnits)],
        chainId: base.id,
      });
      setTxHash(hash);
    } catch (err) {
      // User rejection and wallet errors both land here; show the short form.
      const msg =
        err instanceof Error ? err.message.split("\n")[0] : "Payment failed.";
      setError(msg);
    } finally {
      setSending(false);
    }
  }

  if (!isConnected) {
    return (
      <div className="space-y-2">
        <p className="font-mono text-[11px] uppercase tracking-[0.16em] text-ink-faint">
          01 → pay with a wallet
        </p>
        <div className="flex flex-wrap gap-2">
          {visibleConnectors.map((c) => (
            <button
              key={c.uid}
              type="button"
              disabled={connecting}
              onClick={() => connect({ connector: c })}
              className="inline-flex items-center justify-center bg-ink text-parchment px-4 py-2.5 font-mono text-[12.5px] tracking-wide hover:bg-oxblood transition-colors disabled:opacity-60"
            >
              {connecting
                ? "Connecting…"
                : `Connect ${c.name === "Injected" ? "browser wallet" : c.name}`}
            </button>
          ))}
        </div>
      </div>
    );
  }

  const waiting = Boolean(txHash) && !receipt.isSuccess && !receipt.isError;

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <p className="font-mono text-[11px] text-ink-faint break-all">
          connected{" "}
          <span className="text-ink-muted">
            {address?.slice(0, 6)}…{address?.slice(-4)}
          </span>
        </p>
        <button
          type="button"
          onClick={() => disconnect()}
          className="font-mono text-[10.5px] uppercase tracking-[0.14em] text-ink-faint hover:text-ink transition-colors border-b hairline border-dotted"
        >
          disconnect
        </button>
      </div>

      <button
        type="button"
        disabled={sending || waiting || busy}
        onClick={pay}
        className="inline-flex items-center justify-center bg-ink text-parchment px-5 py-3 font-mono text-sm tracking-wide hover:bg-oxblood transition-colors disabled:opacity-60 disabled:cursor-not-allowed"
      >
        {waiting || busy
          ? "Confirming on Base…"
          : sending
            ? "Check your wallet…"
            : `Pay ${priceDisplay} on Base`}
      </button>

      {receipt.isError && (
        <p className="font-mono text-[12px] text-oxblood">
          The transaction failed on-chain. Nothing was charged beyond gas —
          try again.
        </p>
      )}
      {error && <p className="font-mono text-[12px] text-oxblood">{error}</p>}
    </div>
  );
}
