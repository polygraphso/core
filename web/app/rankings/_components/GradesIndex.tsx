"use client";

import { useState } from "react";
import Link from "next/link";
import { GRADE_HEX } from "@/lib/gradeColors";
import type { RankingRow } from "@/lib/rankings";
import type { SkillIndexRow } from "@/lib/skillGrades";
import { RankingsTable } from "./RankingsTable";
import { SkillsTable } from "./SkillsTable";

type Tab = "mcp" | "skill";

/** Shared pass/fail/not-run glyph key above each tab's check legend. */
function GlyphKey() {
  return (
    <>
      <span>
        <span style={{ color: GRADE_HEX.A }}>✓</span> pass
      </span>
      <span>
        <span style={{ color: "var(--color-oxblood)" }}>✕</span> fail
      </span>
      <span>
        <span className="text-ink-faint">–</span> not run
      </span>
    </>
  );
}

/**
 * The single grades index: one canonical page with MCP servers (adoption-ranked,
 * behavioral) and Agent Skills (static safety scan) under two tabs. Replaces the
 * old split between the /rankings index and the homepage "Checks" widget.
 */
export function GradesIndex({
  serverRows,
  skillRows,
}: {
  serverRows: RankingRow[];
  skillRows: SkillIndexRow[];
}) {
  const [tab, setTab] = useState<Tab>("mcp");
  const tabs: Array<{ value: Tab; label: string; count: number }> = [
    { value: "mcp", label: "MCP servers", count: serverRows.length },
    { value: "skill", label: "Skills", count: skillRows.length },
  ];

  return (
    <div>
      <div className="mb-6 flex w-fit border hairline" role="tablist" aria-label="Grade type">
        {tabs.map((t, i) => (
          <button
            key={t.value}
            type="button"
            role="tab"
            aria-selected={tab === t.value}
            onClick={() => setTab(t.value)}
            className={`${i > 0 ? "border-l hairline " : ""}px-4 py-2.5 font-mono text-[11px] uppercase tracking-[0.14em] transition-colors ${
              tab === t.value ? "bg-ink text-parchment" : "text-ink-muted hover:text-ink"
            }`}
          >
            {t.label} <span className="tabular opacity-70">{t.count}</span>
          </button>
        ))}
      </div>

      {tab === "mcp" ? (
        <>
          <RankingsTable rows={serverRows} />
          <p className="mt-5 flex flex-wrap gap-x-5 gap-y-1 font-mono text-[11px] text-ink-faint leading-relaxed">
            <GlyphKey />
            <span className="text-ink-faint/80">
              C-01 tool-output injection · C-02 egress overreach · C-03 sensitive-data handling ·
              C-04 adversarial-input handling
            </span>
          </p>
          <p className="mt-10 text-ink-faint text-xs leading-relaxed max-w-2xl">
            Ranked by the <span className="text-ink-muted">adoption score</span> (0–100, shown at
            right above monthly downloads) — a composite of downloads (npm / PyPI), GitHub stars,
            dependents and release velocity. It measures{" "}
            <span className="text-ink-muted">reach, not safety</span>: the litmus grade is the only
            safety verdict. Grades come from the open litmus harness; you can{" "}
            <Link href="/request" className="border-b hairline border-dotted hover:text-oxblood">
              request a grade
            </Link>{" "}
            for a server, or read the{" "}
            <Link href="/methodology" className="border-b hairline border-dotted hover:text-oxblood">
              methodology
            </Link>
            .
          </p>
        </>
      ) : (
        <>
          <SkillsTable rows={skillRows} />
          <p className="mt-5 flex flex-wrap gap-x-5 gap-y-1 font-mono text-[11px] text-ink-faint leading-relaxed">
            <GlyphKey />
            <span className="text-ink-faint/80">
              S-01 prompt-injection · S-03 data-exfiltration instructions · S-04 dangerous bundled
              commands
            </span>
          </p>
          <p className="mt-10 text-ink-faint text-xs leading-relaxed max-w-2xl">
            Skills are graded by a <span className="text-ink-muted">static safety scan</span>{" "}
            (litmus-skill-v2) of the <span className="font-mono text-[0.92em]">SKILL.md</span>{" "}
            and its bundled files — A/B/D/F, no adoption ranking. It reads the skill&rsquo;s text, not
            its runtime behavior, so it&rsquo;s a static read rather than behavioral proof. Read the{" "}
            <Link href="/methodology" className="border-b hairline border-dotted hover:text-oxblood">
              methodology
            </Link>
            .
          </p>
        </>
      )}
    </div>
  );
}
