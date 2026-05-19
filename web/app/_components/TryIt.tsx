"use client";

import { useMemo, useState } from "react";
import { SectionHeader } from "./SectionHeader";

// Live demo widget for /api/cli/check. Same call the CLI makes; sub-second.
// Beta — small surface intentionally: one input, one button, one result,
// copyable snippets. No autocomplete, no telemetry, no debounced auto-fire
// (button-only keeps the public endpoint quiet and the UX predictable).

const MAX_REF_LEN = 512; // matches the API's server_ref cap
const PLACEHOLDER = "npm/@modelcontextprotocol/server-filesystem";

type Status = "idle" | "checking" | "ok" | "error";

type CheckResult =
  | {
      status: "tracked";
      adoption_tier: "top10" | "top25" | "top50" | "top100" | null;
      polygraph: null;
      notify_url: string;
    }
  | {
      status: "not_available";
      notify_url: string;
    };

type Lang = "curl" | "fetch" | "python";

const LANG_TABS: Array<{ id: Lang; label: string }> = [
  { id: "curl", label: "curl" },
  { id: "fetch", label: "fetch" },
  { id: "python", label: "python" },
];

function jsonStringForBody(ref: string): string {
  // JSON.stringify with a single-key object produces correctly-escaped
  // output for inclusion inside the snippet bodies — no manual escaping.
  return JSON.stringify({ server_ref: ref });
}

function snippetFor(lang: Lang, ref: string): string {
  const safeRef = ref || PLACEHOLDER;
  const body = jsonStringForBody(safeRef);
  switch (lang) {
    case "curl":
      // -d takes the raw JSON; single-quote wrap keeps shell happy because
      // the JSON we produce only contains double quotes.
      return `curl -sS https://polygraph.so/api/cli/check \\\n  -H 'content-type: application/json' \\\n  -d '${body}'`;
    case "fetch":
      return `const res = await fetch("https://polygraph.so/api/cli/check", {\n  method: "POST",\n  headers: { "content-type": "application/json" },\n  body: JSON.stringify({ server_ref: ${JSON.stringify(safeRef)} }),\n});\nconst polygraph = await res.json();`;
    case "python":
      return `import httpx\n\nr = httpx.post(\n    "https://polygraph.so/api/cli/check",\n    json={"server_ref": ${JSON.stringify(safeRef)}},\n)\npolygraph = r.json()`;
  }
}

type AdoptionTier = "top10" | "top25" | "top50" | "top100";

function tierLabel(t: AdoptionTier | null): string {
  if (!t) return "unranked";
  return t.replace("top", "top-");
}

export function TryIt() {
  const [ref, setRef] = useState("");
  const [status, setStatus] = useState<Status>("idle");
  const [result, setResult] = useState<CheckResult | null>(null);
  const [errorMessage, setErrorMessage] = useState("");
  const [lang, setLang] = useState<Lang>("curl");
  const [snippetCopied, setSnippetCopied] = useState(false);

  const snippet = useMemo(() => snippetFor(lang, ref.trim()), [lang, ref]);

  async function handleCheck(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const trimmed = ref.trim();
    if (!trimmed) {
      setStatus("error");
      setResult(null);
      setErrorMessage("Enter a server ref (e.g. npm/@modelcontextprotocol/server-filesystem).");
      return;
    }
    if (trimmed.length > MAX_REF_LEN) {
      setStatus("error");
      setResult(null);
      setErrorMessage(`Too long (${MAX_REF_LEN}-char max).`);
      return;
    }

    setStatus("checking");
    setErrorMessage("");
    try {
      const res = await fetch("/api/cli/check", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ server_ref: trimmed }),
      });
      // Tolerate non-JSON bodies (e.g. an unhandled 500 from upstream)
      // rather than surfacing a raw JSON.parse error to the user.
      const rawText = await res.text();
      let body: Partial<CheckResult> & { error?: string } = {};
      try {
        body = rawText ? JSON.parse(rawText) : {};
      } catch {
        body = {};
      }
      if (!res.ok) {
        throw new Error(body.error ?? "Lookup failed. Try again.");
      }
      if (body.status !== "tracked" && body.status !== "not_available") {
        throw new Error("Unexpected response shape.");
      }
      setResult(body as CheckResult);
      setStatus("ok");
    } catch (err) {
      setStatus("error");
      setResult(null);
      setErrorMessage(
        err instanceof Error ? err.message : "Something went wrong. Try again.",
      );
    }
  }

  async function copySnippet() {
    try {
      await navigator.clipboard.writeText(snippet);
      setSnippetCopied(true);
      setTimeout(() => setSnippetCopied(false), 1600);
    } catch {
      // clipboard blocked — snippet is still visible for manual copy
    }
  }

  return (
    <section id="try" className="mx-auto max-w-6xl px-6 py-20 md:py-28">
      <SectionHeader
        number="§ 04"
        label="Try it"
        title="Check a server live."
      >
        Paste a registry-prefixed server ref. We hit the same endpoint the
        CLI hits &mdash; sub-second, anonymous, the polygraph is null until
        the litmus harness ships.
      </SectionHeader>

      <div className="border hairline bg-parchment-50">
        <div className="flex items-center justify-between px-4 py-2.5 border-b hairline font-mono text-[10.5px] uppercase tracking-[0.18em] text-ink-faint">
          <span>POST /api/cli/check</span>
          <span className="hidden sm:inline">beta · lookup only</span>
        </div>

        <div className="p-4 md:p-6">
          <form
            onSubmit={handleCheck}
            className="grid gap-3 sm:grid-cols-[1fr_auto]"
            aria-describedby="try-status"
            noValidate
          >
            <label className="block">
              <span className="sr-only">Server ref</span>
              <input
                type="text"
                inputMode="text"
                autoComplete="off"
                autoCorrect="off"
                autoCapitalize="off"
                spellCheck={false}
                maxLength={MAX_REF_LEN}
                placeholder={PLACEHOLDER}
                value={ref}
                onChange={(e) => setRef(e.target.value)}
                aria-label="Server ref"
                className="w-full bg-parchment border hairline px-3.5 py-2.5 font-mono text-sm text-ink placeholder:text-ink-faint focus:outline-none focus:border-ink transition-colors"
              />
            </label>
            <button
              type="submit"
              disabled={status === "checking"}
              className="inline-flex items-center justify-center gap-2 bg-ink text-parchment px-4 py-2.5 font-mono text-sm tracking-wide hover:bg-oxblood transition-colors disabled:opacity-60 disabled:cursor-not-allowed whitespace-nowrap"
            >
              {status === "checking" ? "Checking…" : "Check"}
            </button>
          </form>

          <div
            id="try-status"
            role="status"
            aria-live="polite"
            className="mt-4 min-h-[3rem]"
          >
            {status === "error" && (
              <p className="font-mono text-[12px] text-oxblood">
                {errorMessage}
              </p>
            )}

            {status === "ok" && result?.status === "tracked" && (
              <div className="border hairline bg-parchment">
                <div className="flex items-center justify-between px-3 py-1.5 border-b hairline font-mono text-[10px] uppercase tracking-[0.18em] text-ink-faint">
                  <span>status</span>
                  <span className="text-ink">tracked</span>
                </div>
                <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-1 px-3 py-3 font-mono text-[12px] text-ink-muted">
                  <dt className="text-ink-faint">adoption</dt>
                  <dd className="text-ink">{tierLabel(result.adoption_tier)}</dd>
                  <dt className="text-ink-faint">polygraph</dt>
                  <dd className="text-ink-muted">
                    null{" "}
                    <span className="text-ink-faint">
                      &mdash; pending litmus harness
                    </span>
                  </dd>
                  <dt className="text-ink-faint">notify</dt>
                  <dd className="text-ink break-all">
                    <a
                      href={result.notify_url}
                      className="border-b hairline border-dotted hover:text-oxblood transition-colors"
                    >
                      {result.notify_url}
                    </a>
                  </dd>
                </dl>
              </div>
            )}

            {status === "ok" && result?.status === "not_available" && (
              <div className="border hairline bg-parchment">
                <div className="flex items-center justify-between px-3 py-1.5 border-b hairline font-mono text-[10px] uppercase tracking-[0.18em] text-ink-faint">
                  <span>status</span>
                  <span className="text-ink">not_available</span>
                </div>
                <div className="px-3 py-3 font-mono text-[12px] text-ink-muted">
                  Not yet polygraphed. Your check bumped its place in our
                  next-round curation queue.{" "}
                  <a
                    href={result.notify_url}
                    className="text-ink border-b hairline border-dotted hover:text-oxblood transition-colors break-all"
                  >
                    {result.notify_url}
                  </a>
                </div>
              </div>
            )}
          </div>

          <div className="mt-6 pt-5 border-t hairline">
            <div className="flex items-center justify-between mb-2">
              <div className="flex gap-1" role="tablist" aria-label="Snippet language">
                {LANG_TABS.map((t) => (
                  <button
                    key={t.id}
                    type="button"
                    role="tab"
                    aria-selected={lang === t.id}
                    onClick={() => setLang(t.id)}
                    className={`font-mono text-[10.5px] uppercase tracking-[0.18em] px-2.5 py-1 border hairline transition-colors ${
                      lang === t.id
                        ? "bg-ink text-parchment border-ink"
                        : "bg-parchment-50 text-ink-muted hover:text-ink"
                    }`}
                  >
                    {t.label}
                  </button>
                ))}
              </div>
              <button
                type="button"
                onClick={copySnippet}
                aria-label="Copy snippet"
                className="inline-flex items-center justify-center px-2.5 py-1 font-mono text-[10.5px] uppercase tracking-[0.16em] text-ink-muted hover:text-ink border hairline bg-parchment-50 transition-colors"
              >
                {snippetCopied ? "copied" : "copy"}
              </button>
            </div>
            <pre
              className="font-mono text-[12.5px] leading-6 text-ink bg-parchment border hairline px-4 py-3 whitespace-pre-wrap break-all"
              aria-label={`${lang} snippet`}
            >
              {snippet}
            </pre>
            <p className="mt-3 font-mono text-[11px] text-ink-faint leading-relaxed">
              Drop this into a pre-commit hook, an MCP gateway, or a CI step.
              Tier-gate by adoption while polygraphs ship; switch to the
              behavioural grade when it lands.
            </p>
          </div>
        </div>
      </div>
    </section>
  );
}
