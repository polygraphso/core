"use client";

/**
 * Inline monitoring-price editor for one ecosystem row on /admin/ecosystems.
 * Blank = app default; 0 = comped (no payment required); anything else =
 * USD/month. Saves via PATCH /api/admin/ecosystems/[id] and refreshes the page
 * so the payment-status chip re-derives.
 */

import { useState } from "react";
import { useRouter } from "next/navigation";

export function PriceForm({
  ecosystemId,
  initial,
}: {
  ecosystemId: string;
  initial: number | null;
}) {
  const router = useRouter();
  const [value, setValue] = useState(initial === null ? "" : String(initial));
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const dirty = value.trim() !== (initial === null ? "" : String(initial));

  async function save() {
    const trimmed = value.trim();
    const price = trimmed === "" ? null : Number(trimmed);
    if (price !== null && (!Number.isFinite(price) || price < 0)) {
      setError("Enter a non-negative number, or leave blank for the default.");
      return;
    }
    setSaving(true);
    setError(null);
    try {
      const res = await fetch(`/api/admin/ecosystems/${ecosystemId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ monthly_price_usd: price }),
      });
      const body = (await res.json()) as { error?: string };
      if (!res.ok) throw new Error(body.error ?? `save failed (${res.status})`);
      router.refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="flex items-center gap-2">
      <span className="font-mono text-[11px] text-ink-faint">$</span>
      <input
        value={value}
        onChange={(e) => setValue(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Enter" && dirty && !saving) void save();
        }}
        placeholder="199"
        inputMode="decimal"
        title="USD/month · blank = default · 0 = comped"
        className="w-16 rounded-[3px] border border-rule bg-parchment-50 px-2 py-1 font-mono text-[12px] text-ink placeholder:text-ink-faint focus:outline-none focus:border-ink"
      />
      <span className="font-mono text-[11px] text-ink-faint">/mo</span>
      {dirty ? (
        <button
          disabled={saving}
          onClick={() => void save()}
          className="font-mono text-[10px] uppercase tracking-[0.14em] text-oxblood hover:underline disabled:opacity-50"
        >
          {saving ? "saving…" : "save"}
        </button>
      ) : null}
      {error ? <span className="font-mono text-[10px] text-oxblood">{error}</span> : null}
    </div>
  );
}
