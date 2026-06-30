"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

/** Publish a graded-but-draft run (sets published_at), making it live + mintable. */
export function PublishButton({ hostedRunId }: { hostedRunId: string }) {
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const router = useRouter();

  async function go() {
    setBusy(true);
    setErr(null);
    try {
      const res = await fetch("/api/admin/publish", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ hosted_run_id: hostedRunId }),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) setErr(json.error ?? "Failed");
      router.refresh();
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
        className="font-mono text-[11px] border px-2 py-1 hover:bg-ink/5 disabled:opacity-50"
      >
        {busy ? "publishing…" : "Publish"}
      </button>
      {err && <span className="text-oxblood text-[11px]">{err}</span>}
    </span>
  );
}
