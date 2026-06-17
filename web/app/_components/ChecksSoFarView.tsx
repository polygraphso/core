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

type KindFilter = "all" | "mcp" | "skill";

const KIND_FILTERS: Array<{ value: KindFilter; label: string }> = [
  { value: "all", label: "All" },
  { value: "mcp", label: "MCP servers" },
  { value: "skill", label: "Skills" },
];

export function ChecksSoFarView({ runs }: { runs: Run[] }) {
  const [query, setQuery] = useState("");
  const [kind, setKind] = useState<KindFilter>("all");
  const [selectedId, setSelectedId] = useState(runs[0]?.id ?? "");

  const q = query.trim().toLowerCase();
  const filtered = runs.filter(
    (r) => (kind === "all" || r.category === kind) && (q === "" || r.label.toLowerCase().includes(q)),
  );
  // Keep the selection valid as filters narrow the list: fall back to the first match.
  const run = filtered.find((r) => r.id === selectedId) ?? filtered[0];
  const filtering = q !== "" || kind !== "all";

  return (
    <section id="checks" className="mx-auto max-w-6xl px-6 py-20 md:py-28 scroll-mt-12">
      <SectionHeader number="§ 03" label="Completed checks" title="Browse the checks we've run.">
        Every entry is a real litmus harness run against an MCP server or a Claude Code
        skill we exercised the way an agent would — graded, fingerprinted, and published
        here as we go. Search by name, or filter by type. Each row shows the methodology
        version it was graded under.
      </SectionHeader>

      <div className="border hairline bg-parchment-50 max-w-3xl">
        <div className="flex items-center justify-between px-4 py-2.5 border-b hairline font-mono text-[10.5px] uppercase tracking-[0.18em] text-ink-faint">
          <span>litmus · harness output</span>
          <span className="hidden sm:inline">
            {runs.length === 0
              ? "no runs yet"
              : filtering
                ? `${filtered.length} of ${runs.length} runs`
                : `${runs.length} runs`}
          </span>
        </div>

        <div className="p-4 md:p-6">
          {runs.length === 0 ? (
            <p className="font-mono text-sm text-ink-muted leading-relaxed">
              No checks published yet. When we grade a server or a skill, it will show up here.
            </p>
          ) : (
            <>
              <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
                <label className="block flex-1">
                  <span className="font-mono text-[11px] uppercase tracking-[0.16em] text-ink-faint block mb-2">
                    Search
                  </span>
                  <input
                    type="search"
                    value={query}
                    onChange={(e) => setQuery(e.target.value)}
                    placeholder="server or skill name…"
                    className="w-full bg-parchment border hairline px-3.5 py-2.5 font-mono text-sm text-ink placeholder:text-ink-faint focus:outline-none focus:border-ink transition-colors"
                  />
                </label>
                <div className="flex border hairline self-start sm:self-auto" role="group" aria-label="Filter by type">
                  {KIND_FILTERS.map((f, i) => (
                    <button
                      key={f.value}
                      type="button"
                      onClick={() => setKind(f.value)}
                      aria-pressed={kind === f.value}
                      className={`${i > 0 ? "border-l hairline " : ""}px-3 py-2.5 font-mono text-[11px] uppercase tracking-[0.14em] transition-colors ${
                        kind === f.value ? "bg-parchment text-ink" : "text-ink-faint hover:text-ink-muted"
                      }`}
                    >
                      {f.label}
                    </button>
                  ))}
                </div>
              </div>

              {filtered.length === 0 ? (
                <p className="mt-4 font-mono text-sm text-ink-muted leading-relaxed">
                  No matching checks. Clear the search or pick a different type.
                </p>
              ) : (
                <>
                  <label className="block mt-4">
                    <span className="font-mono text-[11px] uppercase tracking-[0.16em] text-ink-faint block mb-2">
                      Select a run
                    </span>
                    <select
                      value={run?.id ?? ""}
                      onChange={(e) => setSelectedId(e.target.value)}
                      className="w-full bg-parchment border hairline px-3.5 py-2.5 font-mono text-sm text-ink focus:outline-none focus:border-ink transition-colors appearance-none cursor-pointer"
                    >
                      {filtered.map((r) => (
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
                        <span className="text-ink">{run.methodologyVersion}</span>
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
            </>
          )}

          <p className="mt-4 font-mono text-[11px] text-ink-faint leading-relaxed">
            Want a specific server graded?{" "}
            <a
              href="/request"
              className="text-ink-muted border-b hairline border-dotted hover:text-oxblood transition-colors"
            >
              Add it to the queue
            </a>{" "}
            &mdash; free. Or{" "}
            <a
              href="#updates"
              className="text-ink-muted border-b hairline border-dotted hover:text-oxblood transition-colors"
            >
              subscribe below
            </a>{" "}
            for one email per publishing drop.
          </p>
        </div>
      </div>
    </section>
  );
}
