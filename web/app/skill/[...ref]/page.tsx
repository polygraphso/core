/**
 * /skill/<github>/<owner>/<repo>/<subpath> — the per-skill grade report.
 *
 * The static counterpart to /mcp/<…>: where that page reports a server's
 * behavioral grade, this reports a Claude Code / Agent Skill's STATIC safety
 * grade from the skill litmus (litmus-skill-v2) — the S-01/S-03/S-04 breakdown,
 * the flagged findings behind a fail, the content hash the grade is anchored to,
 * and how to reproduce it. Read live from hosted_runs (grade-only, like /base).
 *
 * The catch-all ref is canonicalized to its `github/owner/repo#subpath` target
 * (see lib/skillGrades). An ungraded skill gets a short note, not a dead page.
 */

import { cache } from "react";
import type { Metadata } from "next";
import Link from "next/link";
import {
  decodeSkillRef,
  loadSkillGrade,
  skillRefToPath,
  githubUrlForSkillRef,
  skillDisplayName,
  SKILL_CATEGORIES,
  type SkillDetail,
  type SkillLitmusGrade,
  type SkillCategory,
  type SkillFinding,
} from "@/lib/skillGrades";
import { GRADE_HEX } from "@/lib/gradeColors";
import { getSupabaseAdmin } from "@/lib/supabase";
import { FixCta } from "@/app/_components/FixCta";

// generateMetadata and the page both need the grade; cache() collapses them to
// one query per request.
const getGrade = cache((target: string) => loadSkillGrade(getSupabaseAdmin(), target));

// A regrade surfaces within 10 min; the grade-only rows are otherwise stable.
export const revalidate = 600;

type Params = Promise<{ ref?: string[] }>;

/** Catch-all segments → canonical skill target, or null if unparseable. */
function targetFromParams(parts: string[] | undefined): string | null {
  if (!parts || parts.length === 0) return null;
  // Next hands catch-all segments percent-encoded to the render; decode each
  // back to its literal form before rejoining (a no-op when already decoded).
  let raw: string;
  try {
    raw = parts.map((s) => decodeURIComponent(s)).join("/");
  } catch {
    return null; // malformed percent-encoding in the path
  }
  return decodeSkillRef(raw);
}

/** Category status → color: pass green, fail oxblood, unrecorded neutral. */
function statusColor(status: string | null): string {
  if (status === "pass") return GRADE_HEX.A;
  if (!status) return "var(--color-ink-faint)";
  return "var(--color-oxblood)";
}

/**
 * Finding severity → accent. Keyed to severity, NOT the category verdict: a
 * sub-threshold finding noted on a passing check must never inherit the green
 * "pass" color and read as approval.
 */
function severityColor(severity: string | null): string {
  if (severity === "high") return "var(--color-oxblood)";
  if (severity === "medium") return "var(--color-terracotta)";
  return "var(--color-ink-faint)";
}

function shortHash(hash: string | null): string | null {
  if (!hash) return null;
  return hash.length <= 18 ? hash : `${hash.slice(0, 12)}…${hash.slice(-4)}`;
}

export async function generateMetadata({ params }: { params: Params }): Promise<Metadata> {
  const { ref } = await params;
  const target = targetFromParams(ref);
  if (!target) {
    return { title: "Skill grade", robots: { index: false, follow: true } };
  }
  const canonical = `/skill/${skillRefToPath(target)}`;
  const name = skillDisplayName(target);
  const result = await getGrade(target);
  if (result) {
    const title = `polygraph: ${name} — skill grade ${result.grade}`;
    return {
      title,
      description: `The ${name} skill scored ${result.grade} on the polygraph static skill litmus (${result.detail.methodology_version}). A reproducible, content-hash-anchored grade.`,
      alternates: { canonical },
      robots: { index: true, follow: true },
    };
  }
  return {
    title: `polygraph: ${name} — not yet graded`,
    description: `The ${name} skill hasn't been graded by polygraph yet.`,
    alternates: { canonical },
    robots: { index: false, follow: true },
  };
}

export default async function SkillReportPage({ params }: { params: Params }) {
  const { ref } = await params;
  const target = targetFromParams(ref);

  return (
    <main className="flex-1">
      <section className="mx-auto max-w-3xl px-6 pt-20 pb-24 md:pt-24 md:pb-32">
        <div className="border-t hairline pt-6 mb-10">
          <div className="flex items-baseline gap-4">
            <span className="section-label tabular">§ Skill</span>
            <span className="section-label">/</span>
            <span className="section-label">Static safety grade</span>
          </div>
        </div>

        {!target ? <Fallback /> : <Report target={target} />}
      </section>
    </main>
  );
}

async function Report({ target }: { target: string }) {
  const result = await getGrade(target);
  return result ? (
    <Graded target={target} grade={result.grade} detail={result.detail} />
  ) : (
    <Ungraded target={target} />
  );
}

function Graded({
  target,
  grade,
  detail,
}: {
  target: string;
  grade: SkillLitmusGrade;
  detail: SkillDetail;
}) {
  const name = skillDisplayName(target);
  const source = githubUrlForSkillRef(target);
  const hash = shortHash(detail.content_hash);
  const dated = detail.computed_at?.slice(0, 10) ?? null;

  return (
    <>
      <div className="flex items-start gap-6">
        <span
          className="font-serif text-7xl md:text-8xl leading-none shrink-0"
          style={{ color: GRADE_HEX[grade] }}
          aria-label={`Grade ${grade}`}
        >
          {grade}
        </span>
        <div className="min-w-0">
          <h1 className="font-mono text-lg md:text-xl text-ink break-words leading-snug">{name}</h1>
          <p className="mt-2 font-mono text-[11.5px] text-ink-faint leading-relaxed break-all">
            {target}
          </p>
          <p className="mt-2 font-mono text-[11.5px] text-ink-faint leading-relaxed">
            <Link
              href="/methodology"
              className="text-ink-muted border-b hairline border-dotted hover:text-oxblood transition-colors"
            >
              {detail.methodology_version}
            </Link>
            {dated ? <> · {dated}</> : null}
          </p>
        </div>
      </div>

      <p className="mt-6 max-w-xl text-[13.5px] text-ink-muted leading-relaxed">
        A <span className="text-ink">static</span>{" "}
        safety grade — a deterministic scan of the skill&rsquo;s{" "}
        <code className="font-mono text-[12.5px]">SKILL.md</code>{" "}
        and bundled files. An A means static-clean,{" "}
        <span className="text-ink">not behavioral proof</span>: a skill&rsquo;s
        instructions are interpreted by an agent at runtime.
      </p>

      {/* category breakdown */}
      <div className="mt-10 border-t hairline">
        {detail.categories.map((cat) => (
          <CategoryRow key={cat.code} cat={cat} />
        ))}
      </div>

      {hash ? (
        <p className="mt-3 font-mono text-[11px] text-ink-faint break-all">
          content hash · <span className="text-ink-muted">{hash}</span>
        </p>
      ) : null}

      {/* how to fix — only when there's something to fix (non-A) */}
      {grade !== "A" ? <FixCta target={target} kind="skill" /> : null}

      {/* source */}
      {source ? (
        <p className="mt-8 font-sans text-[13px] text-ink-muted leading-relaxed">
          Source ·{" "}
          <a
            href={source}
            target="_blank"
            rel="noreferrer noopener"
            className="text-ink border-b hairline border-dotted hover:text-oxblood transition-colors break-all"
          >
            {source.replace(/^https:\/\//, "")}
          </a>
        </p>
      ) : null}

      {/* reproduce — trust rests on re-runnability, not on a claim */}
      <div className="mt-12 border-t hairline pt-6">
        <h2 className="font-serif text-lg text-ink mb-2">Reproduce this grade</h2>
        <p className="font-sans text-[13px] text-ink-muted leading-relaxed max-w-xl">
          The skill litmus is open and deterministic. Point it at the skill directory and compare the
          grade and content hash — a false grade is{" "}
          <Link
            href="/methodology#reproducibility"
            className="text-ink border-b hairline border-dotted hover:text-oxblood transition-colors"
          >
            falsifiable, not merely disputable
          </Link>
          .
        </p>
        <pre className="mt-3 overflow-x-auto rounded-sm border hairline bg-parchment-50 px-4 py-3 font-mono text-[12.5px] text-ink">
          <code>npx -p @polygraphso/litmus polygraphso-litmus-skill &lt;skill-dir&gt;</code>
        </pre>
      </div>
    </>
  );
}

/** One S-0x row: status on the right, with the evidence that drove it underneath. */
function CategoryRow({ cat }: { cat: SkillCategory }) {
  const label = SKILL_CATEGORIES.find((c) => c.code === cat.code)?.name ?? "";
  return (
    <div className="border-b hairline py-3">
      <div className="flex items-baseline justify-between gap-4">
        <span className="font-mono text-[12px] text-ink-muted">
          <span className="text-ink-faint">{cat.code}</span> {label}
        </span>
        <span className="font-mono text-[12px] text-right" style={{ color: statusColor(cat.status) }}>
          {cat.status ?? "—"}
        </span>
      </div>
      {cat.reason ? (
        <p className="mt-1.5 font-mono text-[11px] text-ink-faint leading-relaxed">{cat.reason}</p>
      ) : null}
      {cat.findings.length > 0 ? (
        <ul className="mt-2.5 space-y-2 border-l-2 pl-4" style={{ borderColor: "var(--color-rule-soft)" }}>
          {cat.findings.map((f, i) => (
            <FindingChip key={i} finding={f} />
          ))}
        </ul>
      ) : null}
    </div>
  );
}

/**
 * One flagged location as a quoted evidence chip — the report's load-bearing
 * detail. The matched literal (or its bounded context window, for text findings)
 * reads as an artifact, not prose; severity, not the verdict, drives the accent.
 */
function FindingChip({ finding }: { finding: SkillFinding }) {
  // Command findings carry the literal in `match` + a file; text findings are
  // clearer shown with the surrounding context window the scan captured.
  const snippet = (finding.file ? finding.match : finding.context ?? finding.match)?.trim();
  return (
    <li className="rounded-sm border hairline bg-parchment-50 px-3 py-2">
      <div className="flex flex-wrap items-baseline gap-x-2 gap-y-0.5">
        <span
          className="font-mono text-[10px] uppercase tracking-[0.12em]"
          style={{ color: severityColor(finding.severity) }}
        >
          {finding.kind ?? "finding"}
        </span>
        {finding.severity ? (
          <span className="font-mono text-[10px] text-ink-faint">· {finding.severity}</span>
        ) : null}
        {finding.file ? (
          <span className="font-mono text-[10px] text-ink-faint break-all">· {finding.file}</span>
        ) : null}
      </div>
      {snippet ? (
        <code className="mt-1.5 block font-mono text-[11.5px] text-ink-muted break-all leading-relaxed">
          {snippet}
        </code>
      ) : null}
    </li>
  );
}

function Ungraded({ target }: { target: string }) {
  const name = skillDisplayName(target);
  const source = githubUrlForSkillRef(target);
  return (
    <>
      <h1 className="font-serif text-3xl md:text-4xl tracking-tight text-ink leading-[1.1] max-w-2xl">
        <span className="font-mono text-[0.7em] text-ink bg-parchment-200 px-1.5 py-0.5 align-baseline">
          {name}
        </span>{" "}
        hasn&rsquo;t been graded yet.
      </h1>

      <p className="mt-6 max-w-xl text-ink-muted leading-relaxed">
        No skill litmus has been run against{" "}
        <code className="font-mono text-[13px] text-ink-muted break-all">{target}</code>. Unevaluated
        is neither safe nor unsafe — it just means the static battery hasn&rsquo;t been run.
      </p>

      {source ? (
        <p className="mt-6 font-sans text-[13px] text-ink-muted leading-relaxed">
          Source ·{" "}
          <a
            href={source}
            target="_blank"
            rel="noreferrer noopener"
            className="text-ink border-b hairline border-dotted hover:text-oxblood transition-colors break-all"
          >
            {source.replace(/^https:\/\//, "")}
          </a>
        </p>
      ) : null}

      <div className="mt-12 border-t hairline pt-6">
        <h2 className="font-serif text-lg text-ink mb-2">Grade it yourself</h2>
        <p className="font-sans text-[13px] text-ink-muted leading-relaxed max-w-xl">
          The skill litmus is open. Point it at the skill directory to get the same A/B/D/F grade and
          content hash.
        </p>
        <pre className="mt-3 overflow-x-auto rounded-sm border hairline bg-parchment-50 px-4 py-3 font-mono text-[12.5px] text-ink">
          <code>npx -p @polygraphso/litmus polygraphso-litmus-skill &lt;skill-dir&gt;</code>
        </pre>
      </div>
    </>
  );
}

function Fallback() {
  return (
    <>
      <h1 className="font-serif text-3xl md:text-4xl tracking-tight text-ink leading-[1.1] max-w-2xl">
        This page expects a skill reference.
      </h1>
      <p className="mt-6 max-w-xl text-ink-muted leading-relaxed">
        Address a skill by its GitHub-prefixed ref in the path, for example:
      </p>
      <pre className="mt-6 border hairline bg-parchment-50 px-4 py-4 font-mono text-sm text-ink overflow-x-auto">
        <code>/skill/github/BankrBot/skills/base-account</code>
      </pre>
    </>
  );
}
