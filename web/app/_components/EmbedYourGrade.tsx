"use client";

import { useState } from "react";
import { SectionHeader } from "./SectionHeader";

// A real graded server stands in as the example — the previews render an actual
// grade, and the snippet is the template a maintainer swaps their own ref into.
const EXAMPLE = "npm/@modelcontextprotocol/server-filesystem";
const BADGE_SRC = `/api/badge?server=${EXAMPLE}`;
const CARD_SRC = `/api/badge/card?server=${EXAMPLE}`;
const PAGE_HREF = `/mcp/${EXAMPLE}`;
const SNIPPET = `[![polygraph](https://polygraph.so/api/badge?server=${EXAMPLE})](https://polygraph.so/mcp/${EXAMPLE})`;

export function EmbedYourGrade() {
  const [copied, setCopied] = useState(false);

  async function copy() {
    try {
      await navigator.clipboard.writeText(SNIPPET);
      setCopied(true);
      setTimeout(() => setCopied(false), 1600);
    } catch {
      // clipboard blocked — the snippet stays visible for manual copy
    }
  }

  return (
    <section id="badge" className="mx-auto max-w-6xl px-6 py-20 md:py-28 scroll-mt-24">
      <SectionHeader
        number="§ 05"
        label="Get a badge"
        title="Show your grade where developers look."
      >
        Maintain an MCP server we&rsquo;ve graded? Put its live polygraph on your
        README, npm page, or docs. The badge reads the current grade &mdash; it
        updates itself &mdash; and links back to the reproducible report.
      </SectionHeader>

      <div className="grid md:grid-cols-2 gap-4 items-start">
        {/* The card — the fuller visual. On mobile it drops below the badge,
            where the crisp inline badge + snippet are the actionable part. */}
        <div className="order-2 md:order-1 border hairline bg-parchment-50 p-5">
          <p className="section-label mb-3">The card</p>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={CARD_SRC}
            alt="Example polygraph grade card for an MCP server"
            className="w-full border hairline"
          />
          <p className="mt-3 font-mono text-[11px] text-ink-faint leading-relaxed">
            A fuller card for a README header or a docs page.
          </p>
        </div>

        {/* The inline badge + the snippet to copy */}
        <div className="order-1 md:order-2 border hairline bg-parchment-50 p-5 flex flex-col">
          <p className="section-label mb-3">The inline badge</p>
          <div className="flex items-center gap-3 mb-4">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={BADGE_SRC} alt="Example polygraph grade badge" height={20} />
            <span className="font-mono text-[11px] text-ink-faint">
              sits in a README badge row
            </span>
          </div>

          <div className="relative">
            <pre className="font-mono text-[11.5px] leading-6 text-ink bg-parchment border hairline px-3 py-2.5 pr-16 whitespace-pre-wrap break-words">
              {SNIPPET}
            </pre>
            <button
              type="button"
              onClick={copy}
              aria-label="Copy markdown snippet"
              className="absolute top-1.5 right-1.5 inline-flex items-center justify-center px-2 py-0.5 font-mono text-[10px] uppercase tracking-[0.16em] text-ink-muted hover:text-ink border hairline bg-parchment-50 transition-colors"
            >
              {copied ? "copied" : "copy"}
            </button>
          </div>

          <p className="mt-3 font-mono text-[11px] text-ink-faint leading-relaxed">
            Swap in your own{" "}
            <span className="text-ink-muted">registry/owner/name</span> ref.{" "}
            <a
              href="/docs/api#badge"
              className="text-ink-muted border-b hairline border-dotted hover:text-oxblood transition-colors"
            >
              Full embed guide →
            </a>
          </p>
          <p className="mt-1.5 font-mono text-[11px] text-ink-faint leading-relaxed">
            <a
              href={PAGE_HREF}
              className="text-ink-muted border-b hairline border-dotted hover:text-oxblood transition-colors"
            >
              See a live report →
            </a>
          </p>
        </div>
      </div>
    </section>
  );
}
