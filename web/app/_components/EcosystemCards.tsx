import Link from "next/link";
import type { Ecosystem, EcosystemStats } from "@/lib/ecosystems";
import { GRADE_HEX } from "@/lib/gradeColors";

/**
 * The shared live-index card units, read from grade-only hosted_runs rows via
 * each ecosystem's own loader. Both the /ecosystems hub and the ecosystem-first
 * homepage (section 01) render these, so a card can never drift between the two
 * surfaces — one source of card truth. Pure render over `EcosystemStats`; no
 * server-only imports, so it composes in any server component.
 */

const CONTACT_EMAIL = "hello@polygraph.so";
export const ECOSYSTEM_MAILTO = `mailto:${CONTACT_EMAIL}?subject=${encodeURIComponent(
  "Monitor our ecosystem with polygraph",
)}`;

/** The grade-distribution strip — bar + legend, the same reduction /base reads. */
export function Distribution({ stats }: { stats: EcosystemStats }) {
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

/** One ecosystem's card — links to its per-network page, stats read live. */
export function EcosystemCard({
  eco,
  stats,
  monitored = false,
}: {
  eco: Ecosystem;
  stats: EcosystemStats;
  /** Active client: oxblood top rule + chip — the same primary-mark the hero uses. */
  monitored?: boolean;
}) {
  return (
    <Link
      href={eco.href}
      className={`group flex min-w-0 flex-col rounded-[5px] border hairline bg-parchment-50 px-5 py-5 transition-colors hover:bg-[#efe8d6] ${
        monitored ? "border-t-2" : ""
      }`}
      style={monitored ? { borderTopColor: "var(--color-oxblood)" } : undefined}
    >
      <div className="flex items-start justify-between gap-3">
        <h3 className="font-serif text-2xl text-ink tracking-tight">{eco.name}</h3>
        {monitored ? (
          <span className="mt-1 shrink-0 font-mono text-[9.5px] uppercase tracking-[0.14em] text-oxblood border border-oxblood/40 rounded-full px-2 py-0.5">
            monitored
          </span>
        ) : null}
      </div>
      <p className="mt-2 text-[13px] leading-relaxed text-ink-muted">{eco.blurb}</p>
      <div className="mt-4">
        <Distribution stats={stats} />
      </div>
      <div className="mt-4 flex items-end justify-between gap-3 font-mono text-[11px] text-ink-faint">
        <span className="flex min-w-0 flex-col gap-1">
          <span className="truncate">{stats.summary}</span>
          <span className="tabular text-[10.5px]">
            {stats.lastRefreshed ? `Last graded ${stats.lastRefreshed}` : "Not graded yet"}
          </span>
        </span>
        <span className="shrink-0 text-ink-muted group-hover:text-oxblood transition-colors">
          View ecosystem →
        </span>
      </div>
    </Link>
  );
}

/** The "where's mine?" tile — the ask, sitting where a reader is already
 *  comparing example indexes. Ghosted so it reads as "add yours." */
export function NotListedTile() {
  return (
    <a
      href={ECOSYSTEM_MAILTO}
      className="group flex min-w-0 flex-col justify-center rounded-[5px] border border-dashed hairline px-5 py-5 transition-colors hover:border-oxblood hover:bg-[#efe8d6]"
    >
      <p className="section-label mb-2">Your network</p>
      <h3 className="font-serif text-2xl text-ink tracking-tight">Not listed yet?</h3>
      <p className="mt-2 text-[13px] leading-relaxed text-ink-muted">
        Start a trust index for your ecosystem&rsquo;s servers, agents, and skills: graded, then
        re-graded on a cadence.
      </p>
      <span className="mt-4 inline-flex items-center gap-2 font-mono text-[11px] text-oxblood">
        Start monitoring
        <span aria-hidden className="transition-transform group-hover:translate-x-0.5">
          →
        </span>
      </span>
    </a>
  );
}
