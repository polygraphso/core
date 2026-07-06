"use client";

import { useRef } from "react";
import { SectionHeader } from "./SectionHeader";
import { GRADE_VAR } from "@/lib/gradeColors";
import { skillDisplayName } from "@/lib/skillGrades";
import type { Run } from "./checksMapper";

/**
 * The card's primary name. Reads the real ref from the mapped rows (as the hero
 * card does) rather than `run.label`, since a run's displayLabel can be a regrade
 * batch tag (e.g. "c02-v10-019.1"), not the server/skill name.
 */
function primaryLabel(run: Run): string {
  if (run.category === "skill") {
    const ref = run.rows.find(([k]) => k === "skill")?.[1];
    return skillDisplayName(ref ?? run.label);
  }
  const target = run.rows.find(([k]) => k === "target")?.[1];
  return target ?? run.label.split(" — ")[0];
}

/** Short, human kind tag for the card corner. */
function kindTag(run: Run): string {
  if (run.category === "skill") return "Agent Skill";
  return run.kind === "live server" ? "Live endpoint" : "MCP server";
}

function GradeCard({ run }: { run: Run }) {
  const inner = (
    <>
      <div className="flex items-start justify-between gap-3">
        <span
          className="font-serif text-5xl leading-none"
          style={{ color: GRADE_VAR[run.grade] }}
          aria-label={`Grade ${run.grade}`}
        >
          {run.grade}
        </span>
        <span className="text-right font-mono text-[10px] uppercase tracking-[0.14em] text-ink-faint leading-relaxed">
          {kindTag(run)}
          <br />
          {run.methodologyVersion}
        </span>
      </div>

      <p className="mt-4 font-mono text-[12.5px] text-ink break-all leading-snug line-clamp-2">
        {primaryLabel(run)}
      </p>

      <p className="mt-2 flex-1 font-sans text-[12px] text-ink-muted leading-relaxed line-clamp-3">
        {run.rationale}
      </p>

      {run.href ? (
        <span className="mt-4 inline-block font-mono text-[11px] text-ink-faint border-b hairline border-dotted transition-colors group-hover:text-oxblood">
          View report →
        </span>
      ) : null}
    </>
  );

  const cardClass =
    "flex w-[280px] shrink-0 snap-start flex-col border hairline bg-parchment-50 p-4 transition-colors";

  return run.href ? (
    <a href={run.href} className={`group ${cardClass} hover:border-ink/30`}>
      {inner}
    </a>
  ) : (
    <div className={`group ${cardClass}`}>{inner}</div>
  );
}

/**
 * Homepage proof strip: the most-recently-published grades (MCP servers + skills),
 * newest first, in a horizontal scroll-snap track. Replaces the old interactive
 * "Completed checks" widget — lighter, and it links onward to the full index.
 * Keeps `id="checks"` so the hero's `#checks` anchor still resolves.
 */
export function RecentGradesCarousel({ runs }: { runs: Run[] }) {
  const trackRef = useRef<HTMLDivElement>(null);

  const scrollByCard = (dir: 1 | -1) => {
    // ~one card + gap; native smooth scroll degrades gracefully under reduced motion.
    trackRef.current?.scrollBy({ left: dir * 296, behavior: "smooth" });
  };

  return (
    <section
      id="checks"
      className="mx-auto max-w-6xl px-6 py-20 md:py-28 scroll-mt-12"
      aria-roledescription="carousel"
      aria-label="Recent grades"
    >
      <SectionHeader number="§ 02" label="Recent grades" title="Fresh from the harness.">
        The latest checks we&rsquo;ve published, newest first &mdash; each one a real litmus run you
        can reproduce. Browse every grade, MCP servers and skills, in the index.
      </SectionHeader>

      <div className="mb-5 flex items-center justify-between gap-4">
        <a
          href="/mcp-index"
          className="font-mono text-[12px] text-ink border-b hairline border-dotted hover:text-oxblood transition-colors"
        >
          See all grades →
        </a>
        {runs.length > 1 ? (
          <div className="hidden sm:flex items-center gap-2">
            <button
              type="button"
              aria-label="Scroll to previous grades"
              onClick={() => scrollByCard(-1)}
              className="border hairline px-2.5 py-1.5 font-mono text-[12px] text-ink-muted transition-colors hover:border-oxblood hover:text-oxblood"
            >
              ←
            </button>
            <button
              type="button"
              aria-label="Scroll to more grades"
              onClick={() => scrollByCard(1)}
              className="border hairline px-2.5 py-1.5 font-mono text-[12px] text-ink-muted transition-colors hover:border-oxblood hover:text-oxblood"
            >
              →
            </button>
          </div>
        ) : null}
      </div>

      {runs.length === 0 ? (
        <p className="border-t hairline py-8 font-mono text-[12px] text-ink-faint">
          No grades published yet. When we grade a server or a skill, it shows up here.
        </p>
      ) : (
        <div
          ref={trackRef}
          className="flex items-stretch snap-x snap-proximity gap-4 overflow-x-auto pb-3 [scrollbar-width:thin]"
        >
          {runs.map((run) => (
            <GradeCard key={run.id} run={run} />
          ))}
        </div>
      )}
    </section>
  );
}
