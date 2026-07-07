"use client";

import { useState } from "react";
import { SectionHeader } from "./SectionHeader";

/**
 * The builders tooling, the four self-serve surfaces of the open litmus harness:
 * install & run, gate CI, get a badge, manual config. Consolidated off the old
 * homepage Install + EmbedYourGrade sections into the dedicated /builders page,
 * split to match the design's four sections. One shared copy-state keyed by
 * block. Copy is kept verbatim from the shipped homepage sections.
 */

// One-click Cursor deeplink — installs the polygraph-litmus MCP server
// (run_litmus, verify_attestation). cursor:// only works where raw schemes
// render (this site, Cursor's marketplace); GitHub/npm strip it.
const CURSOR_DEEPLINK =
  "cursor://anysphere.cursor-deeplink/mcp/install?name=polygraph-litmus&config=eyJjb21tYW5kIjoibnB4IiwiYXJncyI6WyIteSIsIi1wIiwiQHBvbHlncmFwaHNvL2xpdG11cyIsInBvbHlncmFwaHNvLWxpdG11cy1tY3AiXSwiZW52Ijp7IlBPTFlHUkFQSF9BUElfVVJMIjoiaHR0cHM6Ly9wb2x5Z3JhcGguc28ifX0=";

const GRADE_CMD =
  "npx -y -p @polygraphso/litmus polygraphso-litmus litmus <mcp-server>";
const ANY_CLIENT_CMD = "npx -y -p @polygraphso/litmus polygraphso-litmus-mcp";
const CLAUDE_CODE_CMD = "/plugin install polygraph@polygraphso";

// The GitHub Action (composite, marketplace handle polygraphso/litmus@v1) that
// fails a build when an MCP server or a bundled skill grades D/F.
const GATE_WORKFLOW_YAML = `# .github/workflows/mcp-gate.yml
name: mcp-gate
on: [pull_request]
permissions:
  contents: read
jobs:
  gate:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v5
      - uses: polygraphso/litmus@v1`;

const MARKETPLACE_URL =
  "https://github.com/marketplace/actions/polygraph-mcp-gate";

// The standard MCP config — the same JSON for Cursor (~/.cursor/mcp.json),
// Claude Desktop (claude_desktop_config.json), and any other MCP client.
const MCP_CONFIG_JSON = `{
  "mcpServers": {
    "polygraph-litmus": {
      "command": "npx",
      "args": ["-y", "-p", "@polygraphso/litmus", "polygraphso-litmus-mcp"],
      "env": { "POLYGRAPH_API_URL": "https://polygraph.so" }
    }
  }
}`;

// A real graded server stands in as the badge example — the previews render an
// actual grade, and the snippet is the template a maintainer swaps their ref into.
const EXAMPLE = "npm/@modelcontextprotocol/server-filesystem";
const BADGE_SRC = `/api/badge?server=${EXAMPLE}`;
const CARD_SRC = `/api/badge/card?server=${EXAMPLE}`;
const PAGE_HREF = `/mcp/${EXAMPLE}`;
const SNIPPET = `[![polygraph](https://polygraph.so/api/badge?server=${EXAMPLE})](https://polygraph.so/mcp/${EXAMPLE})`;

export function BuildersTooling() {
  const [copied, setCopied] = useState<string | null>(null);

  async function copy(key: string, text: string) {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(key);
      setTimeout(() => setCopied(null), 1600);
    } catch {
      // clipboard blocked — the text stays visible for manual copy
    }
  }

  return (
    <>
      {/* § 01 — install & run */}
      <section id="install" className="mx-auto max-w-6xl px-6 pb-16 md:pb-20 scroll-mt-24">
        <SectionHeader
          number="§ 01"
          label="Install & run"
          title="Run polygraph in your agent &mdash; or grade a server from your terminal."
        >
          The open litmus harness grades a server A&ndash;F with reproducible,
          content-addressed evidence. Add it to your agent, run it yourself, or
          gate your CI on it.
        </SectionHeader>

        <div className="grid md:grid-cols-3 gap-4">
          {/* Cursor — one-click */}
          <div className="border hairline bg-parchment-50 p-5 flex flex-col">
            <p className="section-label mb-3">Cursor</p>
            <a
              href={CURSOR_DEEPLINK}
              className="inline-flex items-center justify-center gap-2 px-4 py-2.5 font-mono text-[12px] uppercase tracking-[0.16em] text-oxblood border border-oxblood hover:bg-oxblood hover:text-parchment transition-colors"
            >
              Add to Cursor <span aria-hidden>&rarr;</span>
            </a>
            <p className="mt-3 font-mono text-[11px] text-ink-faint leading-relaxed">
              One click &mdash; installs the MCP server (
              <span className="text-ink-muted">run_litmus</span>,{" "}
              <span className="text-ink-muted">verify_attestation</span>). Prefer to
              edit <span className="text-ink-muted">~/.cursor/mcp.json</span>? Use the
              config below.
            </p>
          </div>

          {/* Terminal — run the litmus harness directly */}
          <div className="border hairline bg-parchment-50 p-5 flex flex-col">
            <p className="section-label mb-3">Terminal</p>
            <Command
              cmd={GRADE_CMD}
              copied={copied === "grade"}
              onCopy={() => copy("grade", GRADE_CMD)}
            />
            <p className="mt-3 font-mono text-[11px] text-ink-faint leading-relaxed">
              Grade a server yourself. Or wire the MCP server into any client with{" "}
              <span className="text-ink-muted">{ANY_CLIENT_CMD}</span>.
            </p>
          </div>

          {/* Claude — plugin + desktop config */}
          <div className="border hairline bg-parchment-50 p-5 flex flex-col">
            <p className="section-label mb-3">Claude</p>
            <Command
              cmd={CLAUDE_CODE_CMD}
              prefix=""
              copied={copied === "claude"}
              onCopy={() => copy("claude", CLAUDE_CODE_CMD)}
            />
            <p className="mt-3 font-mono text-[11px] text-ink-faint leading-relaxed">
              Claude Code, after{" "}
              <span className="text-ink-muted">
                /plugin marketplace add polygraphso/litmus
              </span>
              . Claude Desktop: paste the config below into{" "}
              <span className="text-ink-muted">claude_desktop_config.json</span>.
            </p>
          </div>
        </div>
      </section>

      {/* § 02 — gate your CI */}
      <section id="gate" className="mx-auto max-w-6xl px-6 pb-16 md:pb-20 scroll-mt-24">
        <SectionHeader
          number="§ 02"
          label="Gate your CI"
          title="Fail a build when a tool grades D/F."
        >
          The composite GitHub Action stops a merge when an MCP server &mdash; or
          a skill it ships &mdash; grades{" "}
          <span className="font-mono text-[0.9em] text-ink">D/F</span>. On the{" "}
          <a
            href={MARKETPLACE_URL}
            target="_blank"
            rel="noreferrer"
            className="text-ink-muted underline decoration-dotted underline-offset-2 hover:text-oxblood transition-colors"
          >
            GitHub Marketplace
          </a>{" "}
          as <span className="font-mono text-[0.9em] text-ink">polygraphso/litmus@v1</span>.
        </SectionHeader>

        <div className="border hairline bg-parchment-50 p-5">
          <p className="section-label mb-3">GitHub Action</p>
          <Command
            cmd={GATE_WORKFLOW_YAML}
            prefix=""
            copied={copied === "gate"}
            onCopy={() => copy("gate", GATE_WORKFLOW_YAML)}
          />
        </div>
      </section>

      {/* § 03 — get a badge */}
      <section id="badge" className="mx-auto max-w-6xl px-6 pb-16 md:pb-20 scroll-mt-24">
        <SectionHeader
          number="§ 03"
          label="Get a badge"
          title="Show your grade where developers look."
        >
          Maintain a server we&rsquo;ve graded? Put its live polygraph on your
          README, npm page, or docs. The badge reads the current grade &mdash; it
          updates itself &mdash; and links back to the reproducible report.
        </SectionHeader>

        <div className="grid md:grid-cols-2 gap-4 items-start">
          {/* The card — the fuller visual. On mobile it drops below the badge. */}
          <div className="order-2 md:order-1 min-w-0 border hairline bg-parchment-50 p-5">
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
          <div className="order-1 md:order-2 min-w-0 border hairline bg-parchment-50 p-5 flex flex-col">
            <p className="section-label mb-3">The inline badge</p>
            <div className="flex items-center gap-3 mb-4">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={BADGE_SRC} alt="Example polygraph grade badge" height={20} />
              <span className="font-mono text-[11px] text-ink-faint">
                sits in a README badge row
              </span>
            </div>

            <div className="relative">
              <pre className="font-mono text-[11.5px] leading-6 text-ink bg-parchment border hairline px-3 py-2.5 pr-16 whitespace-pre-wrap break-all">
                {SNIPPET}
              </pre>
              <button
                type="button"
                onClick={() => copy("snippet", SNIPPET)}
                aria-label="Copy markdown snippet"
                className="absolute top-1.5 right-1.5 inline-flex items-center justify-center px-2 py-0.5 font-mono text-[10px] uppercase tracking-[0.16em] text-ink-muted hover:text-ink border hairline bg-parchment-50 transition-colors"
              >
                {copied === "snippet" ? "copied" : "copy"}
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

      {/* § 04 — manual setup */}
      <section id="manual" className="mx-auto max-w-6xl px-6 pb-4 scroll-mt-24">
        <SectionHeader
          number="§ 04"
          label="Manual setup"
          title="One config, every MCP client."
        >
          Same config everywhere &mdash; paste into{" "}
          <span className="font-mono text-[0.9em] text-ink">~/.cursor/mcp.json</span>{" "}
          (Cursor),{" "}
          <span className="font-mono text-[0.9em] text-ink">claude_desktop_config.json</span>{" "}
          (Claude Desktop), or your client&rsquo;s MCP config.
        </SectionHeader>

        <div className="border hairline bg-parchment-50 p-5">
          <p className="section-label mb-3">mcp.json</p>
          <Command
            cmd={MCP_CONFIG_JSON}
            prefix=""
            copied={copied === "config"}
            onCopy={() => copy("config", MCP_CONFIG_JSON)}
          />
        </div>
      </section>
    </>
  );
}

function Command({
  cmd,
  prefix = "$ ",
  copied,
  onCopy,
}: {
  cmd: string;
  prefix?: string;
  copied: boolean;
  onCopy: () => void;
}) {
  return (
    <div className="relative">
      <pre className="font-mono text-[12px] leading-6 text-ink bg-parchment border hairline px-3 py-2.5 pr-16 whitespace-pre-wrap break-words">
        {prefix && <span className="text-ink-faint select-none">{prefix}</span>}
        {cmd}
      </pre>
      <button
        type="button"
        onClick={onCopy}
        aria-label="Copy command"
        className="absolute top-1.5 right-1.5 inline-flex items-center justify-center px-2 py-0.5 font-mono text-[10px] uppercase tracking-[0.16em] text-ink-muted hover:text-ink border hairline bg-parchment-50 transition-colors"
      >
        {copied ? "copied" : "copy"}
      </button>
    </div>
  );
}
