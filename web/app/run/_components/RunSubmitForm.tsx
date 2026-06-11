"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

// Submit step of the hosted-run flow: target + email → POST /api/runs →
// redirect to /run/[id], which carries payment + status + report.

export function RunSubmitForm() {
  const router = useRouter();
  const [target, setTarget] = useState("");
  const [email, setEmail] = useState("");
  const [state, setState] = useState<"idle" | "submitting" | "error">("idle");
  const [message, setMessage] = useState("");

  async function submit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setState("submitting");
    setMessage("");
    try {
      const res = await fetch("/api/runs", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ target: target.trim(), email: email.trim() }),
      });
      const body = (await res.json()) as {
        ok: boolean;
        message?: string;
        run?: { id: string };
      };
      if (!res.ok || !body.ok || !body.run) {
        throw new Error(body.message ?? "Couldn't create the run.");
      }
      router.push(`/run/${body.run.id}`);
    } catch (err) {
      setState("error");
      setMessage(
        err instanceof Error ? err.message : "Something went wrong. Try again.",
      );
    }
  }

  return (
    <form onSubmit={submit} className="border hairline bg-parchment-50" noValidate>
      <div className="flex items-center justify-between px-4 py-2.5 border-b hairline font-mono text-[10.5px] uppercase tracking-[0.18em] text-ink-faint">
        <span>Request a run</span>
        <span className="hidden sm:inline">USDC on Base</span>
      </div>
      <div className="p-4 md:p-6 space-y-4">
        <label className="block">
          <span className="font-mono text-[11px] uppercase tracking-[0.16em] text-ink-faint block mb-2">
            MCP server — registry ref or https:// URL
          </span>
          <input
            type="text"
            inputMode="text"
            autoComplete="off"
            autoCorrect="off"
            autoCapitalize="off"
            spellCheck={false}
            maxLength={512}
            placeholder="npm/@modelcontextprotocol/server-filesystem · or · https://mcp.example.com"
            value={target}
            onChange={(e) => setTarget(e.target.value)}
            className="w-full bg-parchment border hairline px-3.5 py-2.5 font-mono text-sm text-ink placeholder:text-ink-faint focus:outline-none focus:border-ink transition-colors"
          />
        </label>

        <label className="block">
          <span className="font-mono text-[11px] uppercase tracking-[0.16em] text-ink-faint block mb-2">
            Email — for the report link
          </span>
          <input
            type="email"
            required
            inputMode="email"
            autoComplete="email"
            placeholder="you@company.com"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="w-full bg-parchment border hairline px-3.5 py-2.5 font-mono text-sm text-ink placeholder:text-ink-faint focus:outline-none focus:border-ink transition-colors"
          />
        </label>

        <div className="flex items-center justify-between gap-4 pt-2">
          <button
            type="submit"
            disabled={state === "submitting"}
            className="inline-flex items-center justify-center gap-2 bg-ink text-parchment px-5 py-3 font-mono text-sm tracking-wide hover:bg-oxblood transition-colors disabled:opacity-60 disabled:cursor-not-allowed"
          >
            {state === "submitting" ? "Creating…" : "Continue to payment"}
          </button>
          <p className="font-mono text-[10.5px] text-ink-faint">
            Next step shows the price + payment.
          </p>
        </div>

        {state === "error" && (
          <p role="status" className="font-mono text-[12px] text-oxblood">
            {message}
          </p>
        )}
      </div>
    </form>
  );
}
