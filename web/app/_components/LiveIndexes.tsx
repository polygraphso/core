import Link from "next/link";
import { ECOSYSTEMS } from "@/lib/ecosystems";
import { SectionHeader } from "./SectionHeader";
import { EcosystemCard, NotListedTile } from "./EcosystemCards";

/**
 * § 01 — the proof: live example indexes, read from the same grade-only
 * hosted_runs rows the per-network pages show. The homepage carries a FEATURED
 * subset (the behavioral networks); /ecosystems is the full hub. The
 * "{n} live grades · {m} networks" line and every card number are read live —
 * never hardcoded — so the section can't drift from the evidence.
 */

// The behavioral/live networks we surface on the homepage. The full set lives at
// /ecosystems; keeping home to a few keeps §01 a teaser, not a duplicate hub.
const FEATURED = new Set(["base", "bankr", "virtuals"]);

export async function LiveIndexes() {
  const stats = await Promise.all(ECOSYSTEMS.map((e) => e.loadStats()));
  const totalGraded = stats.reduce((sum, s) => sum + s.graded, 0);
  const featured = ECOSYSTEMS.map((e, i) => ({ eco: e, stats: stats[i] })).filter((x) =>
    FEATURED.has(x.eco.slug),
  );

  return (
    <section id="live-indexes" className="mx-auto max-w-6xl px-6 py-16 md:py-20 scroll-mt-24">
      <SectionHeader number="§ 01" label="What we watch" title="Live indexes, read from real evidence.">
        Each index below is read live from the same reproducible grades the per-network pages show.
      </SectionHeader>

      <p className="mb-5 font-mono text-[11px] uppercase tracking-[0.16em] text-ink-faint">
        {totalGraded} live grades · {ECOSYSTEMS.length} networks
      </p>

      <div className="grid gap-4 md:grid-cols-2">
        {featured.map(({ eco, stats: s }) => (
          <EcosystemCard key={eco.slug} eco={eco} stats={s} />
        ))}
        <NotListedTile />
      </div>

      <p className="mt-6 font-mono text-[12px] text-ink-faint">
        <Link
          href="/ecosystems"
          className="text-ink-muted border-b hairline border-dotted hover:text-oxblood transition-colors"
        >
          See all {ECOSYSTEMS.length} ecosystems →
        </Link>
      </p>
    </section>
  );
}
