"use client";

import { useState, useRef, useEffect } from "react";
import { useRouter } from "next/navigation";
import { formatElapsed } from "@/lib/attestations/adminTable";

const POLL_MS = 3000;
const MAX_POLLS = 40; // ~2 min ceiling — server grades run the full sandbox (~60s)

type Phase = "idle" | "queued" | "running" | "done";

/** Re-run the hosted grade for a target via the admin proxy, then poll the job
 *  to completion and refresh so the fresh (draft) run appears. The grade runs on
 *  the hosted runner (not Vercel) — this just polls the status every 3s — so the
 *  UI surfaces the live phase (queued → running), an elapsed timer, and the
 *  resulting grade. `targetKind` is the DB kind (registry_ref | skill); the
 *  runner wants server | skill. */
export function RegradeButton({ target, targetKind }: { target: string; targetKind: string }) {
  const [phase, setPhase] = useState<Phase>("idle");
  const [elapsed, setElapsed] = useState(0);
  const [grade, setGrade] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const router = useRouter();

  const stopTimer = () => {
    if (timerRef.current) clearInterval(timerRef.current);
    timerRef.current = null;
  };
  useEffect(() => stopTimer, []);

  const busy = phase === "queued" || phase === "running";

  async function poll(id: string) {
    for (let i = 0; i < MAX_POLLS; i++) {
      await new Promise((r) => setTimeout(r, POLL_MS));
      try {
        const res = await fetch(`/api/admin/regrade?id=${encodeURIComponent(id)}`);
        const json = await res.json().catch(() => ({}));
        if (json.status === "running" || json.status === "queued") {
          setPhase(json.status);
        } else if (json.status === "done") {
          stopTimer();
          setPhase("done");
          setGrade(typeof json.grade === "string" ? json.grade : null);
          setTimeout(() => {
            setPhase("idle");
            router.refresh();
          }, 1500);
          return;
        } else if (json.status === "error") {
          stopTimer();
          setErr(json.error ?? "Grade failed");
          setPhase("idle");
          return;
        }
      } catch {
        // transient network blip — keep polling
      }
    }
    stopTimer();
    setErr("Timed out — refresh to check");
    setPhase("idle");
  }

  async function go() {
    setErr(null);
    setGrade(null);
    setElapsed(0);
    setPhase("queued");
    const start = Date.now();
    timerRef.current = setInterval(() => setElapsed(Math.floor((Date.now() - start) / 1000)), 1000);
    const kind = targetKind === "skill" ? "skill" : "server";
    try {
      const res = await fetch("/api/admin/regrade", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ target, kind }),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok || !json.id) {
        stopTimer();
        setErr(json.error ?? "Failed to start");
        setPhase("idle");
        return;
      }
      await poll(json.id as string);
    } catch (e) {
      stopTimer();
      setErr(e instanceof Error ? e.message : "Failed");
      setPhase("idle");
    }
  }

  return (
    <span className="inline-flex items-center gap-2">
      <button
        type="button"
        disabled={busy}
        onClick={go}
        className="font-mono text-[11px] border px-2 py-1 hover:bg-ink/5 disabled:opacity-50 whitespace-nowrap"
      >
        {busy ? "grading…" : "Re-grade"}
      </button>
      {busy && (
        <span
          className="font-mono text-[11px] text-ink/60 whitespace-nowrap"
          title="The grade runs on the hosted runner; this polls its status every 3s"
        >
          {phase} · {formatElapsed(elapsed)}
        </span>
      )}
      {phase === "done" && (
        <span className="font-mono text-[11px] text-ink/70 whitespace-nowrap">
          ✓ {grade ?? "done"} · {formatElapsed(elapsed)}
        </span>
      )}
      {err && <span className="text-oxblood text-[11px]">{err}</span>}
    </span>
  );
}
