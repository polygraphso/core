import type { Metadata } from "next";
import Link from "next/link";
import { ECOSYSTEMS, type EcosystemStats } from "@/lib/ecosystems";
import { GRADE_HEX } from "@/lib/gradeColors";

/**
 * UNLISTED ecosystems hub. Not linked from nav/footer, not in any sitemap,
 * robots noindex — reachable only by direct link, matching the /base and /bankr
 * pages it points to. Each card's stats are read LIVE from those pages' own
 * loaders (see lib/ecosystems), so a card never drifts from its destination.
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

export default async function EcosystemsPage() {
  const stats = await Promise.all(ECOSYSTEMS.map((e) => e.loadStats()));

  return (
    <main className="flex-1">
      <article className="mx-auto max-w-4xl px-6 pt-14 pb-24 md:pt-20 md:pb-28">
        <header className="mb-9">
          <p className="section-label mb-4">Private · ecosystems</p>
          <h1 className="font-serif text-4xl md:text-5xl text-ink tracking-tight leading-[1.05]">Ecosystems</h1>
          <p className="mt-5 font-serif italic text-ink-muted text-lg md:text-xl leading-snug max-w-2xl">
            Per-ecosystem trust indices — independent, reproducible behavioral grades for the MCP
            servers, agents, and skills that make up a given network.
          </p>
        </header>

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

          {/* Reach-out CTA — a dashed "add" tile, mailto only (no form). */}
          <a
            href="mailto:hello@polygraph.so?subject=Add%20our%20ecosystem%20to%20polygraph"
            className="group flex min-w-0 flex-col justify-center rounded-[5px] border border-dashed hairline px-5 py-5 transition-colors hover:bg-[#efe8d6]"
          >
            <h2 className="font-serif text-2xl text-ink tracking-tight">Run an ecosystem?</h2>
            <p className="mt-2 text-[13px] leading-relaxed text-ink-muted">
              Get an independent trust index for your network&rsquo;s MCP servers, agents, and skills.
            </p>
            <span className="mt-4 font-mono text-[11px] text-ink-muted group-hover:text-oxblood transition-colors">
              Add yours → hello@polygraph.so
            </span>
          </a>
        </div>

        <p className="mt-9 font-mono text-[11px] text-ink-faint leading-relaxed border-t hairline pt-5">
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
