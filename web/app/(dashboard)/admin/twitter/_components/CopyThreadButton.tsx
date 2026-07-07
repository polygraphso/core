"use client";

import { useState } from "react";

/**
 * Per-thread copy button for the list page — copies every tweet's text
 * (blank-line separated), the same format as the editor's "Copy thread".
 */
export function CopyThreadButton({ tweets }: { tweets: string[] }) {
  const [copied, setCopied] = useState(false);

  async function copy() {
    try {
      await navigator.clipboard.writeText(tweets.join("\n\n"));
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      // clipboard unavailable — leave the label unchanged
    }
  }

  return (
    <button
      type="button"
      onClick={copy}
      disabled={tweets.length === 0}
      className="font-mono text-[11px] border px-2 py-1 hover:bg-ink/5 disabled:opacity-40"
    >
      {copied ? "✓ copied" : "Copy"}
    </button>
  );
}
