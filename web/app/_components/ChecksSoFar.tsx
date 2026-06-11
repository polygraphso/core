"use client";

import { useState } from "react";
import { SectionHeader } from "./SectionHeader";

// §03 — browse the litmus-v1 checks that actually exist. A constrained
// dropdown, not an open lookup: every entry here is a real harness run.
// web3auth is a live third-party server; the demo-* entries are adversarial
// fixtures from the harness test suite — they exist to prove the test fails
// things. Values come from real runs / the repo's test expectations; never
// hand-edit them, refresh by re-running the harness.

type Run = {
  id: string;
  label: string;
  kind: "live server" | "our fixture";
  grade: "A" | "B" | "D" | "F";
  rows: Array<[string, string]>;
  rationale: string;
};

const RUNS: Run[] = [
  {
    id: "web3auth",
    label: "https://mcp.web3auth.io — hosted MCP server",
    kind: "live server",
    grade: "B",
    rows: [
      ["target", "https://mcp.web3auth.io"],
      ["transport", "Streamable HTTP — connected like an agent"],
      ["C-01 tool-output injection", "pass"],
      ["C-02 permission overreach", "skipped — remote target"],
      ["C-03 sensitive-data handling", "pass"],
      ["fingerprint", "0x4cb6…1ecd"],
    ],
    rationale:
      "Egress can't be verified on a remote server, so the grade caps at B by design — a property of remote targets, not a finding.",
  },
  {
    id: "demo-evil",
    label: "demo-evil — poisoned tool descriptions",
    kind: "our fixture",
    grade: "F",
    rows: [
      ["target", "demo-evil (adversarial fixture)"],
      [
        "C-01 tool-output injection",
        "fail — instruction mimicry in a tool description",
      ],
    ],
    rationale:
      "Built to be caught: its tool descriptions try to hijack the calling agent. Injection is disqualifying, so the grade floors at F.",
  },
  {
    id: "demo-leaky",
    label: "demo-leaky — exfiltrates planted secrets",
    kind: "our fixture",
    grade: "F",
    rows: [
      ["target", "demo-leaky (adversarial fixture)"],
      [
        "C-03 sensitive-data handling",
        "fail — planted canary surfaced in tool output",
      ],
    ],
    rationale:
      "Built to be caught: it echoes data it was trusted with. A data leak is disqualifying, so the grade floors at F.",
  },
  {
    id: "demo-good",
    label: "demo-good — well-behaved baseline",
    kind: "our fixture",
    grade: "B",
    rows: [
      ["target", "demo-good (baseline fixture)"],
      ["C-01 tool-output injection", "pass"],
      ["C-02 permission overreach", "skipped — no sandbox in this run"],
      ["C-03 sensitive-data handling", "pass"],
    ],
    rationale:
      "The clean baseline. Passes every behavioral check; egress unverified outside the sandbox, so B — same honest cap as any unsandboxed run.",
  },
];

const GRADE_COLOR: Record<Run["grade"], string> = {
  A: "var(--color-grade-a)",
  B: "var(--color-grade-b)",
  D: "var(--color-grade-d)",
  F: "var(--color-grade-f)",
};

export function ChecksSoFar() {
  const [selectedId, setSelectedId] = useState(RUNS[0].id);
  const run = RUNS.find((r) => r.id === selectedId) ?? RUNS[0];

  return (
    <section
      id="checks"
      className="mx-auto max-w-6xl px-6 py-20 md:py-28 scroll-mt-12"
    >
      <SectionHeader
        number="§ 03"
        label="Completed checks"
        title="Browse the checks we've run."
      >
        Every entry is a real litmus-v1 harness run &mdash; a live server,
        plus the adversarial fixtures we built so the test has something to
        catch. A litmus that never fails anything proves nothing.
      </SectionHeader>

      <div className="border hairline bg-parchment-50 max-w-3xl">
        <div className="flex items-center justify-between px-4 py-2.5 border-b hairline font-mono text-[10.5px] uppercase tracking-[0.18em] text-ink-faint">
          <span>litmus-v1 · harness output</span>
          <span className="hidden sm:inline">{RUNS.length} runs</span>
        </div>

        <div className="p-4 md:p-6">
          <label className="block">
            <span className="font-mono text-[11px] uppercase tracking-[0.16em] text-ink-faint block mb-2">
              Select a run
            </span>
            <select
              value={selectedId}
              onChange={(e) => setSelectedId(e.target.value)}
              className="w-full bg-parchment border hairline px-3.5 py-2.5 font-mono text-sm text-ink focus:outline-none focus:border-ink transition-colors appearance-none cursor-pointer"
            >
              {RUNS.map((r) => (
                <option key={r.id} value={r.id}>
                  {r.label}
                </option>
              ))}
            </select>
          </label>

          <div className="mt-4 border hairline bg-parchment">
            <div className="flex items-center justify-between px-3 py-1.5 border-b hairline font-mono text-[10px] uppercase tracking-[0.18em] text-ink-faint">
              <span>{run.kind}</span>
              <span className="text-ink">litmus-v1</span>
            </div>
            <div className="px-3 py-3 flex gap-4">
              <span
                className="font-serif text-4xl leading-none shrink-0"
                style={{ color: GRADE_COLOR[run.grade] }}
                aria-label={`Grade ${run.grade}`}
              >
                {run.grade}
              </span>
              <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-1 font-mono text-[12px] text-ink-muted min-w-0">
                {run.rows.map(([k, v]) => (
                  <div key={k} className="contents">
                    <dt className="text-ink-faint">{k}</dt>
                    <dd className="text-ink break-all">{v}</dd>
                  </div>
                ))}
              </dl>
            </div>
            <p className="px-3 pb-3 font-sans text-[12px] text-ink-faint leading-relaxed">
              {run.rationale}
            </p>
          </div>

          <p className="mt-4 font-mono text-[11px] text-ink-faint leading-relaxed">
            Public registry servers are next on the bench.{" "}
            <a
              href="#updates"
              className="text-ink-muted border-b hairline border-dotted hover:text-oxblood transition-colors"
            >
              Subscribe below
            </a>{" "}
            &mdash; one email per publishing drop, nothing else.
          </p>
        </div>
      </div>
    </section>
  );
}
