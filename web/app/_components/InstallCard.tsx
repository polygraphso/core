"use client";

import { useState } from "react";

const COMMAND = "npx polygraphso check <mcp-server>";

// `check` is the lookup path — sub-second over published polygraphs.
// The litmus harness that *produces* grades runs separately; a `litmus`
// subcommand (run the probes yourself) ships once the harness is published.
const STEPS: Array<{ id: string; label: string }> = [
  { id: "01", label: "fetches the polygraph from polygraph.so" },
  { id: "02", label: "returns grade (A/B/D/F) + tool-surface fingerprint" },
  { id: "03", label: "links to the full evidence bundle" },
];

export function InstallCard() {
  const [copied, setCopied] = useState(false);

  async function copy() {
    try {
      await navigator.clipboard.writeText(COMMAND);
      setCopied(true);
      setTimeout(() => setCopied(false), 1600);
    } catch {
      // clipboard blocked — leave the visible command for manual copy
    }
  }

  return (
    <div id="install" className="border hairline bg-parchment-50">
      <div className="flex items-center justify-between px-3 py-2 border-b hairline font-mono text-[10px] uppercase tracking-[0.18em] text-ink-faint">
        <span>install · cli</span>
        <span>v1 · npm</span>
      </div>

      <div className="p-4">
        <div className="relative">
          <pre
            className="font-mono text-[13px] leading-6 text-ink bg-parchment border hairline px-4 py-3 pr-20 whitespace-pre-wrap break-words"
            aria-label="Install command"
          >
            <span className="text-ink-faint select-none">$ </span>
            {COMMAND}
          </pre>
          <button
            type="button"
            onClick={copy}
            aria-label="Copy install command"
            className="absolute top-1.5 right-1.5 inline-flex items-center justify-center px-2.5 py-1 font-mono text-[10.5px] uppercase tracking-[0.16em] text-ink-muted hover:text-ink border hairline bg-parchment-50 transition-colors"
          >
            {copied ? "copied" : "copy"}
          </button>
        </div>

        <ol className="mt-5 space-y-2.5">
          {STEPS.map((s) => (
            <li
              key={s.id}
              className="flex items-baseline gap-3 font-mono text-[12px] text-ink-muted"
            >
              <span className="tabular text-ink-faint shrink-0">{s.id}</span>
              <span className="text-ink-faint shrink-0">→</span>
              <span>{s.label}</span>
            </li>
          ))}
        </ol>

        <p className="mt-5 pt-4 border-t hairline font-mono text-[11px] text-ink-faint leading-relaxed">
          Not yet polygraphed? The CLI returns{" "}
          <span className="text-ink-muted">not available yet</span>{" "}
          plus a notify link &mdash;{" "}
          <span className="text-ink-muted">check</span> is a lookup over
          published grades.
        </p>
      </div>
    </div>
  );
}
