import Link from "next/link";
import { ECOSYSTEMS } from "@/lib/ecosystems";
import { monitoredSlugSet } from "@/lib/monitoredEcosystems";
import { SectionHeader } from "./SectionHeader";
import { EcosystemCard, NotListedTile } from "./EcosystemCards";

/**
 * Section 01 — the proof: live example indexes, read from the same grade-only
 * hosted_runs rows the per-network pages show. The homepage carries a FEATURED
 * subset: MONITORED ecosystems (active clients) always take the slots first —
 * their place on the homepage is part of what monitoring buys — with the
 * default set filling in while the client list is short. /ecosystems is the
 * full hub. The "{n} live grades · {m} networks" line and every card number
 * are read live — never hardcoded — so the section can't drift from the
 * evidence.
 */

// The fallback networks surfaced while there are fewer monitored ecosystems
// than homepage slots. Keeping home to a few keeps section 01 a teaser, not a hub.
const DEFAULT_FEATURED = new Set(["base", "bankr", "virtuals"]);
const FEATURED_SLOTS = 3;

export async function LiveIndexes() {
  const [stats, monitored] = await Promise.all([
    Promise.all(ECOSYSTEMS.map((e) => e.loadStats())),
    monitoredSlugSet(),
  ]);
  const totalGraded = stats.reduce((sum, s) => sum + s.graded, 0);
  const cards = ECOSYSTEMS.map((e, i) => ({ eco: e, stats: stats[i]!, monitored: monitored.has(e.slug) }));
  // Monitored first (all of them), then defaults up to the slot count.
  const featured = [
    ...cards.filter((c) => c.monitored),
    ...cards.filter((c) => !c.monitored && DEFAULT_FEATURED.has(c.eco.slug)),
  ].slice(0, Math.max(FEATURED_SLOTS, monitored.size));

  return (
    <section id="live-indexes" className="mx-auto max-w-6xl px-6 py-16 md:py-20 scroll-mt-24">
      <SectionHeader number="01" label="What we watch" title="Live indexes, read from real evidence.">
        Each index below is read live from the same reproducible grades the per-network pages show.
      </SectionHeader>

      <p className="mb-5 font-mono text-[11px] uppercase tracking-[0.16em] text-ink-faint">
        {totalGraded} live grades · {ECOSYSTEMS.length} networks
      </p>

      <div className="grid gap-4 md:grid-cols-2">
        {featured.map(({ eco, stats: s, monitored: m }) => (
          <EcosystemCard key={eco.slug} eco={eco} stats={s} monitored={m} />
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
