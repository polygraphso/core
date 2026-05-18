"use client";

import { useState } from "react";

type Status = "idle" | "submitting" | "ok" | "error";

type Props = {
  source?: string;
  cta?: string;
};

export function MinimalSignup({
  source = "grades-updates",
  cta = "Notify me",
}: Props) {
  const [email, setEmail] = useState("");
  const [status, setStatus] = useState<Status>("idle");
  const [message, setMessage] = useState<string>("");

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setStatus("submitting");
    setMessage("");
    try {
      const res = await fetch("/api/waitlist", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, source }),
      });
      const body = (await res.json()) as { ok: boolean; message?: string };
      if (!res.ok || !body.ok) {
        throw new Error(body.message ?? "Could not subscribe.");
      }
      setStatus("ok");
      setMessage("You're on the list.");
      setEmail("");
    } catch (err) {
      setStatus("error");
      setMessage(
        err instanceof Error ? err.message : "Something went wrong. Try again.",
      );
    }
  }

  return (
    <form
      onSubmit={handleSubmit}
      className="grid gap-2 sm:grid-cols-[1fr_auto]"
      aria-describedby="minimal-signup-status"
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
          className="w-full bg-parchment-50 border hairline px-3.5 py-2.5 font-mono text-sm text-ink placeholder:text-ink-faint focus:outline-none focus:border-ink transition-colors"
        />
      </label>
      <button
        type="submit"
        disabled={status === "submitting"}
        className="inline-flex items-center justify-center gap-2 bg-ink text-parchment px-4 py-2.5 font-mono text-sm tracking-wide hover:bg-oxblood transition-colors disabled:opacity-60 disabled:cursor-not-allowed whitespace-nowrap"
      >
        {status === "submitting"
          ? "…"
          : status === "ok"
            ? "On the list ✓"
            : cta}
      </button>
      <p
        id="minimal-signup-status"
        role="status"
        aria-live="polite"
        className={`sm:col-span-2 font-mono text-[11px] ${
          status === "error" ? "text-oxblood" : "text-ink-faint"
        } ${message ? "opacity-100" : "opacity-0"} transition-opacity min-h-4`}
      >
        {message || "—"}
      </p>
    </form>
  );
}
