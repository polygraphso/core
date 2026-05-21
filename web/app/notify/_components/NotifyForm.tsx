"use client";

import { useState } from "react";

type Status = "idle" | "submitting" | "ok" | "error";

type Props =
  | {
      mode: "anonymous";
      serverRef: string;
      sessionEmail?: never;
    }
  | {
      mode: "signed-in";
      serverRef: string;
      sessionEmail: string;
    };

export function NotifyForm(props: Props) {
  const { mode, serverRef } = props;
  const [email, setEmail] = useState("");
  const [status, setStatus] = useState<Status>("idle");
  const [message, setMessage] = useState("");

  async function submit(payload: { server_ref: string; email?: string }) {
    setStatus("submitting");
    setMessage("");
    try {
      const res = await fetch("/api/notify", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const body = (await res.json()) as { ok: boolean; message?: string };
      if (!res.ok || !body.ok) {
        throw new Error(body.message ?? "Couldn't save your request.");
      }
      setStatus("ok");
      setMessage(`We'll email you when ${serverRef} gets its first polygraph.`);
    } catch (err) {
      setStatus("error");
      setMessage(
        err instanceof Error
          ? err.message
          : "Couldn't save your request. Try again or email hello@polygraph.so.",
      );
    }
  }

  if (status === "ok") {
    return (
      <p
        role="status"
        aria-live="polite"
        className="border hairline bg-parchment-50 px-4 py-4 font-mono text-sm text-ink leading-relaxed"
      >
        {message}
      </p>
    );
  }

  if (mode === "signed-in") {
    return (
      <div className="grid gap-3">
        <button
          type="button"
          onClick={() => submit({ server_ref: serverRef })}
          disabled={status === "submitting"}
          className="inline-flex items-center justify-center gap-2 bg-ink text-parchment px-5 py-3 font-mono text-sm tracking-wide hover:bg-oxblood transition-colors disabled:opacity-60 disabled:cursor-not-allowed self-start"
        >
          <span>
            {status === "submitting" ? "Saving…" : "Watch this server"}
          </span>
          <span aria-hidden className="text-base leading-none">→</span>
        </button>
        <p className="font-mono text-[11.5px] text-ink-faint">
          Signed in as <span className="text-ink">{props.sessionEmail}</span>.
        </p>
        {status === "error" && (
          <p
            role="alert"
            aria-live="polite"
            className="font-mono text-xs text-oxblood"
          >
            {message}
          </p>
        )}
      </div>
    );
  }

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        submit({ server_ref: serverRef, email });
      }}
      className="grid gap-3 sm:grid-cols-[1fr_auto]"
      aria-describedby="notify-status"
      noValidate
    >
      <label className="block">
        <span className="sr-only">Email</span>
        <input
          type="email"
          required
          inputMode="email"
          autoComplete="email"
          placeholder="you@company.com"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          className="w-full bg-parchment-50 border hairline px-3.5 py-3 font-mono text-sm text-ink placeholder:text-ink-faint focus:outline-none focus:border-ink transition-colors"
        />
      </label>
      <button
        type="submit"
        disabled={status === "submitting"}
        className="inline-flex items-center justify-center gap-2 bg-ink text-parchment px-5 py-3 font-mono text-sm tracking-wide hover:bg-oxblood transition-colors disabled:opacity-60 disabled:cursor-not-allowed"
      >
        <span>{status === "submitting" ? "Saving…" : "Notify me"}</span>
        <span aria-hidden className="text-base leading-none">→</span>
      </button>
      <p
        id="notify-status"
        role="status"
        aria-live="polite"
        className={`sm:col-span-2 font-mono text-xs ${
          status === "error" ? "text-oxblood" : "text-ink-muted"
        } ${message ? "opacity-100" : "opacity-0"} transition-opacity min-h-4`}
      >
        {message || "—"}
      </p>
    </form>
  );
}
