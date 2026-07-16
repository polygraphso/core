"use client";

import { useEffect, useState } from "react";

type Progress =
  | { state: "grading"; target?: string }
  | { state: "graded"; target?: string; grade: string; reportUrl: string }
  | { state: "failed"; target?: string; reason: string };

const GRADE_COLOR: Record<string, string> = {
  A: "#2f5132", B: "#4f6b36", C: "#a86b19", D: "#b85024", F: "#7a1f2b",
};
// Stop polling after this and fall back to the email promise, so a slow or
// box-restarted run never spins the tab forever.
const POLL_GIVEUP_MS = 6 * 60 * 1000;
const POLL_EVERY_MS = 4000;

/**
 * Payment verified → the grade is running on polygraph's box now. Poll the
 * status endpoint until it publishes (or fails), showing live progress instead
 * of a static "we'll email you" note. Also the already-paid view: revisiting a
 * paid request shows its live state (grading / graded + report / failed).
 */
export function GradingProgress({ requestId }: { requestId: string }) {
  const [progress, setProgress] = useState<Progress>({ state: "grading" });
  const [gaveUp, setGaveUp] = useState(false);

  useEffect(() => {
    let alive = true;
    const startedAt = Date.now();
    let timer: ReturnType<typeof setTimeout>;

    const tick = async () => {
      try {
        const res = await fetch(`/api/grade-requests/${requestId}/status`, { cache: "no-store" });
        const body = (await res.json()) as Progress & { state: string };
        if (!alive) return;
        if (body.state === "graded" || body.state === "failed") {
          setProgress(body as Progress);
          return; // terminal — stop polling
        }
        setProgress({ state: "grading", target: (body as { target?: string }).target });
      } catch {
        // transient — keep polling
      }
      if (!alive) return;
      if (Date.now() - startedAt > POLL_GIVEUP_MS) {
        setGaveUp(true);
        return;
      }
      timer = setTimeout(() => void tick(), POLL_EVERY_MS);
    };
    void tick();
    return () => {
      alive = false;
      clearTimeout(timer);
    };
  }, [requestId]);

  if (progress.state === "graded") {
    return (
      <div className="border-l-2 pl-4" style={{ borderColor: GRADE_COLOR[progress.grade] ?? "var(--color-oxblood)" }}>
        <p className="text-[15px] leading-relaxed text-ink">
          Graded{" "}
          {progress.grade ? (
            <span
              className="font-mono text-[13px] font-semibold px-1.5 py-0.5 text-parchment"
              style={{ backgroundColor: GRADE_COLOR[progress.grade] ?? "#23201a" }}
            >
              {progress.grade}
            </span>
          ) : null}
          {progress.target ? <> · {progress.target}</> : null}.
        </p>
        <a
          href={progress.reportUrl}
          className="mt-3 inline-flex items-center gap-2 bg-ink text-parchment px-5 py-3 font-mono text-sm tracking-wide hover:bg-oxblood transition-colors"
        >
          View the report &amp; evidence →
        </a>
      </div>
    );
  }

  if (progress.state === "failed") {
    return (
      <div className="border-l-2 pl-4" style={{ borderColor: "var(--color-oxblood)" }}>
        <p className="text-[15px] leading-relaxed text-ink">
          We couldn&rsquo;t grade this one: {progress.reason}.
        </p>
        <p className="mt-2 text-[14px] leading-relaxed text-ink-muted">
          If that looks wrong, email{" "}
          <a href="mailto:hello@polygraph.so" className="underline decoration-dotted hover:text-oxblood">
            hello@polygraph.so
          </a>{" "}
          and we&rsquo;ll take a look.
        </p>
      </div>
    );
  }

  // Still grading (or we stopped polling after the give-up window).
  return (
    <div className="border-l-2 pl-4" style={{ borderColor: "var(--color-oxblood)" }}>
      <p className="text-[15px] leading-relaxed text-ink">
        <span className="inline-block animate-pulse">●</span> Grading
        {progress.target ? <> {progress.target}</> : null} now — running the full behavioral battery
        against the live server. This usually takes a minute or two.
      </p>
      {gaveUp ? (
        <p className="mt-2 text-[14px] leading-relaxed text-ink-muted">
          It&rsquo;s taking longer than usual (larger servers, or a queue ahead of it). You can
          close this — we&rsquo;ll email you the moment the grade publishes.
        </p>
      ) : (
        <p className="mt-2 font-mono text-[12px] text-ink-faint">
          Payment verified. Keep this open to watch it land, or close it — we&rsquo;ll email you
          either way.
        </p>
      )}
    </div>
  );
}
