import type { Metadata } from "next";
import Link from "next/link";
import {
  loadBankrSkills,
  loadBankrAgents,
  SKILL_COHORT_LABEL,
  SKILL_COHORT_ORDER,
  type BankrSkill,
  type BankrAgent,
  type SkillGrade,
} from "@/lib/bankrIndex";
import { refToPath } from "@/lib/badgeData";
import { skillRefToPath } from "@/lib/skillGrades";
import { GRADE_HEX } from "@/lib/gradeColors";
import { EcosystemCta } from "@/app/_components/EcosystemCta";

/**
 * UNLISTED Bankr ecosystem trust index. Not linked from nav/footer, not in any
 * sitemap, robots noindex — reachable only by direct link. Skills are graded by
 * the static skill litmus (litmus-skill-v2) and agent MCP servers behaviorally
 * (litmus-v8) — both read LIVE from hosted_runs per request, never hardcoded.
 */
export const metadata: Metadata = {
  title: "Bankr ecosystem — polygraph (private)",
  robots: { index: false, follow: false },
};

// Cache for 1 hour — grades update at most daily.
export const revalidate = 3600;

const GRADE_ORDER: SkillGrade[] = ["A", "B", "D", "F"];
const FAIL = GRADE_HEX.F;
const PASS = GRADE_HEX.A;

function Stamp({ grade }: { grade: keyof typeof GRADE_HEX | null }) {
  if (!grade) {
    return (
      <span className="inline-flex h-8 w-8 items-center justify-center rounded-[3px] border hairline font-mono text-[13px] text-ink-faint" aria-label="ungraded">—</span>
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

function SkillRow({ s }: { s: BankrSkill }) {
  // Link to the polygraph skill report (grade breakdown + findings + source); the
  // GitHub source link now lives on that page.
  const name = (
    <Link href={`/skill/${skillRefToPath(s.target)}`} className="text-ink hover:text-oxblood transition-colors break-all">
      {s.slug}
      {s.featured ? <span className="ml-1.5 align-middle text-[10px] text-oxblood/70" title="featured by Bankr">★</span> : null}
    </Link>
  );
  return (
    <>
      <div className="hidden md:grid grid-cols-[2.75rem_minmax(150px,1fr)_9rem_5.5rem] items-center gap-x-5 px-3 py-2.5 border-t hairline transition-colors hover:bg-[#efe8d6]">
        <div><Stamp grade={s.grade} /></div>
        <div className="min-w-0 font-mono text-[12px]">{name}</div>
        <div className={SCHECKS}><SCell status={s.s01} /><SCell status={s.s03} /><SCell status={s.s04} /></div>
        <div className="font-mono text-[10.5px] text-ink-faint tabular">{s.hash}…</div>
      </div>
      <div className="md:hidden border-t hairline px-1 py-3">
        <div className="flex items-center gap-3">
          <Stamp grade={s.grade} />
          <div className="min-w-0 flex-1 font-mono text-[12px]">{name}</div>
        </div>
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

function AgentRow({ a }: { a: BankrAgent }) {
  return (
    <div className="border-t hairline px-3 py-3">
      <div className="flex items-start gap-4">
        <div className="pt-0.5 shrink-0">
          {a.grade ? (
            <Stamp grade={a.grade} />
          ) : (
            <span className="inline-flex h-8 w-8 items-center justify-center rounded-[3px] border hairline font-mono text-[13px] text-ink-faint">—</span>
          )}
        </div>
        <div className="min-w-0">
          <a href={`https://x.com/${a.handle}`} target="_blank" rel="noreferrer noopener" className="text-ink hover:text-oxblood transition-colors">{a.project}</a>
          {a.target ? (
            <Link
              href={`/mcp/${refToPath(a.target)}`}
              className="ml-2 font-mono text-[11px] text-ink-muted break-all underline decoration-dotted underline-offset-2 hover:text-oxblood transition-colors"
            >
              {a.mcpRef}
            </Link>
          ) : (
            <span className="ml-2 font-mono text-[11px] text-ink-muted break-all">{a.mcpRef}</span>
          )}
          {a.grade ? (
            <span className="ml-3 font-mono text-[11px]">
              <span style={{ color: a.c01 === "pass" ? PASS : FAIL }}>C-01 {a.c01}</span>{" · "}
              <span style={{ color: a.c02 === "pass" ? PASS : FAIL }}>C-02 {a.c02}</span>{" · "}
              <span style={{ color: a.c03 === "pass" ? PASS : FAIL }}>C-03 {a.c03}</span>
            </span>
          ) : null}
          <div className="mt-1 font-mono text-[10.5px] text-ink-faint">{a.note}</div>
        </div>
      </div>
    </div>
  );
}

export default async function BankrIndexPage() {
  const [skills, agents] = await Promise.all([loadBankrSkills(), loadBankrAgents()]);
  const counts = GRADE_ORDER.map((g) => ({ g, n: skills.filter((s) => s.grade === g).length })).filter((c) => c.n > 0);
  const featuredCount = skills.filter((s) => s.featured).length;

  return (
      <article>
        <header className="mb-9">
          <p className="section-label mb-4">Private · litmus-skill-v2</p>
          <h1 className="font-serif text-4xl md:text-5xl text-ink tracking-tight leading-[1.05]">Bankr ecosystem</h1>
          <p className="mt-5 font-serif italic text-ink-muted text-lg md:text-xl leading-snug max-w-2xl">
            Static safety grades for the Bankr skill library, and behavioral grades for the agents that
            ship their own MCP server.
          </p>
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
                {n}<span className="text-ink-faint">{g}</span>
              </span>
            ))}
            <span className="text-ink-faint">· {skills.length} skills · {featuredCount} featured · {agents.length} agent MCP servers</span>
          </div>
        </div>

        {/* Methodology note */}
        <div className="mb-9 border-l-2 pl-5 text-[13px] leading-relaxed text-ink-muted max-w-2xl" style={{ borderColor: "var(--color-rule)" }}>
          <p>
            Each skill is graded by <strong className="text-ink">litmus-skill-v2</strong>, a
            deterministic STATIC scan of its{" "}
            <code className="font-mono text-[12px]">SKILL.md</code> + bundle:{" "}
            <strong className="text-ink">S-01</strong>{" "}
            prompt-injection / context-poisoning,{" "}
            <strong className="text-ink">S-03</strong>{" "}
            data-exfiltration instructions, and{" "}
            <strong className="text-ink">S-04</strong>{" "}
            dangerous bundled commands. An A means static-clean, not behavioral proof — a
            skill&rsquo;s instructions are interpreted by an agent at runtime.
          </p>
          <p className="mt-2 text-ink-faint">
            litmus-skill-v2 corrects the static scan&rsquo;s earlier over-flagging of <em>defensive</em>{" "}
            skills — a security-scanner that documents &ldquo;ignore previous instructions&rdquo;, or onboarding
            text mentioning an API key, no longer reads as injection/exfil. The only flagged skill is{" "}
            <strong className="text-ink-muted">gitlawb (D)</strong>, a real finding (a bundled{" "}
            <code className="font-mono">curl | sh</code> installer). Every grade here is read live from its
            hosted_runs row — reproduce any of them with{" "}
            <code className="font-mono">npx -p @polygraphso/litmus polygraphso-litmus-skill</code> — and none are
            published onchain.
          </p>
        </div>

        {/* Skill header row (desktop) */}
        <div className="hidden md:grid grid-cols-[2.75rem_minmax(150px,1fr)_9rem_5.5rem] items-center gap-x-5 px-3 pb-1 section-label">
          <div>Grade</div>
          <div>Skill</div>
          <div className="grid grid-cols-3 gap-x-3 text-center w-[9rem]"><span>S-01</span><span>S-03</span><span>S-04</span></div>
          <div>Hash</div>
        </div>

        {SKILL_COHORT_ORDER.map((cohort) => {
          const rows = skills.filter((s) => s.cohort === cohort);
          if (rows.length === 0) return null;
          return (
            <div key={cohort}>
              <div className="section-label pt-7 pb-1 px-3">{SKILL_COHORT_LABEL[cohort]} <span className="text-ink-faint">· {rows.length}</span></div>
              {rows.map((s) => <SkillRow key={s.slug} s={s} />)}
            </div>
          );
        })}

        {/* Agent MCP servers */}
        <div className="section-label pt-9 pb-1 px-3">Agent MCP servers <span className="text-ink-faint">· {agents.length}</span></div>
        {agents.map((a) => <AgentRow key={a.project} a={a} />)}

        {/* Monitoring CTA — this index is the live proof; the ask is to keep it live. */}
        <section className="mt-14 border-t hairline pt-8">
          <p className="section-label mb-5">Monitor this ecosystem</p>
          <EcosystemCta
            heading="Monitor the Bankr skill marketplace."
            body="This index is a snapshot. We re-grade Bankr's skills and agent MCP servers on a cadence and flag regressions — a dropped grade, a newly failing check, a changed tool surface — as the marketplace ships. Set up per network."
            mailtoSubject="Monitor the Bankr ecosystem with polygraph"
            secondaryHref="/mcp-index"
            secondaryLabel="See the full index"
          />
        </section>

        <p className="mt-9 font-mono text-[11px] text-ink-faint leading-relaxed border-t hairline pt-5">
          Skills: S-01 prompt-injection · S-03 exfil instructions · S-04 dangerous bundled commands (static,
          content-hash anchored). Reproduce a skill grade with{" "}
          <code className="font-mono">npx -p @polygraphso/litmus polygraphso-litmus-skill &lt;dir&gt;</code>.
          Agents: behavioral C-01…C-04 on the open harness. Source:{" "}
          <Link href="https://github.com/BankrBot/skills" className="underline decoration-dotted underline-offset-2 hover:text-oxblood transition-colors">
            BankrBot/skills
          </Link>{" "}
          · <Link href="https://bankr.bot/agents" className="underline decoration-dotted underline-offset-2 hover:text-oxblood transition-colors">bankr.bot/agents</Link>.
        </p>
      </article>
  );
}
