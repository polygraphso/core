/**
 * /fix — grade-specific remediation. Reached from the "How to fix this" CTA on a
 * non-A skill (/skill/<…>) or server (/mcp/<…>) report, carrying the target in
 * `?for=<key>` and `&kind=mcp|skill`.
 *
 * It loads the SAME published grade the report shows, turns its failing checks +
 * findings into concrete fixes (lib/remediation), and lists them — so an owner
 * knows exactly what to change to raise the grade. Free + public; nothing here
 * isn't already in the public evidence bundle. Unlisted (noindex), like /notify.
 */

import type { Metadata } from "next";
import Link from "next/link";
import { decodeRef, loadGrade, refToPath } from "@/lib/badgeData";
import {
  decodeSkillRef,
  loadSkillGrade,
  skillRefToPath,
  skillDisplayName,
} from "@/lib/skillGrades";
import { getSupabaseAdmin } from "@/lib/supabase";
import { GRADE_HEX } from "@/lib/gradeColors";
import type { LitmusGrade } from "@/lib/hostedGrades";
import { mcpFixItems, skillFixItems, type FixItem } from "@/lib/remediation";
import { BackButton } from "./_components/BackButton";

export const metadata: Metadata = {
  title: "How to fix a polygraph grade",
  description: "The specific, reproducible changes that clear a flagged polygraph grade.",
  alternates: { canonical: "/fix" },
  robots: { index: false, follow: true },
};

type SearchParams = Promise<{ [key: string]: string | string[] | undefined }>;

function first(v: string | string[] | undefined): string | undefined {
  return Array.isArray(v) ? v[0] : v;
}

/** Finding severity → accent (same scale as the report's FindingChip). An item
 *  with no severity (a category fallback or the egress-unverified note) reads as
 *  advisory terracotta, never the green of a pass. */
function accentFor(severity: string | undefined): string {
  if (severity === "high") return "var(--color-oxblood)";
  if (severity === "medium" || !severity) return "var(--color-terracotta)";
  return "var(--color-ink-faint)";
}

export default async function FixPage({ searchParams }: { searchParams: SearchParams }) {
  const params = await searchParams;
  const rawFor = first(params.for);
  const target = rawFor && rawFor.length <= 512 ? rawFor : null;
  const rawKind = first(params.kind);
  // Trust the CTA's discriminator; for a direct/legacy link, infer from the ref
  // shape (a skill ref is `github/owner/repo…`, a server key never is).
  const kind: "mcp" | "skill" =
    rawKind === "skill" || rawKind === "mcp"
      ? rawKind
      : target?.startsWith("github/")
        ? "skill"
        : "mcp";

  return (
      <section className="mx-auto max-w-3xl">
        <div className="border-t hairline pt-6 mb-10">
          <div className="flex items-baseline gap-4">
            <span className="section-label tabular">§ Fix</span>
            <span className="section-label">/</span>
            <span className="section-label">Remediation</span>
          </div>
        </div>

        {!target ? <NoTarget /> : kind === "skill" ? <SkillFix target={target} /> : <McpFix target={target} />}
      </section>
  );
}

async function McpFix({ target }: { target: string }) {
  const key = decodeRef(target) ?? target;
  const reportHref = `/mcp/${refToPath(key)}`;
  const reproduce = <McpReproduce serverKey={key} />;
  const result = await loadGrade(key);
  if (!result) return <NoGrade label={key} reportHref={reportHref} reproduce={reproduce} />;

  const { detail } = result;
  return (
    <FixView
      grade={result.grade}
      name={key}
      meta={
        <>
          {detail.resolved_version ? (
            <>
              graded version <span className="text-ink-muted">{detail.resolved_version}</span> ·{" "}
            </>
          ) : null}
          {detail.methodology_version}
          {detail.computed_at ? <> · {detail.computed_at.slice(0, 10)}</> : null}
        </>
      }
      reportHref={reportHref}
      items={mcpFixItems(detail)}
      reproduce={reproduce}
    />
  );
}

async function SkillFix({ target }: { target: string }) {
  const skillTarget = decodeSkillRef(target) ?? target;
  const reportHref = `/skill/${skillRefToPath(skillTarget)}`;
  const reproduce = <SkillReproduce />;
  const result = await loadSkillGrade(getSupabaseAdmin(), skillTarget);
  if (!result)
    return <NoGrade label={skillDisplayName(skillTarget)} reportHref={reportHref} reproduce={reproduce} />;

  const { detail } = result;
  return (
    <FixView
      grade={result.grade}
      name={skillDisplayName(skillTarget)}
      sub={skillTarget}
      meta={
        <>
          {detail.methodology_version}
          {detail.computed_at ? <> · {detail.computed_at.slice(0, 10)}</> : null}
        </>
      }
      reportHref={reportHref}
      items={skillFixItems(detail)}
      reproduce={reproduce}
    />
  );
}

function FixView({
  grade,
  name,
  sub,
  meta,
  reportHref,
  items,
  reproduce,
}: {
  grade: LitmusGrade;
  name: string;
  sub?: string;
  meta: React.ReactNode;
  reportHref: string;
  items: FixItem[];
  reproduce: React.ReactNode;
}) {
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
          {sub ? (
            <p className="mt-2 font-mono text-[11.5px] text-ink-faint leading-relaxed break-all">{sub}</p>
          ) : null}
          <p className="mt-2 font-mono text-[11.5px] text-ink-faint leading-relaxed">{meta}</p>
        </div>
      </div>

      {grade === "A" || items.length === 0 ? (
        <p className="mt-8 max-w-xl text-ink-muted leading-relaxed">
          {grade === "A" ? (
            <>
              This already grades <span className="text-ink">A</span> — there&rsquo;s nothing to fix.
            </>
          ) : (
            <>Nothing actionable was recorded against this grade.</>
          )}{" "}
          See the{" "}
          <Link
            href={reportHref}
            className="text-ink border-b hairline border-dotted hover:text-oxblood transition-colors"
          >
            full report
          </Link>{" "}
          for the evidence behind it.
        </p>
      ) : (
        <>
          <p className="mt-8 max-w-xl text-ink-muted leading-relaxed">
            The changes below clear what held this to a{" "}
            <span className="text-ink">{grade}</span>. Each is a concrete edit; re-run the litmus
            after to confirm the grade moves. See the{" "}
            <Link
              href={reportHref}
              className="text-ink border-b hairline border-dotted hover:text-oxblood transition-colors"
            >
              full report
            </Link>{" "}
            for the matched evidence.
          </p>

          <ul className="mt-10 border-t hairline">
            {items.map((item, i) => (
              <FixBlock key={`${item.categoryCode}-${i}`} item={item} />
            ))}
          </ul>
        </>
      )}

      {/* re-grade — the fix only counts if the litmus agrees */}
      <div className="mt-12 border-t hairline pt-6">
        <h2 className="font-serif text-lg text-ink mb-2">Confirm the fix</h2>
        <p className="font-sans text-[13px] text-ink-muted leading-relaxed max-w-xl">
          The harness is open and deterministic. Re-run it after your change and watch the grade and
          fingerprint move — the same run anyone else can{" "}
          <Link
            href="/methodology#reproducibility"
            className="text-ink border-b hairline border-dotted hover:text-oxblood transition-colors"
          >
            reproduce
          </Link>
          .
        </p>
        {reproduce}
      </div>

      <div className="mt-10">
        <BackButton />
      </div>
    </>
  );
}

/** One remediation: the check + severity, the problem, the fix, and the locus /
 *  evidence the report flagged. */
function FixBlock({ item }: { item: FixItem }) {
  return (
    <li className="border-b hairline py-6">
      <div className="flex flex-wrap items-baseline gap-x-2 gap-y-0.5">
        <span
          className="font-mono text-[11px] uppercase tracking-[0.12em]"
          style={{ color: accentFor(item.severity) }}
        >
          {item.categoryCode}
        </span>
        <span className="font-mono text-[11px] text-ink-faint">{item.categoryName}</span>
        {item.severity ? (
          <span className="font-mono text-[10px] text-ink-faint">· {item.severity}</span>
        ) : null}
      </div>

      <h3 className="mt-2 font-serif text-lg text-ink leading-snug">{item.title}</h3>
      <p className="mt-2 font-sans text-[13.5px] text-ink-muted leading-relaxed max-w-xl">
        {item.problem}
      </p>
      <p className="mt-3 font-sans text-[13.5px] text-ink leading-relaxed max-w-xl">
        <span className="font-mono text-[11px] uppercase tracking-[0.14em] text-oxblood">Fix:</span>{" "}
        {item.fix}
      </p>

      {item.locus ? (
        <p className="mt-3 font-mono text-[11px] text-ink-faint break-all">
          at <span className="text-ink-muted">{item.locus}</span>
        </p>
      ) : null}
      {item.evidence ? (
        <code className="mt-2 block rounded-sm border hairline bg-parchment-50 px-3 py-2 font-mono text-[11.5px] text-ink-muted break-all leading-relaxed">
          {item.evidence}
        </code>
      ) : null}
    </li>
  );
}

function McpReproduce({ serverKey }: { serverKey: string }) {
  return (
    <pre className="mt-3 overflow-x-auto rounded-sm border hairline bg-parchment-50 px-4 py-3 font-mono text-[12.5px] text-ink">
      <code>npx -p @polygraphso/litmus polygraphso-litmus {serverKey}</code>
    </pre>
  );
}

function SkillReproduce() {
  return (
    <pre className="mt-3 overflow-x-auto rounded-sm border hairline bg-parchment-50 px-4 py-3 font-mono text-[12.5px] text-ink">
      <code>npx -p @polygraphso/litmus polygraphso-litmus-skill &lt;skill-dir&gt;</code>
    </pre>
  );
}

/** Grade not found for the target (or Supabase unconfigured) — point at the
 *  report (its ungraded state offers the grade-it funnel) and offer to run it. */
function NoGrade({
  label,
  reportHref,
  reproduce,
}: {
  label: string;
  reportHref: string;
  reproduce: React.ReactNode;
}) {
  return (
    <>
      <h1 className="font-serif text-3xl md:text-4xl tracking-tight text-ink leading-[1.1] max-w-2xl">
        No published grade to fix yet.
      </h1>
      <p className="mt-5 font-mono text-[12px] text-ink-faint break-all">
        for <span className="text-ink-muted">{label}</span>
      </p>
      <p className="mt-6 max-w-xl text-ink-muted leading-relaxed">
        There&rsquo;s no published polygraph for this target, so there&rsquo;s nothing to remediate
        against. Grade it first — then this page will tell you what to change. See its{" "}
        <Link
          href={reportHref}
          className="text-ink border-b hairline border-dotted hover:text-oxblood transition-colors"
        >
          report
        </Link>
        .
      </p>

      <div className="mt-12 border-t hairline pt-6">
        <h2 className="font-serif text-lg text-ink mb-2">Grade it yourself</h2>
        <p className="font-sans text-[13px] text-ink-muted leading-relaxed max-w-xl">
          The litmus is open. Run it to get the A/B/D/F grade and the evidence behind it.
        </p>
        {reproduce}
      </div>

      <div className="mt-10">
        <BackButton />
      </div>
    </>
  );
}

/** No `?for=` — direct hit. Explain the entry point rather than dead-end. */
function NoTarget() {
  return (
    <>
      <h1 className="font-serif text-3xl md:text-4xl tracking-tight text-ink leading-[1.1] max-w-2xl">
        Remediation is per target.
      </h1>
      <p className="mt-6 max-w-xl text-ink-muted leading-relaxed">
        This page turns a flagged grade into the specific changes that clear it. Reach it from the{" "}
        <span className="font-mono text-[13px] text-ink">How to fix this</span> link on any non-A
        server or skill report — for example a{" "}
        <Link
          href="/mcp-index"
          className="text-ink border-b hairline border-dotted hover:text-oxblood transition-colors"
        >
          ranked server
        </Link>
        .
      </p>

      <div className="mt-8">
        <BackButton />
      </div>
    </>
  );
}
