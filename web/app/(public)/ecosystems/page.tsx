import type { Metadata } from "next";
import Link from "next/link";
import { ECOSYSTEMS, type Ecosystem, type EcosystemStats } from "@/lib/ecosystems";
import { listEcosystems, loadGradedEntries } from "@/lib/ecosystemData";
import { buildEntryVMs } from "@/lib/ecosystemViewModel";
import { isLegacyEcosystemSlug, type EcosystemRow } from "@/lib/ecosystemTypes";
import { SectionHeader } from "@/app/_components/SectionHeader";
import { EcosystemCta } from "@/app/_components/EcosystemCta";
import { EcosystemCard, NotListedTile, ECOSYSTEM_MAILTO } from "@/app/_components/EcosystemCards";

const GRADE_ORDER = ["A", "B", "C", "D", "F"] as const;

/**
 * Cards for DB-backed (self-serve) ecosystems. Stats are built the same way the
 * generic page does — from visible entries joined to live grades — so a hub card
 * never drifts from its /ecosystems/[slug] page. Callers pass the rows to render
 * (already filtered by is_public/is_listed and de-duped against the legacy set).
 */
async function buildEcosystemCards(
  rows: EcosystemRow[],
): Promise<Array<{ eco: Ecosystem; stats: EcosystemStats }>> {
  return Promise.all(
    rows.map(async (e) => {
      const vms = buildEntryVMs(await loadGradedEntries(e.id, { visibleOnly: true }));
      const graded = vms.filter((v) => v.grade);
      const counts = GRADE_ORDER.map((g) => ({ g, n: graded.filter((v) => v.grade === g).length })).filter(
        (c) => c.n > 0,
      );
      const lastRefreshed = graded
        .map((v) => v.completedAt)
        .filter((d): d is string => Boolean(d))
        .reduce<string | null>((a, d) => (a && a > d ? a : d), null);
      const stats: EcosystemStats = {
        counts,
        graded: graded.length,
        summary: `${graded.length} graded · ${vms.length} tracked`,
        lastRefreshed,
      };
      return {
        eco: { slug: e.slug, href: `/ecosystems/${e.slug}`, name: e.name, blurb: e.blurb ?? "", loadStats: async () => stats },
        stats,
      };
    }),
  );
}

/**
 * The ecosystems hub — the full list of live per-network indexes plus the
 * monitoring deck. Linked from the primary nav (the ecosystem-first homepage
 * carries the pitch + a featured subset; this page is the complete hub). Each
 * card's stats are read LIVE from the per-network pages' own loaders (see
 * lib/ecosystems), so a card never drifts from its destination. The card units
 * are shared with the homepage via app/_components/EcosystemCards.
 *
 * Honesty note: daily re-grading, grade-change detection, and dev alerts are
 * the OFFERING — set up per network when an ecosystem signs on, not automation
 * already running for everyone. Copy here describes the engagement; it never
 * claims live automation or invents metrics. See core/CLAUDE.md.
 */
export const metadata: Metadata = {
  title: "Ecosystems",
  description:
    "Independent, continuously re-graded trust indexes for the MCP servers, agents, and skills a network ships. Live example indexes, and how per-network monitoring works.",
};

// Stats come from the live hosted_runs loaders. Cache with ISR like /base & /bankr
// (both revalidate = 3600) rather than rendering per-request: the old force-dynamic
// re-ran the full six-loader fan-out (~50 sequential Supabase round-trips, dominated
// by loadBaseIndex) on EVERY request, uncached — the slow path users were hitting.
// Grades change on a daily-ish cadence, so an hourly re-render is plenty fresh.
export const revalidate = 3600;

// The one ask this page exists to trigger. Shared by the hero CTA, the § 01
// "not listed" tile, and (via its own subject) the closing EcosystemCta, so the
// conversation always opens the same way.
// The address shown in plain text beside the hero mailto (a copy-able fallback).
// The mailto itself is shared with the homepage via EcosystemCards.
const CONTACT_EMAIL = "hello@polygraph.so";

/** The monitoring engagement, step by step. Framed as the offering — the same
 *  open harness, on a clock, wired up per network. */
const STEPS = [
  {
    n: "01",
    title: "Re-grade",
    body: "We re-run the harness against every server and skill in a network's index on a set schedule: the same behavioral test, repeated. Not a one-time snapshot.",
  },
  {
    n: "02",
    title: "Detect",
    body: "Each run is compared against the prior grade. A drop, a newly failing probe, or a changed tool surface (a sha256 fingerprint mismatch, the signature of a rug pull) is flagged against what graded before.",
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
    body: "The harness is open and deterministic. Re-run it against the same ref and you get the same grade, so a drop is something you can check, not take on faith.",
  },
  {
    label: "Independent",
    body: "Nobody can pay for a grade. A monitoring engagement changes what we re-grade and how often, never the letter we publish.",
  },
  {
    label: "Rug-pull-aware",
    body: "Every grade is pinned to a sha256 fingerprint of the tool surface. Change the surface and the grade goes stale on its own. That recheck is what makes “monitored” mean something.",
  },
];

export default async function EcosystemsPage() {
  // The DB is the source of truth for hub visibility (is_public + is_listed) for
  // BOTH the legacy static cards and the self-serve ones, so the Settings toggle
  // means the same thing everywhere. A legacy slug with no DB row defaults to shown.
  const allDb = await listEcosystems();
  const listed = allDb.filter((e) => e.is_public && e.is_listed);
  const listedSlugs = new Set(listed.map((e) => e.slug));
  const shownLegacy = ECOSYSTEMS.filter(
    (e) => !allDb.some((d) => d.slug === e.slug) || listedSlugs.has(e.slug),
  );

  const [stats, dbCards] = await Promise.all([
    Promise.all(shownLegacy.map((e) => e.loadStats())),
    buildEcosystemCards(listed.filter((e) => !isLegacyEcosystemSlug(e.slug))),
  ]);
  const totalGraded =
    stats.reduce((sum, s) => sum + s.graded, 0) + dbCards.reduce((sum, c) => sum + c.stats.graded, 0);
  const networkCount = shownLegacy.length + dbCards.length;
  // The most recent re-grade anywhere in the index — the "last refreshed" stamp the
  // § 05 CTA turns into its hook. Per-ecosystem dates (YYYY-MM-DD) already sort
  // lexicographically, so max() is the latest. null when nothing is graded yet.
  const lastRefreshed = stats
    .map((s) => s.lastRefreshed)
    .filter((d): d is string => Boolean(d))
    .reduce<string | null>((latest, d) => (latest && latest > d ? latest : d), null);

  return (
      <article>
        {/* Hero — the hook: a grade decays, so we keep grading. */}
        <header className="mb-12">
          <p className="section-label mb-4">Continuous monitoring</p>
          <h1 className="font-serif text-4xl md:text-5xl text-ink tracking-tight leading-[1.05]">
            Grades are snapshots. Tools keep shipping.
          </h1>
          <p className="mt-5 font-serif italic text-ink-muted text-lg md:text-xl leading-snug max-w-2xl">
            Your network ships MCP servers and skills you don&rsquo;t fully control: a new release, a
            quiet regression, a swapped tool surface. We keep an independent, reproducible trust index
            for the network and re-grade it on a cadence, so the grade you shipped on doesn&rsquo;t go
            stale on you.
          </p>

          {/* The ask, above the fold — a reader can act on the first screen. */}
          <div className="mt-8 flex flex-wrap items-center gap-x-6 gap-y-3">
            <a
              href={ECOSYSTEM_MAILTO}
              className="inline-flex items-center gap-2 rounded-[3px] bg-ink px-6 py-3.5 font-mono text-sm tracking-wide text-parchment transition-colors hover:bg-oxblood"
            >
              Start monitoring your ecosystem <span aria-hidden>→</span>
            </a>
            <a
              href="#live-indexes"
              className="inline-flex items-center gap-1.5 pb-0.5 font-mono text-[12px] uppercase tracking-[0.16em] text-ink-muted border-b hairline border-dotted transition-colors hover:text-oxblood"
            >
              See a live index <span aria-hidden>↓</span>
            </a>
          </div>
          <p className="mt-3 font-mono text-[12px] text-ink-faint">
            or email{" "}
            <a
              href={ECOSYSTEM_MAILTO}
              className="text-ink-muted underline decoration-dotted underline-offset-2 transition-colors hover:text-oxblood"
            >
              {CONTACT_EMAIL}
            </a>
          </p>
        </header>

        {/* § 01 — Proof first: the live indexes. */}
        <section id="live-indexes" className="mb-16 scroll-mt-24">
          <SectionHeader number="§ 01" label="Live indexes" title="What a trust index looks like.">
            Every grade below is read live from the same evidence the per-network pages show:
            current, reproducible, and yours to re-run against the open harness.
          </SectionHeader>

          <p className="mb-5 font-mono text-[11px] uppercase tracking-[0.16em] text-ink-faint">
            {totalGraded} live grades · {networkCount} networks
          </p>

          <div className="grid gap-4 md:grid-cols-2">
            {shownLegacy.map((e, i) => (
              <EcosystemCard key={e.slug} eco={e} stats={stats[i]} />
            ))}
            {dbCards.map((c) => (
              <EcosystemCard key={c.eco.slug} eco={c.eco} stats={c.stats} />
            ))}
            <NotListedTile />
          </div>
        </section>

        {/* § 02 — Why continuous: the snapshot-goes-stale argument. */}
        <section className="mb-16">
          <SectionHeader
            number="§ 02"
            label="Why continuous"
            title="An index is only as good as its last run."
          >
            A behavioral grade describes a tool on the day it ran. Then the tool changes, and a
            stale A is worse than no grade, because someone is trusting it.
          </SectionHeader>

          <figure className="border-l-2 pl-5" style={{ borderColor: "var(--color-oxblood)" }}>
            <blockquote className="font-serif text-ink text-lg md:text-xl leading-snug">
              A grade is a measurement, and measurements have a date.{" "}
              <span className="text-oxblood">The tool it describes won&rsquo;t hold still.</span>
            </blockquote>
            <figcaption className="mt-3 text-[13px] leading-relaxed text-ink-muted max-w-2xl">
              Third-party servers and skills get new releases and new owners, and a tool surface can
              change after grading, which is exactly how a rug pull works. None of that shows up in a
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
            The same open harness, on a clock, set up per network when an ecosystem signs on.
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
            Subscribing changes what we watch, never what we report.
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
        <section id="get-monitored" className="scroll-mt-24">
          <SectionHeader number="§ 05" label="Get monitored" title="Keep this index from going stale.">
            {lastRefreshed ? (
              <>
                Every grade above was last re-run on{" "}
                <span className="font-mono text-ink tabular">{lastRefreshed}</span>.{" "}
                <span className="text-oxblood">
                  Without monitoring, that&rsquo;s the date it stays frozen at.
                </span>
              </>
            ) : null}
          </SectionHeader>

          <EcosystemCta
            heading="Monitor your ecosystem."
            body="Run an independent, continuous trust index for your network's MCP servers, agents, and skills, re-graded daily instead of once, with regressions flagged to your team. Tell us what you ship and we'll keep the tracked list of servers and skills current as you add them."
            mailtoSubject="Monitor our ecosystem with polygraph"
            secondaryHref="/base"
            secondaryLabel="See a live index"
          />
        </section>

        <p className="mt-12 font-mono text-[11px] text-ink-faint leading-relaxed border-t hairline pt-5">
          Every grade is behavioral and reproducible. Re-run the open harness against the same ref
          to check it. See the full{" "}
          <Link href="/mcp-index" className="underline decoration-dotted underline-offset-2 hover:text-oxblood transition-colors">
            MCP Security Index
          </Link>
          .
        </p>
      </article>
  );
}
