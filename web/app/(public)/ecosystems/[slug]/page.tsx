/**
 * /ecosystems/[slug] — the public page for a DB-backed ecosystem. Renders the
 * VISIBLE entries a member curated, joined to their live grades, grouped by cohort.
 * The bespoke legacy indices keep their own top-level pages, so this redirects the
 * six legacy slugs to their canonical URL; new (self-serve) ecosystems live here.
 */

import type { Metadata } from "next";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { getEcosystemBySlug, loadGradedEntries } from "@/lib/ecosystemData";
import { buildEntryVMs } from "@/lib/ecosystemViewModel";
import { isLegacyEcosystemSlug } from "@/lib/ecosystemTypes";
import type { EcosystemEntryVM } from "@/lib/ecosystemTypes";
import { GRADE_HEX } from "@/lib/gradeColors";
import { EcosystemCta } from "@/app/_components/EcosystemCta";

export const revalidate = 300;

const GRADE_ORDER = ["A", "B", "C", "D", "F"];

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const { slug } = await params;
  const ecosystem = await getEcosystemBySlug(slug);
  if (!ecosystem) return { title: "Ecosystem · polygraph" };
  return {
    title: `${ecosystem.name} · polygraph`,
    description: ecosystem.blurb ?? undefined,
    robots: ecosystem.noindex ? { index: false, follow: false } : undefined,
  };
}

function Stamp({ grade }: { grade: string | null }) {
  if (!grade) {
    return (
      <span className="inline-flex h-8 w-8 items-center justify-center rounded-[3px] border hairline font-mono text-[13px] text-ink-faint" aria-label="ungraded">
        —
      </span>
    );
  }
  return (
    <span
      className="inline-flex h-8 w-8 items-center justify-center rounded-[3px] font-mono text-[15px] font-semibold text-parchment-50 shadow-[inset_0_0_0_1px_rgba(255,255,255,0.14)]"
      style={{ backgroundColor: GRADE_HEX[grade as keyof typeof GRADE_HEX] ?? "var(--color-ink-faint)" }}
      aria-label={`grade ${grade}`}
    >
      {grade}
    </span>
  );
}

function Check({ code, status }: { code: string; status: string | null }) {
  const fail = status && !status.startsWith("skip") && status !== "pass";
  const color = status === "pass" ? GRADE_HEX.A : !status || status.startsWith("skip") ? "var(--color-ink-faint)" : GRADE_HEX.F;
  const label = !status ? "—" : status.startsWith("skip") ? "skip" : status;
  return (
    <span className="font-mono text-[10px]">
      <span className="text-ink-faint">{code}</span>{" "}
      <span className={fail ? "font-semibold" : ""} style={{ color }}>{label}</span>
    </span>
  );
}

function EntryLine({ vm }: { vm: EcosystemEntryVM }) {
  const name = vm.reportPath ? (
    <Link href={vm.reportPath} className="text-ink hover:text-oxblood transition-colors">{vm.name}</Link>
  ) : (
    <span className="text-ink">{vm.name}</span>
  );
  return (
    <div className="flex items-start gap-3 border-t hairline px-1 py-3">
      <Stamp grade={vm.grade} />
      <div className="min-w-0 flex-1">
        <div className="flex items-baseline gap-2">
          <span className="font-medium truncate">{name}</span>
          {vm.featured ? <span className="text-oxblood text-[13px]" title="featured">★</span> : null}
          <span className="font-mono text-[10px] uppercase tracking-[0.12em] text-ink-faint">
            {vm.targetKind === "skill" ? "skill" : "mcp"}
          </span>
        </div>
        {vm.target ? <code className="font-mono text-[11px] text-ink-muted break-all">{vm.target}</code> : null}
        {vm.grade ? (
          <div className="mt-1.5 flex flex-wrap gap-x-3 gap-y-1">
            {vm.checks.map((c) => <Check key={c.code} code={c.code} status={c.status} />)}
          </div>
        ) : (
          <div className="mt-1 font-mono text-[11px] text-ink-faint">grade pending</div>
        )}
      </div>
      <div className="shrink-0 font-mono text-[10.5px] text-ink-faint tabular">
        {vm.completedAt ? vm.completedAt.slice(0, 10) : ""}
      </div>
    </div>
  );
}

export default async function GenericEcosystemPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  if (isLegacyEcosystemSlug(slug)) redirect(`/${slug}`);

  const ecosystem = await getEcosystemBySlug(slug);
  if (!ecosystem || !ecosystem.is_public) notFound();

  const entries = buildEntryVMs(await loadGradedEntries(ecosystem.id, { visibleOnly: true }));
  const cfg = ecosystem.page_config ?? {};

  // Cohort order: configured order first, then any remaining cohorts in first-seen
  // order, with the uncohorted bucket ("") last.
  const seen: string[] = [];
  for (const e of entries) {
    const key = e.cohort ?? "";
    if (!seen.includes(key)) seen.push(key);
  }
  const ordered = [
    ...(cfg.cohortOrder ?? []).filter((c) => seen.includes(c)),
    ...seen.filter((c) => c && !(cfg.cohortOrder ?? []).includes(c)),
    ...(seen.includes("") ? [""] : []),
  ];
  const label = (c: string) => cfg.cohortLabel?.[c] ?? (c || "Servers & skills");

  const graded = entries.filter((e) => e.grade);
  const counts = GRADE_ORDER.map((g) => ({ g, n: graded.filter((e) => e.grade === g).length })).filter((c) => c.n > 0);

  return (
    <article>
      <header className="mb-9">
        <p className="section-label mb-4">
          Ecosystem index{cfg.methodologyLabel ? ` · ${cfg.methodologyLabel}` : ""}
        </p>
        <h1 className="font-serif text-4xl md:text-5xl text-ink tracking-tight leading-[1.05]">{ecosystem.name}</h1>
        {ecosystem.blurb ? (
          <p className="mt-5 font-serif italic text-ink-muted text-lg md:text-xl leading-snug max-w-2xl">
            {ecosystem.blurb}
          </p>
        ) : null}
      </header>

      {counts.length > 0 ? (
        <div className="mb-8 flex flex-wrap items-center gap-x-6 gap-y-3">
          <div className="flex h-2 w-44 overflow-hidden rounded-full border hairline">
            {counts.map(({ g, n }) => (
              <span key={g} style={{ backgroundColor: GRADE_HEX[g as keyof typeof GRADE_HEX], flexGrow: n }} title={`${n} × ${g}`} />
            ))}
          </div>
          <div className="flex flex-wrap items-center gap-x-4 gap-y-1 font-mono text-[11px] text-ink-muted">
            {counts.map(({ g, n }) => (
              <span key={g} className="inline-flex items-center gap-1.5">
                <span className="inline-block h-2 w-2 rounded-[1px]" style={{ backgroundColor: GRADE_HEX[g as keyof typeof GRADE_HEX] }} />
                {n}<span className="text-ink-faint">{g}</span>
              </span>
            ))}
            <span className="text-ink-faint">· {graded.length} graded · {entries.length} tracked</span>
          </div>
        </div>
      ) : null}

      {cfg.methodologyNote ? (
        <figure className="mb-9 border-l-2 pl-5" style={{ borderColor: "var(--color-oxblood)" }}>
          <blockquote className="font-serif text-ink text-base md:text-lg leading-snug">{cfg.methodologyNote}</blockquote>
        </figure>
      ) : null}

      {entries.length === 0 ? (
        <p className="text-ink-muted py-6">Nothing graded here yet.</p>
      ) : (
        ordered.map((c) => {
          const rows = entries.filter((e) => (e.cohort ?? "") === c);
          if (rows.length === 0) return null;
          return (
            <section key={c || "_"}>
              <div className="section-label pt-7 pb-1 px-1">
                {label(c)} <span className="text-ink-faint">· {rows.length}</span>
              </div>
              {rows.map((vm) => <EntryLine key={vm.id} vm={vm} />)}
            </section>
          );
        })
      )}

      <section className="mt-14 border-t hairline pt-8">
        <p className="section-label mb-5">Monitor this ecosystem</p>
        <EcosystemCta
          heading={cfg.cta?.heading ?? `Monitor the ${ecosystem.name} ecosystem.`}
          body={
            cfg.cta?.body ??
            "This index is a snapshot. We re-grade these servers and skills on a cadence and flag regressions — a dropped grade, a newly failing probe, a changed tool surface — before they reach your users."
          }
          mailtoSubject={cfg.cta?.mailtoSubject ?? `Monitor the ${ecosystem.name} ecosystem with polygraph`}
          secondaryHref="/mcp-index"
          secondaryLabel="See the full index"
        />
      </section>

      {cfg.footer ? (
        <p className="mt-9 font-mono text-[11px] text-ink-faint leading-relaxed border-t hairline pt-5">{cfg.footer}</p>
      ) : null}
    </article>
  );
}
