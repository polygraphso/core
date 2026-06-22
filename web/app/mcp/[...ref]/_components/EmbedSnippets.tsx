"use client";

import { useState } from "react";

// Copy-paste embed block for the per-server page: markdown + HTML for the inline
// badge, plus markdown for the larger card. The badge/card URLs query the live
// grade, so the snippet a maintainer copies once stays current on its own.

function CopyBlock({ label, code }: { label: string; code: string }) {
  const [copied, setCopied] = useState(false);

  async function copy() {
    try {
      await navigator.clipboard.writeText(code);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      // Clipboard blocked (insecure context / permissions) — leave the text
      // selectable in the <pre> as the fallback.
    }
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-1.5">
        <span className="font-mono text-[10.5px] uppercase tracking-[0.16em] text-ink-faint">
          {label}
        </span>
        <button
          type="button"
          onClick={copy}
          className="font-mono text-[10.5px] uppercase tracking-[0.14em] text-ink-muted hover:text-oxblood transition-colors"
        >
          {copied ? "copied" : "copy"}
        </button>
      </div>
      <pre className="overflow-x-auto rounded-sm border hairline bg-parchment-50 px-3.5 py-2.5 font-mono text-[12px] leading-relaxed text-ink">
        <code>{code}</code>
      </pre>
    </div>
  );
}

export function EmbedSnippets({
  badgeUrl,
  cardUrl,
  pageUrl,
}: {
  badgeUrl: string;
  cardUrl: string;
  pageUrl: string;
}) {
  return (
    <div className="space-y-4">
      <CopyBlock label="Markdown — badge" code={`[![polygraph](${badgeUrl})](${pageUrl})`} />
      <CopyBlock
        label="HTML — badge"
        code={`<a href="${pageUrl}"><img src="${badgeUrl}" alt="polygraph grade"></a>`}
      />
      <CopyBlock label="Markdown — card" code={`[![polygraph](${cardUrl})](${pageUrl})`} />
    </div>
  );
}
