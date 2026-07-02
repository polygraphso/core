import type { Metadata } from "next";
import Link from "next/link";
import { ECOSYSTEMS, type EcosystemStats } from "@/lib/ecosystems";
import { GRADE_HEX } from "@/lib/gradeColors";
import { SectionHeader } from "@/app/_components/SectionHeader";
import { EcosystemCta } from "@/app/_components/EcosystemCta";

/**
 * UNLISTED ecosystems hub. Not linked from nav/footer, not in any sitemap,
 * robots noindex — reachable only by direct link, matching the /base and /bankr
 * pages it points to. Pitched as an operator-facing deck: it sells continuous
 * monitoring of a network's MCP servers + skills, anchored on the live indexes
 * it links to. Each card's stats are read LIVE from those pages' own loaders
 * (see lib/ecosystems), so a card never drifts from its destination.
 *
 * Honesty note: daily re-grading, grade-change detection, and dev alerts are
 * the OFFERING — set up per network when an ecosystem signs on, not automation
 * already running for everyone. Copy here describes the engagement; it never
 * claims live automation or invents metrics. See core/CLAUDE.md.
 */
export const metadata: Metadata = {
  title: "Ecosystems — polygraph (private)",
  robots: { index: false, follow: false },
};

// Stats come from the live hosted_runs loaders; render per-request like /base & /bankr.
export const dynamic = "force-dynamic";

/** The grade-distribution strip — bar + legend, lifted from /base so every
 *  ecosystem surface reads the same. */
function Distribution({ stats }: { stats: EcosystemStats }) {
  if (stats.counts.length === 0) {
    return <span className="font-mono text-[11px] text-ink-faint">no grades yet</span>;
  }
  return (
    <div className="flex flex-wrap items-center gap-x-5 gap-y-2">
      <div className="flex h-2 w-40 overflow-hidden rounded-full border hairline">
        {stats.counts.map(({ g, n }) => (
          <span key={g} style={{ backgroundColor: GRADE_HEX[g], flexGrow: n }} title={`${n} × ${g}`} />
        ))}
      </div>
      <div className="flex flex-wrap items-center gap-x-3 gap-y-1 font-mono text-[11px] text-ink-muted">
        {stats.counts.map(({ g, n }) => (
          <span key={g} className="inline-flex items-center gap-1.5">
            <span className="inline-block h-2 w-2 rounded-[1px]" style={{ backgroundColor: GRADE_HEX[g] }} />
            {n}
            <span className="text-ink-faint">{g}</span>
          </span>
        ))}
      </div>
    </div>
  );
}

/** The monitoring engagement, step by step. Framed as the offering — the same
 *  open harness, on a clock, wired up per network. */
const STEPS = [
  {
    n: "01",
    title: "Re-grade",
    body: "We re-run the harness against every server and skill in a network's index on a set schedule — the same behavioral test, repeated. Not a one-time snapshot.",
  },
  {
    n: "02",
    title: "Detect",
    body: "Each run is compared against the prior grade. A drop, a newly failing probe, or a changed tool surface — a sha256 fingerprint mismatch, the signature of a rug pull — is flagged against what graded before.",
  },
  {
    n: "03",
    title: "Alert",
    body: "Your team hears about a regression before your users do, with the evidence bundle attached.",
  },
];

/** What a paying monitoring client does — and doesn't — get to change. */
const HOLDS = [
  {
    label: "Reproducible",
    body: "The harness is open and deterministic. Re-run it against the same ref and you get the same grade — a drop is something you can check, not take on faith.",
  },
  {
    label: "Independent",
    body: "Nobody can pay for a grade. A monitoring engagement changes what we re-grade and how often — never the letter we publish.",
  },
  {
    label: "Rug-pull-aware",
    body: "Every grade is pinned to a sha256 fingerprint of the tool surface. Change the surface and the grade goes stale on its own — that recheck is what makes “monitored” mean something.",
  },
];

export default async function EcosystemsPage() {
  const stats = await Promise.all(ECOSYSTEMS.map((e) => e.loadStats()));
  const totalGraded = stats.reduce((sum, s) => sum + s.graded, 0);

  return (
    <main className="flex-1">
      <article className="mx-auto max-w-4xl px-6 pt-14 pb-24 md:pt-20 md:pb-28">
        {/* Hero — the hook: a grade decays, so we keep grading. */}
        <header className="mb-12">
          <p className="section-label mb-4">Private · ecosystems</p>
          <h1 className="font-serif text-4xl md:text-5xl text-ink tracking-tight leading-[1.05]">
            Grades are snapshots. Tools keep shipping.
          </h1>
          <p className="mt-5 font-serif italic text-ink-muted text-lg md:text-xl leading-snug max-w-2xl">
            Your network ships MCP servers and skills you don&rsquo;t fully control — a new release, a
            quiet regression, a swapped tool surface. We keep an independent, reproducible trust index
            for the network and re-grade it on a cadence, so the grade you shipped on doesn&rsquo;t go
            stale on you.
          </p>
        </header>

        {/* § 01 — Proof first: the live indexes. */}
        <section className="mb-16">
          <SectionHeader number="§ 01" label="Live indexes" title="What a trust index looks like.">
            Every grade below is read live from the same evidence the per-network pages show —
            current, reproducible, and yours to re-run against the open harness.
          </SectionHeader>

          <p className="mb-5 font-mono text-[11px] uppercase tracking-[0.16em] text-ink-faint">
            {totalGraded} live grades · {ECOSYSTEMS.length} networks
          </p>

          <div className="grid gap-4 md:grid-cols-2">
            {ECOSYSTEMS.map((e, i) => (
              <Link
                key={e.slug}
                href={e.href}
                className="group flex min-w-0 flex-col rounded-[5px] border hairline bg-parchment-50 px-5 py-5 transition-colors hover:bg-[#efe8d6]"
              >
                <h2 className="font-serif text-2xl text-ink tracking-tight">{e.name}</h2>
                <p className="mt-2 text-[13px] leading-relaxed text-ink-muted">{e.blurb}</p>
                <div className="mt-4">
                  <Distribution stats={stats[i]} />
                </div>
                <div className="mt-4 flex items-center justify-between gap-3 font-mono text-[11px] text-ink-faint">
                  <span className="min-w-0 truncate">{stats[i].summary}</span>
                  <span className="shrink-0 text-ink-muted group-hover:text-oxblood transition-colors">
                    View ecosystem →
                  </span>
                </div>
              </Link>
            ))}
          </div>
        </section>

        {/* § 02 — Why continuous: the snapshot-goes-stale argument. */}
        <section className="mb-16">
          <SectionHeader
            number="§ 02"
            label="Why continuous"
            title="An index is only as good as its last run."
          >
            A behavioral grade describes a tool on the day it ran. Then the tool changes — and a
            stale A is worse than no grade, because someone is trusting it.
          </SectionHeader>

          <figure className="border-l-2 pl-5" style={{ borderColor: "var(--color-oxblood)" }}>
            <blockquote className="font-serif text-ink text-lg md:text-xl leading-snug">
              A grade is a measurement, and measurements have a date.{" "}
              <span className="text-oxblood">The tool it describes won&rsquo;t hold still.</span>
            </blockquote>
            <figcaption className="mt-3 text-[13px] leading-relaxed text-ink-muted max-w-2xl">
              Third-party servers and skills get new releases and new owners, and a tool surface can
              change after grading — which is exactly how a rug pull works. None of that shows up in a
              grade you ran once. Re-running the same test, again and again, is the only thing that
              keeps an index honest.
            </figcaption>
          </figure>
        </section>

        {/* § 03 — How monitoring works: the offering, step by step. */}
        <section className="mb-16">
          <SectionHeader
            number="§ 03"
            label="How monitoring works"
            title="Re-grade, detect, alert."
          >
            The same open harness, on a clock — set up per network when an ecosystem signs on.
          </SectionHeader>

          <ol className="border-t hairline">
            {STEPS.map((s) => (
              <li
                key={s.n}
                className="grid md:grid-cols-12 gap-4 md:gap-10 border-b hairline py-7"
              >
                <div className="md:col-span-3 flex md:flex-col items-baseline md:items-start justify-between md:justify-start gap-3">
                  <span className="font-mono text-[11px] uppercase tracking-[0.18em] text-ink-faint tabular">
                    {s.n}
                  </span>
                  <h3 className="font-serif text-xl md:text-2xl leading-tight text-ink">{s.title}</h3>
                </div>
                <div className="md:col-span-9 text-ink-muted leading-relaxed">{s.body}</div>
              </li>
            ))}
          </ol>
        </section>

        {/* § 04 — What holds: the trust anchors a paying client can't move. */}
        <section className="mb-16">
          <SectionHeader
            number="§ 04"
            label="What holds"
            title="What a monitoring client can't change."
          >
            Subscribing changes what we watch — never what we report.
          </SectionHeader>

          <div className="grid gap-4 md:grid-cols-3">
            {HOLDS.map((h) => (
              <div key={h.label} className="border hairline bg-parchment-50 p-5">
                <p className="section-label mb-2">{h.label}</p>
                <p className="text-[13px] leading-relaxed text-ink-muted">{h.body}</p>
              </div>
            ))}
          </div>
        </section>

        {/* § 05 — The ask: an honest, mailto conversation-starter. */}
        <section>
          <SectionHeader number="§ 05" label="Get monitored" />

          <EcosystemCta
            heading="Monitor your ecosystem."
            body="Run an independent, continuous trust index for your network's MCP servers, agents, and skills — re-graded on a cadence, with regressions flagged to your team. We set it up per network; tell us what you ship."
            mailtoSubject="Monitor our ecosystem with polygraph"
            secondaryHref="/base"
            secondaryLabel="See a live index"
          />
        </section>

        <p className="mt-12 font-mono text-[11px] text-ink-faint leading-relaxed border-t hairline pt-5">
          Every grade is behavioral and reproducible — re-run the open harness against the same ref
          to check it. See the full{" "}
          <Link href="/rankings" className="underline decoration-dotted underline-offset-2 hover:text-oxblood transition-colors">
            MCP Security Index
          </Link>
          .
        </p>
      </article>
    </main>
  );
}
