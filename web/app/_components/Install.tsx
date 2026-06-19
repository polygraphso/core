"use client";

import { useState } from "react";
import { SectionHeader } from "./SectionHeader";

// One-click Cursor deeplink — installs the polygraph-litmus MCP server
// (run_litmus, verify_attestation). cursor:// only works where raw schemes
// render (this site, Cursor's marketplace); GitHub/npm strip it.
const CURSOR_DEEPLINK =
  "cursor://anysphere.cursor-deeplink/mcp/install?name=polygraph-litmus&config=eyJjb21tYW5kIjoibnB4IiwiYXJncyI6WyIteSIsIi1wIiwiQHBvbHlncmFwaHNvL2xpdG11cyIsInBvbHlncmFwaHNvLWxpdG11cy1tY3AiXSwiZW52Ijp7IlBPTFlHUkFQSF9BUElfVVJMIjoiaHR0cHM6Ly9wb2x5Z3JhcGguc28ifX0=";

const CHECK_CMD = "npx polygraphso check <mcp-server>";
const ANY_CLIENT_CMD = "npx -y -p @polygraphso/litmus polygraphso-litmus-mcp";
const CLAUDE_CODE_CMD = "/plugin install polygraph@polygraphso";

export function Install() {
  const [copied, setCopied] = useState<string | null>(null);

  async function copy(key: string, text: string) {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(key);
      setTimeout(() => setCopied(null), 1600);
    } catch {
      // clipboard blocked — the command stays visible for manual copy
    }
  }

  return (
    <section
      id="install"
      className="mx-auto max-w-6xl px-6 py-20 md:py-28 scroll-mt-24"
    >
      <SectionHeader
        number="§ 03"
        label="Install"
        title="Put polygraph in your agent &mdash; or check a server from the terminal."
      >
        Free and public. Grade lookups are a sub-second call; the harness that
        produces grades is the same open package, run locally.
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
            <span className="text-ink-muted">verify_attestation</span>). Or add it
            to <span className="text-ink-muted">~/.cursor/mcp.json</span> by hand.
          </p>
        </div>

        {/* Terminal — the lookup CLI */}
        <div className="border hairline bg-parchment-50 p-5 flex flex-col">
          <p className="section-label mb-3">Terminal</p>
          <Command
            cmd={CHECK_CMD}
            copied={copied === "check"}
            onCopy={() => copy("check", CHECK_CMD)}
          />
          <p className="mt-3 font-mono text-[11px] text-ink-faint leading-relaxed">
            Look up a server&rsquo;s grade. Run the harness in any MCP client with{" "}
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
            . Claude Desktop: add the server to{" "}
            <span className="text-ink-muted">claude_desktop_config.json</span>.
          </p>
        </div>
      </div>
    </section>
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
