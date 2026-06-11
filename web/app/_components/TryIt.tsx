"use client";

import { useMemo, useRef, useState } from "react";
import { SectionHeader } from "./SectionHeader";

// Live demo widget for /api/cli/check. Same call the CLI makes; sub-second.
// Small surface intentionally: one input, one button, one result, copyable
// snippets. Button-only keeps the public endpoint quiet and the UX predictable.
// Result cards capture email inline via /api/notify (per-server demand signal).
// The bench below is our curated grading queue — clicking a row runs a real
// check on it, so the demo path is: click → live result → leave an email.

const MAX_REF_LEN = 512; // matches the API's server_ref cap
const PLACEHOLDER = "npm/@modelcontextprotocol/server-filesystem";

// Curated queue for the first public polygraphs. Editorial, honest — it's
// literally our bench. Keep refs inside the tracked set where possible.
const BENCH: Array<{ ref: string; note: string }> = [
  { ref: "npm/@modelcontextprotocol/server-filesystem", note: "local file access" },
  { ref: "npm/@modelcontextprotocol/server-github", note: "repos, issues, PRs" },
  { ref: "npm/@modelcontextprotocol/server-slack", note: "workspace messages" },
  { ref: "npm/@modelcontextprotocol/server-puppeteer", note: "headless browser" },
  { ref: "pypi/mcp-server-git", note: "git operations" },
];

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

// Inline per-server email capture — posts to the existing /api/notify.
// One field, no link-out: the result card closes its own loop.
function NotifyInline({ serverRef }: { serverRef: string }) {
  const [email, setEmail] = useState("");
  const [state, setState] = useState<"idle" | "submitting" | "ok" | "error">(
    "idle",
  );
  const [message, setMessage] = useState("");

  async function submit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setState("submitting");
    setMessage("");
    try {
      const res = await fetch("/api/notify", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ server_ref: serverRef, email }),
      });
      const body = (await res.json()) as { ok: boolean; message?: string };
      if (!res.ok || !body.ok) {
        throw new Error(body.message ?? "Couldn't save your request.");
      }
      setState("ok");
    } catch (err) {
      setState("error");
      setMessage(
        err instanceof Error ? err.message : "Something went wrong. Try again.",
      );
    }
  }

  if (state === "ok") {
    return (
      <p className="mt-3 pt-3 border-t hairline font-mono text-[11.5px] text-ink">
        ✓ One email when this server gets its polygraph. No drip, no
        newsletter.
      </p>
    );
  }

  return (
    <form
      onSubmit={submit}
      className="mt-3 pt-3 border-t hairline"
      noValidate
    >
      <p className="font-mono text-[11px] text-ink-faint mb-2">
        Get its polygraph when it lands — one email, nothing else:
      </p>
      <div className="grid gap-2 sm:grid-cols-[1fr_auto]">
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
            className="w-full bg-parchment-50 border hairline px-3 py-2 font-mono text-[12.5px] text-ink placeholder:text-ink-faint focus:outline-none focus:border-ink transition-colors"
          />
        </label>
        <button
          type="submit"
          disabled={state === "submitting"}
          className="inline-flex items-center justify-center bg-ink text-parchment px-3.5 py-2 font-mono text-[12.5px] tracking-wide hover:bg-oxblood transition-colors disabled:opacity-60 disabled:cursor-not-allowed whitespace-nowrap"
        >
          {state === "submitting" ? "…" : "Notify me"}
        </button>
      </div>
      {state === "error" && (
        <p role="status" className="mt-1.5 font-mono text-[11px] text-oxblood">
          {message}
        </p>
      )}
    </form>
  );
}

export function TryIt() {
  const [ref, setRef] = useState("");
  const [checkedRef, setCheckedRef] = useState("");
  const [status, setStatus] = useState<Status>("idle");
  const [result, setResult] = useState<CheckResult | null>(null);
  const [errorMessage, setErrorMessage] = useState("");
  const [lang, setLang] = useState<Lang>("curl");
  const [snippetCopied, setSnippetCopied] = useState(false);
  const formRef = useRef<HTMLFormElement>(null);

  const snippet = useMemo(() => snippetFor(lang, ref.trim()), [lang, ref]);

  async function runCheck(trimmed: string) {
    if (!trimmed) {
      setStatus("error");
      setResult(null);
      setErrorMessage(
        "Enter a server ref (e.g. npm/@modelcontextprotocol/server-filesystem).",
      );
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
      setCheckedRef(trimmed);
      setStatus("ok");
    } catch (err) {
      setStatus("error");
      setResult(null);
      setErrorMessage(
        err instanceof Error ? err.message : "Something went wrong. Try again.",
      );
    }
  }

  async function handleCheck(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    await runCheck(ref.trim());
  }

  function checkFromBench(benchRef: string) {
    setRef(benchRef);
    formRef.current?.scrollIntoView({ behavior: "smooth", block: "center" });
    void runCheck(benchRef);
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
    <section id="try" className="mx-auto max-w-6xl px-6 py-20 md:py-28 scroll-mt-12">
      <SectionHeader
        number="§ 02"
        label="Try it"
        title="Check a server live."
      >
        Paste a registry-prefixed server ref &mdash; or pick one from the
        bench below. Same endpoint the CLI hits, sub-second, anonymous.
        Published grades are rolling out; a server without one returns{" "}
        <span className="font-mono text-[0.92em] text-ink">
          polygraph: null
        </span>{" "}
        and you can ask to hear when it lands.
      </SectionHeader>

      <div className="border hairline bg-parchment-50">
        <div className="flex items-center justify-between px-4 py-2.5 border-b hairline font-mono text-[10.5px] uppercase tracking-[0.18em] text-ink-faint">
          <span>POST /api/cli/check</span>
          <span className="hidden sm:inline">beta · lookup</span>
        </div>

        <div className="p-4 md:p-6">
          <form
            ref={formRef}
            onSubmit={handleCheck}
            className="grid gap-3 sm:grid-cols-[1fr_auto] scroll-mt-24"
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
                <div className="px-3 py-3">
                  <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-1 font-mono text-[12px] text-ink-muted">
                    <dt className="text-ink-faint">adoption</dt>
                    <dd className="text-ink">
                      {tierLabel(result.adoption_tier)}
                    </dd>
                    <dt className="text-ink-faint">polygraph</dt>
                    <dd className="text-ink-muted">
                      null{" "}
                      <span className="text-ink-faint">
                        &mdash; no published grade yet
                      </span>
                    </dd>
                  </dl>
                  <NotifyInline key={checkedRef} serverRef={checkedRef} />
                </div>
              </div>
            )}

            {status === "ok" && result?.status === "not_available" && (
              <div className="border hairline bg-parchment">
                <div className="flex items-center justify-between px-3 py-1.5 border-b hairline font-mono text-[10px] uppercase tracking-[0.18em] text-ink-faint">
                  <span>status</span>
                  <span className="text-ink">not_available</span>
                </div>
                <div className="px-3 py-3">
                  <p className="font-mono text-[12px] text-ink-muted">
                    Not yet polygraphed. Your check bumped its place in our
                    next-round curation queue.
                  </p>
                  <NotifyInline key={checkedRef} serverRef={checkedRef} />
                </div>
              </div>
            )}
          </div>

          {/* The bench — curated queue for the first public polygraphs */}
          <figure className="mt-6 border hairline bg-parchment">
            <figcaption className="flex items-center justify-between px-3 py-2 border-b hairline font-mono text-[10px] uppercase tracking-[0.18em] text-ink-faint">
              <span>Next on the bench — first public polygraphs</span>
              <span className="hidden sm:inline">queued · litmus-v1</span>
            </figcaption>
            <ul>
              {BENCH.map((b, i) => (
                <li
                  key={b.ref}
                  className={i < BENCH.length - 1 ? "border-b hairline" : ""}
                >
                  <button
                    type="button"
                    onClick={() => checkFromBench(b.ref)}
                    className="w-full flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1 px-3 py-2.5 text-left hover:bg-parchment-50 transition-colors group"
                  >
                    <span className="font-mono text-[12px] text-ink break-all">
                      {b.ref}
                    </span>
                    <span className="flex items-baseline gap-3">
                      <span className="font-sans text-[11.5px] text-ink-faint">
                        {b.note}
                      </span>
                      <span className="font-mono text-[10.5px] uppercase tracking-[0.14em] text-ink-faint group-hover:text-oxblood transition-colors">
                        check →
                      </span>
                    </span>
                  </button>
                </li>
              ))}
            </ul>
            <p className="px-3 py-2.5 border-t hairline font-mono text-[10.5px] text-ink-faint">
              Want a different server first? Check it above and leave an email
              &mdash; requests steer the queue.
            </p>
          </figure>

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
