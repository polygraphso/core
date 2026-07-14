"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { HoneypotField } from "@/app/_components/HoneypotField";
import { ServerCombobox, type ComboboxResult } from "@/app/_components/ServerCombobox";
import { refToPath } from "@/lib/serverRef";

function targetHint(raw: string): { text: string; warn: boolean } | null {
  const t = raw.trim();
  if (!t) return null;
  if (t.startsWith("https://")) {
    return { text: "remote server — its grade will cap at B (egress can't be verified)", warn: true };
  }
  if (t.startsWith("http://")) {
    return { text: "https:// only — plain http isn't accepted", warn: true };
  }
  if (/^(npm|pypi|github)\//.test(t)) {
    return { text: "registry package — runs in the full sandbox", warn: false };
  }
  return null;
}

// sessionEmail is null for anonymous visitors — the form then collects the
// email itself (the queue is email-gated, not account-gated).
export function RequestForm({ sessionEmail }: { sessionEmail: string | null }) {
  const [target, setTarget] = useState("");
  const [email, setEmail] = useState("");
  const [note, setNote] = useState("");
  const [company, setCompany] = useState(""); // honeypot
  const [state, setState] = useState<"idle" | "submitting" | "ok" | "error" | "redirecting">("idle");
  const [message, setMessage] = useState("");
  const [result, setResult] = useState<{ created: boolean; demand: number } | null>(null);
  const router = useRouter();

  // A catalog pick that we've already graded needs no request — send the user
  // straight to its report. Anything else just prefills the field to submit.
  function onSelectResult(r: ComboboxResult) {
    setState("idle");
    setMessage("");
    if (r.graded) {
      setTarget(r.target);
      setState("redirecting");
      router.push(`/mcp/${refToPath(r.target)}`);
      return;
    }
    setTarget(r.target);
  }

  async function submit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!target.trim()) {
      setState("error");
      setMessage("Enter a server — a registry ref or an https:// MCP URL.");
      return;
    }
    if (!sessionEmail && !email.trim()) {
      setState("error");
      setMessage("Enter an email so we can tell you when the grade publishes.");
      return;
    }
    setState("submitting");
    setMessage("");
    try {
      const res = await fetch("/api/grade-requests", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          target: target.trim(),
          // Ignored server-side when a session exists (session email wins).
          email: sessionEmail ?? email.trim(),
          note: note.trim() || undefined,
          company,
        }),
      });
      const body = (await res.json()) as {
        ok: boolean;
        message?: string;
        created?: boolean;
        demand?: number;
      };
      if (!res.ok || !body.ok) {
        throw new Error(body.message ?? "Couldn't save your request.");
      }
      setResult({ created: body.created ?? true, demand: body.demand ?? 1 });
      setState("ok");
    } catch (err) {
      setState("error");
      setMessage(
        err instanceof Error ? err.message : "Something went wrong. Try again.",
      );
    }
  }

  if (state === "ok" && result) {
    return (
      <div className="border hairline bg-parchment-50">
        <div className="flex items-center justify-between px-4 py-2.5 border-b hairline font-mono text-[10.5px] uppercase tracking-[0.18em] text-ink-faint">
          <span>on the bench</span>
          <span className="text-ink">{target.trim()}</span>
        </div>
        <div className="p-5 md:p-7">
          <p className="font-serif text-xl md:text-2xl text-ink leading-snug">
            {result.created
              ? "Added to the queue."
              : "Already on the queue — your request is counted."}
          </p>
          <p className="mt-3 text-ink-muted leading-relaxed">
            {result.demand > 1 ? (
              <>
                <span className="font-mono text-ink">{result.demand}</span>{" "}
                people have asked for this server — demand moves it up the bench.
              </>
            ) : (
              <>You&rsquo;re the first to ask for this one.</>
            )}{" "}
            We&rsquo;ll email you at{" "}
            <span className="font-mono text-ink">{sessionEmail ?? email.trim()}</span> when its
            grade publishes.
          </p>
          <button
            type="button"
            onClick={() => {
              setTarget("");
              setNote("");
              setResult(null);
              setState("idle");
            }}
            className="mt-6 font-mono text-xs text-ink-faint border-b hairline border-dotted hover:text-ink transition-colors"
          >
            Request another →
          </button>
        </div>
      </div>
    );
  }

  const hint = targetHint(target);

  return (
    <form onSubmit={submit} className="border hairline bg-parchment-50" noValidate>
      <HoneypotField value={company} onChange={setCompany} />
      <div className="flex items-center justify-between px-4 py-2.5 border-b hairline font-mono text-[10.5px] uppercase tracking-[0.18em] text-ink-faint">
        <span>request a grade</span>
        <span className="hidden sm:inline">free</span>
      </div>
      <div className="p-4 md:p-6 space-y-4">
        <div className="block">
          <label
            htmlFor="request-target"
            className="font-mono text-[11px] uppercase tracking-[0.16em] text-ink-faint block mb-2"
          >
            MCP server — search our catalog, or paste a ref / https:// URL
          </label>
          <ServerCombobox
            inputId="request-target"
            value={target}
            onValueChange={(v) => { setTarget(v); if (state !== "submitting") setState("idle"); }}
            onSelectResult={onSelectResult}
            onSubmitFreeform={(normalized) => setTarget(normalized)}
            placeholder="context7 · npm/@scope/server · https://mcp.example.com"
            freeformVerb="Request"
            aria-describedby="request-target-hint"
          />
          <span
            id="request-target-hint"
            aria-live="polite"
            className={`block mt-1.5 font-mono text-[10.5px] min-h-4 transition-opacity ${
              hint ? "opacity-100" : "opacity-0"
            } ${hint?.warn ? "text-terracotta" : "text-grade-a"}`}
          >
            {hint ? `→ ${hint.text}` : "—"}
          </span>
        </div>

        {!sessionEmail && (
          <label className="block">
            <span className="font-mono text-[11px] uppercase tracking-[0.16em] text-ink-faint block mb-2">
              Email — we&rsquo;ll tell you when the grade publishes
            </span>
            <input
              type="email"
              autoComplete="email"
              maxLength={254}
              placeholder="you@example.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full bg-parchment border hairline px-3.5 py-2.5 font-sans text-sm text-ink placeholder:text-ink-faint focus:outline-none focus:border-ink transition-colors"
            />
          </label>
        )}

        <label className="block">
          <span className="font-mono text-[11px] uppercase tracking-[0.16em] text-ink-faint block mb-2">
            Why you want it — optional
          </span>
          <textarea
            rows={2}
            maxLength={2000}
            placeholder="My agent depends on this and I want to know it's safe."
            value={note}
            onChange={(e) => setNote(e.target.value)}
            className="w-full bg-parchment border hairline px-3.5 py-2.5 font-sans text-sm text-ink placeholder:text-ink-faint focus:outline-none focus:border-ink transition-colors resize-none"
          />
        </label>

        <div className="flex flex-col gap-3 pt-1">
          <div className="flex items-center justify-between gap-4">
            <button
              type="submit"
              disabled={state === "submitting" || state === "redirecting"}
              className="inline-flex items-center justify-center gap-2 bg-ink text-parchment px-5 py-3 font-mono text-sm tracking-wide hover:bg-oxblood transition-colors disabled:opacity-60 disabled:cursor-not-allowed"
            >
              {state === "submitting"
                ? "Adding…"
                : state === "redirecting"
                  ? "Opening report…"
                  : "Add to the queue"}
            </button>
            <p className="font-mono text-[10.5px] text-ink-faint">
              Free. We grade it on our own timeline.
            </p>
          </div>
          {sessionEmail && (
            <p className="font-mono text-[11px] text-ink-faint">
              Requesting as{" "}
              <span className="text-ink">{sessionEmail}</span>.
            </p>
          )}
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
