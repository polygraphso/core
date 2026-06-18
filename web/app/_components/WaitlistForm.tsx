"use client";

import { useState } from "react";
import { HoneypotField } from "./HoneypotField";

type Status = "idle" | "submitting" | "ok" | "error";

type Props = {
  variant?: "hero" | "inline";
  source?: string; // tracking which form on the page
};

export function WaitlistForm({ variant = "hero", source = "hero" }: Props) {
  const [email, setEmail] = useState("");
  const [role, setRole] = useState("");
  const [company, setCompany] = useState(""); // honeypot
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
        body: JSON.stringify({ email, role, source, company }),
      });
      const body = (await res.json()) as { ok: boolean; message?: string };
      if (!res.ok || !body.ok) {
        throw new Error(body.message ?? "Could not join the waitlist.");
      }
      setStatus("ok");
      setMessage("You're on the list. We'll be in touch when v1 is ready.");
      setEmail("");
      setRole("");
    } catch (err) {
      setStatus("error");
      setMessage(
        err instanceof Error ? err.message : "Something went wrong. Try again.",
      );
    }
  }

  const compact = variant === "inline";

  return (
    <form
      onSubmit={handleSubmit}
      className={
        compact
          ? "mt-2 grid gap-3 sm:grid-cols-[1fr_auto]"
          : "mt-6 grid gap-3 sm:grid-cols-[1fr_auto]"
      }
      aria-describedby="waitlist-status"
      noValidate
    >
      <HoneypotField value={company} onChange={setCompany} />
      <div className="grid gap-3 sm:grid-cols-[1.4fr_1fr] sm:col-span-1">
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
        <label className="block">
          <span className="sr-only">Role</span>
          <select
            value={role}
            onChange={(e) => setRole(e.target.value)}
            className="w-full bg-parchment-50 border hairline px-3.5 py-3 font-mono text-sm text-ink focus:outline-none focus:border-ink transition-colors appearance-none"
            aria-label="Role"
          >
            <option value="">Role…</option>
            <option value="developer">Developer</option>
            <option value="security">Security / risk</option>
            <option value="founder">Founder / exec</option>
            <option value="researcher">Researcher</option>
            <option value="other">Other</option>
          </select>
        </label>
      </div>
      <button
        type="submit"
        disabled={status === "submitting"}
        className="group relative inline-flex items-center justify-center gap-2 bg-ink text-parchment px-5 py-3 font-mono text-sm tracking-wide hover:bg-oxblood transition-colors disabled:opacity-60 disabled:cursor-not-allowed"
      >
        <span>
          {status === "submitting"
            ? "Joining…"
            : status === "ok"
              ? "Joined ✓"
              : "Join the waitlist"}
        </span>
        <span aria-hidden className="text-base leading-none">
          {status === "ok" ? "" : "→"}
        </span>
      </button>
      <p
        id="waitlist-status"
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
