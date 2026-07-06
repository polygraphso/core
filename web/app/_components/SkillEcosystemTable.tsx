import type { ReactNode } from "react";
import Link from "next/link";
import { skillRefToPath } from "@/lib/skillGrades";
import { GRADE_HEX } from "@/lib/gradeColors";
import { EcosystemCta } from "@/app/_components/EcosystemCta";
import type { GradedSkill, SkillGrade } from "@/lib/skillEcosystem";

/**
 * Shared render for a skill-ecosystem index (/uniswap, /clawhub, /skills-sh) — the
 * config-driven twin of the bespoke /bankr skills table, so a new skill ecosystem is
 * a member list + this component rather than another ~200-line copy. Skill-only (no
 * agent section): the marketplaces these serve ship skills, not MCP servers.
 *
 * Purely presentational + server-safe (Link, GRADE_HEX, skillRefToPath). Grades arrive
 * already joined via lib/skillEcosystem#loadSkillCohort. /bankr is intentionally NOT
 * retrofitted onto this — it works and carries an agent section; leave it be.
 */

export interface SkillEcosystemConfig {
  /** Short methodology tag for the private-banner section label (e.g. "litmus-skill-v2"). */
  methodologyLabel: string;
  title: string;
  /** Italic serif subtitle under the H1. */
  blurb: string;
  /** Cohort keys in display order (must match the members' `cohort`). */
  cohortOrder: string[];
  cohortLabel: Record<string, string>;
  /** The bordered methodology / caveat block above the table. */
  methodologyNote: ReactNode;
  cta: { heading: string; body: string; mailtoSubject: string };
  /** The mono footer note (source links etc.). */
  footer: ReactNode;
}

const GRADE_ORDER: SkillGrade[] = ["A", "B", "D", "F"];
const FAIL = GRADE_HEX.F;
const PASS = GRADE_HEX.A;

function Stamp({ grade }: { grade: SkillGrade | null }) {
  if (!grade) {
    return (
      <span
        className="inline-flex h-8 w-8 items-center justify-center rounded-[3px] border hairline font-mono text-[13px] text-ink-faint"
        aria-label="ungraded"
      >
        —
      </span>
    );
  }
  return (
    <span
      className="inline-flex h-8 w-8 items-center justify-center rounded-[3px] font-mono text-[15px] font-semibold text-parchment-50 shadow-[inset_0_0_0_1px_rgba(255,255,255,0.14)]"
      style={{ backgroundColor: GRADE_HEX[grade] }}
      aria-label={`grade ${grade}`}
    >
      {grade}
    </span>
  );
}

function SCell({ status }: { status: string | null }) {
  if (!status) return <span className="font-mono text-[11px] text-ink-faint">·</span>;
  const fail = status === "fail";
  return (
    <span className={`font-mono text-[11px] ${fail ? "font-semibold" : ""}`} style={{ color: fail ? FAIL : PASS }}>
      {status}
    </span>
  );
}

const SCHECKS = "grid grid-cols-3 gap-x-3 text-center w-[9rem]";

function SkillRow({ s }: { s: GradedSkill }) {
  const name = (
    <Link href={`/skill/${skillRefToPath(s.target)}`} className="text-ink hover:text-oxblood transition-colors break-all">
      {s.name}
      {s.featured ? (
        <span className="ml-1.5 align-middle text-[10px] text-oxblood/70" title="featured">
          ★
        </span>
      ) : null}
    </Link>
  );
  return (
    <>
      <div className="hidden md:grid grid-cols-[2.75rem_minmax(150px,1fr)_9rem_5.5rem] items-center gap-x-5 px-3 py-2.5 border-t hairline transition-colors hover:bg-[#efe8d6]">
        <div>
          <Stamp grade={s.grade} />
        </div>
        <div className="min-w-0 font-mono text-[12px]">
          {name}
          {s.note ? <div className="mt-0.5 font-sans text-[10.5px] text-ink-faint leading-snug normal-case">{s.note}</div> : null}
        </div>
        <div className={SCHECKS}>
          <SCell status={s.s01} />
          <SCell status={s.s03} />
          <SCell status={s.s04} />
        </div>
        <div className="font-mono text-[10.5px] text-ink-faint tabular">{s.hash ? `${s.hash}…` : ""}</div>
      </div>
      <div className="md:hidden border-t hairline px-1 py-3">
        <div className="flex items-center gap-3">
          <Stamp grade={s.grade} />
          <div className="min-w-0 flex-1 font-mono text-[12px]">{name}</div>
        </div>
        {s.note ? <div className="mt-1 ml-11 font-sans text-[10.5px] text-ink-faint leading-snug">{s.note}</div> : null}
        <div className="mt-1.5 ml-11 font-mono text-[11px]">
          <span className="inline-flex gap-3">
            <span>S-01 <SCell status={s.s01} /></span>
            <span>S-03 <SCell status={s.s03} /></span>
            <span>S-04 <SCell status={s.s04} /></span>
          </span>
        </div>
      </div>
    </>
  );
}

export function SkillEcosystemTable({ config, skills }: { config: SkillEcosystemConfig; skills: GradedSkill[] }) {
  const counts = GRADE_ORDER.map((g) => ({ g, n: skills.filter((s) => s.grade === g).length })).filter((c) => c.n > 0);
  const graded = skills.filter((s) => s.grade).length;
  const featuredCount = skills.filter((s) => s.featured).length;

  return (
    <article>
      <header className="mb-9">
        <p className="section-label mb-4">Private · {config.methodologyLabel}</p>
        <h1 className="font-serif text-4xl md:text-5xl text-ink tracking-tight leading-[1.05]">{config.title}</h1>
        <p className="mt-5 font-serif italic text-ink-muted text-lg md:text-xl leading-snug max-w-2xl">{config.blurb}</p>
      </header>

      {/* Distribution strip */}
      <div className="mb-8 flex flex-wrap items-center gap-x-6 gap-y-3">
        <div className="flex h-2 w-44 overflow-hidden rounded-full border hairline">
          {counts.map(({ g, n }) => (
            <span key={g} style={{ backgroundColor: GRADE_HEX[g], flexGrow: n }} title={`${n} × ${g}`} />
          ))}
        </div>
        <div className="flex flex-wrap items-center gap-x-4 gap-y-1 font-mono text-[11px] text-ink-muted">
          {counts.map(({ g, n }) => (
            <span key={g} className="inline-flex items-center gap-1.5">
              <span className="inline-block h-2 w-2 rounded-[1px]" style={{ backgroundColor: GRADE_HEX[g] }} />
              {n}
              <span className="text-ink-faint">{g}</span>
            </span>
          ))}
          <span className="text-ink-faint">
            · {skills.length} skills · {graded} graded{featuredCount ? ` · ${featuredCount} featured` : ""}
          </span>
        </div>
      </div>

      {/* Methodology note */}
      <div
        className="mb-9 border-l-2 pl-5 text-[13px] leading-relaxed text-ink-muted max-w-2xl"
        style={{ borderColor: "var(--color-rule)" }}
      >
        {config.methodologyNote}
      </div>

      {/* Skill header row (desktop) */}
      <div className="hidden md:grid grid-cols-[2.75rem_minmax(150px,1fr)_9rem_5.5rem] items-center gap-x-5 px-3 pb-1 section-label">
        <div>Grade</div>
        <div>Skill</div>
        <div className="grid grid-cols-3 gap-x-3 text-center w-[9rem]">
          <span>S-01</span>
          <span>S-03</span>
          <span>S-04</span>
        </div>
        <div>Hash</div>
      </div>

      {config.cohortOrder.map((cohort) => {
        const rows = skills.filter((s) => s.cohort === cohort);
        if (rows.length === 0) return null;
        return (
          <div key={cohort}>
            <div className="section-label pt-7 pb-1 px-3">
              {config.cohortLabel[cohort] ?? cohort} <span className="text-ink-faint">· {rows.length}</span>
            </div>
            {rows.map((s) => (
              <SkillRow key={s.target} s={s} />
            ))}
          </div>
        );
      })}

      {/* Monitoring CTA */}
      <section className="mt-14 border-t hairline pt-8">
        <p className="section-label mb-5">Monitor this ecosystem</p>
        <EcosystemCta
          heading={config.cta.heading}
          body={config.cta.body}
          mailtoSubject={config.cta.mailtoSubject}
          secondaryHref="/mcp-index"
          secondaryLabel="See the full index"
        />
      </section>

      <p className="mt-9 font-mono text-[11px] text-ink-faint leading-relaxed border-t hairline pt-5">{config.footer}</p>
    </article>
  );
}
