"use client";

import { useState } from "react";

/**
 * The share row on a grade report. The report page IS the shareable artifact —
 * pasting its URL into X, Slack, or Discord unfurls the grade-card OG image the
 * page already declares in its metadata — so this just makes the two obvious
 * actions one click: post it to X, or copy the link. No new OG route needed.
 *
 * Shared by the per-server (/mcp) and per-skill (/skill) reports; the caller
 * supplies the canonical page URL and a preprint-voice share line.
 */
export function ShareGrade({ pageUrl, text }: { pageUrl: string; text: string }) {
  const [copied, setCopied] = useState(false);

  async function copy() {
    try {
      await navigator.clipboard.writeText(pageUrl);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      // Clipboard blocked (insecure context / permissions) — the X link still works.
    }
  }

  const intent = `https://twitter.com/intent/tweet?text=${encodeURIComponent(
    text,
  )}&url=${encodeURIComponent(pageUrl)}`;

  return (
    <div className="mt-6 flex flex-wrap items-center gap-x-3 gap-y-2">
      <a
        href={intent}
        target="_blank"
        rel="noreferrer noopener"
        className="inline-flex items-center gap-1.5 border hairline px-3.5 py-1.5 font-mono text-[11px] uppercase tracking-[0.14em] text-ink-muted hover:text-oxblood transition-colors"
      >
        Share on X <span aria-hidden>↗</span>
      </a>
      <button
        type="button"
        onClick={copy}
        className="inline-flex items-center gap-1.5 border hairline px-3.5 py-1.5 font-mono text-[11px] uppercase tracking-[0.14em] text-ink-muted hover:text-oxblood transition-colors"
      >
        {copied ? "Link copied" : "Copy link"}
      </button>
    </div>
  );
}
