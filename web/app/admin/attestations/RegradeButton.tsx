"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

const POLL_MS = 3000;
const MAX_POLLS = 40; // ~2 min ceiling — server grades run the full sandbox (~60s)

/** Re-run the hosted grade for a target via the admin proxy, then poll the job
 *  to completion and refresh so the fresh (draft) run appears. `targetKind` is
 *  the DB kind (registry_ref | skill); the runner wants server | skill. */
export function RegradeButton({ target, targetKind }: { target: string; targetKind: string }) {
  const [grading, setGrading] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const router = useRouter();

  async function poll(id: string) {
    for (let i = 0; i < MAX_POLLS; i++) {
      await new Promise((r) => setTimeout(r, POLL_MS));
      try {
        const res = await fetch(`/api/admin/regrade?id=${encodeURIComponent(id)}`);
        const json = await res.json().catch(() => ({}));
        if (json.status === "done") {
          setGrading(false);
          router.refresh();
          return;
        }
        if (json.status === "error") {
          setErr(json.error ?? "Grade failed");
          setGrading(false);
          return;
        }
      } catch {
        // transient network blip — keep polling
      }
    }
    setErr("Timed out — refresh to check");
    setGrading(false);
  }

  async function go() {
    setErr(null);
    setGrading(true);
    const kind = targetKind === "skill" ? "skill" : "server";
    try {
      const res = await fetch("/api/admin/regrade", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ target, kind }),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok || !json.id) {
        setErr(json.error ?? "Failed to start");
        setGrading(false);
        return;
      }
      await poll(json.id as string);
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Failed");
      setGrading(false);
    }
  }

  return (
    <span className="inline-flex items-center gap-2">
      <button
        type="button"
        disabled={grading}
        onClick={go}
        className="font-mono text-[11px] border px-2 py-1 hover:bg-ink/5 disabled:opacity-50"
      >
        {grading ? "grading…" : "Re-grade"}
      </button>
      {err && <span className="text-oxblood text-[11px]">{err}</span>}
    </span>
  );
}
