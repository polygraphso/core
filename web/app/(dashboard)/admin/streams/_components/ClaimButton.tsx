"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export function ClaimButton({
  kind,
  paymentId,
  withdrawable,
  disabled,
}: {
  kind: "ecosystem" | "plan";
  paymentId: string;
  withdrawable: number;
  disabled: boolean;
}) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<{ text: string; href?: string; error: boolean } | null>(null);

  async function claim() {
    setBusy(true);
    setMessage(null);
    const res = await fetch("/api/admin/streams/claim", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ kind, paymentId }),
    });
    const body = (await res.json().catch(() => ({}))) as { error?: string; txHash?: string };
    setBusy(false);
    if (!res.ok || !body.txHash) {
      setMessage({ text: body.error ?? "Claim failed.", error: true });
      return;
    }
    setMessage({ text: "Claimed", href: `https://basescan.org/tx/${body.txHash}`, error: false });
    router.refresh();
  }

  return (
    <div className="flex items-center gap-2 justify-end">
      {message ? (
        message.href ? (
          <a
            href={message.href}
            target="_blank"
            rel="noopener noreferrer"
            className="font-mono text-[11px] text-ink underline decoration-dotted hover:text-oxblood"
          >
            {message.text} ↗
          </a>
        ) : (
          <span className={`font-mono text-[11px] ${message.error ? "text-oxblood" : "text-ink-muted"}`}>
            {message.text}
          </span>
        )
      ) : null}
      <button
        type="button"
        onClick={claim}
        disabled={disabled || busy || withdrawable <= 0}
        className="font-mono text-[11px] uppercase tracking-[0.12em] border border-rule rounded-[3px] px-3 py-1.5 text-ink hover:border-oxblood hover:text-oxblood transition-colors disabled:opacity-40 disabled:pointer-events-none"
      >
        {busy ? "Claiming…" : "Claim"}
      </button>
    </div>
  );
}
