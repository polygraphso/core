"use client";

import { useState } from "react";
import { SectionHeader } from "./SectionHeader";

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
        number="§ 04"
        label="Install"
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

      {/* GitHub Action — gate CI on MCP-server / skill grades */}
      <div className="mt-4 border hairline bg-parchment-50 p-5">
        <p className="section-label mb-2">
          Gate your CI &mdash; GitHub Action
        </p>
        <p className="mb-3 font-mono text-[11px] text-ink-faint leading-relaxed">
          Fail a build when an MCP server &mdash; or a skill it ships &mdash;
          grades <span className="text-ink-muted">D/F</span>. On the{" "}
          <a
            href={MARKETPLACE_URL}
            target="_blank"
            rel="noreferrer"
            className="text-ink-muted underline decoration-dotted underline-offset-2 hover:text-oxblood transition-colors"
          >
            GitHub Marketplace
          </a>{" "}
          as <span className="text-ink-muted">polygraphso/litmus@v1</span>:
        </p>
        <Command
          cmd={GATE_WORKFLOW_YAML}
          prefix=""
          copied={copied === "gate"}
          onCopy={() => copy("gate", GATE_WORKFLOW_YAML)}
        />
      </div>

      {/* Manual setup — one config, identical for every MCP client */}
      <div className="mt-4 border hairline bg-parchment-50 p-5">
        <p className="section-label mb-2">Manual setup &mdash; any MCP client</p>
        <p className="mb-3 font-mono text-[11px] text-ink-faint leading-relaxed">
          Same config everywhere &mdash; paste into{" "}
          <span className="text-ink-muted">~/.cursor/mcp.json</span> (Cursor),{" "}
          <span className="text-ink-muted">claude_desktop_config.json</span>{" "}
          (Claude Desktop), or your client&rsquo;s MCP config:
        </p>
        <Command
          cmd={MCP_CONFIG_JSON}
          prefix=""
          copied={copied === "config"}
          onCopy={() => copy("config", MCP_CONFIG_JSON)}
        />
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
