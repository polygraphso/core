"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

/** Create a blank draft thread, then jump straight into its editor. */
export function NewThreadButton() {
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const router = useRouter();

  async function go() {
    setBusy(true);
    setErr(null);
    try {
      const res = await fetch("/api/admin/twitter", {
        method: "POST",
        headers: { "content-type": "application/json" },
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok || !json.id) {
        setErr(json.error ?? "Failed");
        return;
      }
      router.push(`/admin/twitter/${json.id}`);
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Failed");
    } finally {
      setBusy(false);
    }
  }

  return (
    <span className="inline-flex items-center gap-2">
      <button
        type="button"
        disabled={busy}
        onClick={go}
        className="font-mono text-[11px] border px-3 py-1.5 hover:bg-ink/5 disabled:opacity-50 whitespace-nowrap"
      >
        {busy ? "creating…" : "+ New thread"}
      </button>
      {err && <span className="text-oxblood text-[11px]">{err}</span>}
    </span>
  );
}
