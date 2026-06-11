"use client";

import { useState } from "react";
import { SectionHeader } from "./SectionHeader";
import type { Run } from "./checksMapper";

const GRADE_COLOR: Record<Run["grade"], string> = {
  A: "var(--color-grade-a)",
  B: "var(--color-grade-b)",
  C: "var(--color-grade-c)",
  D: "var(--color-grade-d)",
  F: "var(--color-grade-f)",
};

export function ChecksSoFarView({ runs }: { runs: Run[] }) {
  const [selectedId, setSelectedId] = useState(runs[0]?.id ?? "");
  const run = runs.find((r) => r.id === selectedId) ?? runs[0];

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
        Every entry is a real litmus-v1 harness run against a live server we
        exercised the way an agent would — graded, fingerprinted, and published
        here as we go.
      </SectionHeader>

      <div className="border hairline bg-parchment-50 max-w-3xl">
        <div className="flex items-center justify-between px-4 py-2.5 border-b hairline font-mono text-[10.5px] uppercase tracking-[0.18em] text-ink-faint">
          <span>litmus-v1 · harness output</span>
          <span className="hidden sm:inline">
            {runs.length > 0 ? `${runs.length} runs` : "no runs yet"}
          </span>
        </div>

        <div className="p-4 md:p-6">
          {runs.length === 0 ? (
            <p className="font-mono text-sm text-ink-muted leading-relaxed">
              No checks published yet. When we grade a live server, it will show
              up here.
            </p>
          ) : (
            <>
              <label className="block">
                <span className="font-mono text-[11px] uppercase tracking-[0.16em] text-ink-faint block mb-2">
                  Select a run
                </span>
                <select
                  value={selectedId}
                  onChange={(e) => setSelectedId(e.target.value)}
                  className="w-full bg-parchment border hairline px-3.5 py-2.5 font-mono text-sm text-ink focus:outline-none focus:border-ink transition-colors appearance-none cursor-pointer"
                >
                  {runs.map((r) => (
                    <option key={r.id} value={r.id}>
                      {r.label}
                    </option>
                  ))}
                </select>
              </label>

              {run ? (
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
                    <dl className="flex-1 grid grid-cols-1 gap-y-2 sm:grid-cols-[auto_1fr] sm:gap-x-4 sm:gap-y-1 font-mono text-[12px] text-ink-muted min-w-0">
                      {run.rows.map(([k, v]) => (
                        <div key={k} className="sm:contents">
                          <dt className="text-ink-faint">{k}</dt>
                          <dd className="text-ink break-words">{v}</dd>
                        </div>
                      ))}
                    </dl>
                  </div>
                  <p className="px-3 pb-3 font-sans text-[12px] text-ink-faint leading-relaxed">
                    <span className="font-mono text-[11px] uppercase tracking-[0.14em] text-ink">
                      Why {run.grade}:
                    </span>{" "}
                    {run.rationale}
                  </p>
                </div>
              ) : null}
            </>
          )}

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
