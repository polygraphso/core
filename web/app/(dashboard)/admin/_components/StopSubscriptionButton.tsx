"use client";

/**
 * Two-step admin stop for a stream subscription (plan or ecosystem). POSTs the
 * given stop route; on success shows whether the payer was notified — the
 * stream itself keeps running until the payer cancels (Sablier's cancel is
 * sender-only), which is why the copy leads with that.
 */

import { useState } from "react";
import { useRouter } from "next/navigation";

type State =
  | { id: "idle" }
  | { id: "confirm" }
  | { id: "stopping" }
  | { id: "done"; notified: number | boolean }
  | { id: "error"; message: string };

export function StopSubscriptionButton({ url }: { url: string }) {
  const [state, setState] = useState<State>({ id: "idle" });
  const router = useRouter();

  async function stop() {
    setState({ id: "stopping" });
    try {
      const res = await fetch(url, { method: "POST" });
      const body = (await res.json()) as { notified?: number | boolean; error?: string };
      if (!res.ok) {
        setState({ id: "error", message: body.error ?? "Couldn't stop the subscription." });
        return;
      }
      setState({ id: "done", notified: body.notified ?? false });
      router.refresh();
    } catch {
      setState({ id: "error", message: "Couldn't stop the subscription." });
    }
  }

  if (state.id === "done") {
    const notified =
      typeof state.notified === "number" ? state.notified > 0 : state.notified;
    return (
      <span className="text-ink-faint">
        stopped · {notified ? "payer notified" : "could not notify — follow up via hello@"}
      </span>
    );
  }

  if (state.id === "confirm" || state.id === "stopping") {
    return (
      <span className="inline-flex items-center gap-2">
        <span className="text-ink-muted normal-case tracking-normal">
          Stop this subscription? The console locks now; the payer is told to cancel their stream
          to reclaim the remainder.
        </span>
        <button
          type="button"
          disabled={state.id === "stopping"}
          onClick={() => void stop()}
          className="text-oxblood border border-oxblood/40 rounded-full px-2.5 py-1 hover:bg-oxblood/5 transition-colors disabled:opacity-50"
        >
          {state.id === "stopping" ? "stopping…" : "confirm stop"}
        </button>
        <button
          type="button"
          disabled={state.id === "stopping"}
          onClick={() => setState({ id: "idle" })}
          className="text-ink-faint hover:text-ink transition-colors"
        >
          keep
        </button>
      </span>
    );
  }

  return (
    <span className="inline-flex items-center gap-2">
      {state.id === "error" ? <span className="text-oxblood normal-case">{state.message}</span> : null}
      <button
        type="button"
        onClick={() => setState({ id: "confirm" })}
        className="text-ink-faint border border-rule rounded-full px-2.5 py-1 hover:text-oxblood hover:border-oxblood/40 transition-colors"
      >
        stop
      </button>
    </span>
  );
}
