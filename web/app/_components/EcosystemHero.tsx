import Link from "next/link";
import { ECOSYSTEM_MAILTO } from "./EcosystemCards";

/**
 * The ecosystem-first hero (design direction 2a). A full-width headline, then a
 * two-audience fork: the paid continuous trust index (the revenue motion) beside
 * the free public index (the proof and on-ramp). Builder tooling is one line out
 * to /builders — present, not prominent.
 *
 * "Start monitoring" is the same mailto conversation the rest of the ecosystem
 * surfaces open with; monitoring is sales-led, so there is no self-serve signup
 * to link to here. Keep that framing — the offering is set up per network.
 */

const CARD_A_CTA =
  "inline-flex items-center gap-2 rounded-[3px] bg-ink px-5 py-3 font-mono text-[13px] tracking-wide text-parchment transition-colors hover:bg-oxblood";
const CARD_B_CTA =
  "inline-flex items-center gap-2 rounded-[3px] border border-ink px-5 py-3 font-mono text-[13px] tracking-wide text-ink transition-colors hover:bg-ink hover:text-parchment";
const QUIET_LINK =
  "inline-flex items-center gap-1.5 pb-0.5 font-mono text-[11px] uppercase tracking-[0.14em] text-ink-muted border-b hairline border-dotted transition-colors hover:text-oxblood";

export function EcosystemHero() {
  return (
    <section className="mx-auto max-w-6xl px-6 pt-16 md:pt-24 pb-6">
      <p className="font-mono text-[11px] uppercase tracking-[0.2em] text-ink-faint mb-5">
        The independent trust layer for AI tools
      </p>
      <h1 className="font-serif text-4xl md:text-[3.4rem] leading-[1.05] tracking-tight text-ink max-w-[24ch]">
        Independent trust for the AI tools your ecosystem runs on.
      </h1>
      <p className="mt-6 max-w-2xl text-ink-muted text-lg leading-relaxed">
        Agents plug into third-party MCP servers and skills that can hijack them or leak data. We
        grade those tools behaviorally, publish the evidence, and keep the grade current, because a
        tool surface doesn&rsquo;t hold still. Free to read as a public index; continuous and
        monitored for your network:
      </p>

      {/* The two-audience fork: paid monitoring (left) + free public index (right). */}
      <div className="mt-8 grid gap-4 md:grid-cols-2">
        {/* Card A — the revenue motion. Oxblood top rule marks it as the primary. */}
        <div className="flex flex-col overflow-hidden rounded-[5px] border hairline bg-parchment-50">
          <div className="h-[3px] bg-oxblood" aria-hidden />
          <div className="flex flex-1 flex-col p-6">
            <p className="font-mono text-[11px] uppercase tracking-[0.18em] text-oxblood mb-2.5">
              For ecosystems &amp; networks
            </p>
            <h2 className="font-serif text-2xl tracking-tight text-ink leading-[1.1]">
              A continuous trust index
            </h2>
            <p className="mt-3 flex-1 text-[14px] leading-relaxed text-ink-muted">
              We keep an independent, reproducible index of your network&rsquo;s MCP servers, agents,
              and skills, re-graded on a cadence, with drops and swapped tool surfaces flagged to
              your team.
            </p>
            <div className="mt-6 flex flex-wrap items-center gap-x-5 gap-y-3">
              <a href={ECOSYSTEM_MAILTO} className={CARD_A_CTA}>
                Start monitoring <span aria-hidden>→</span>
              </a>
              <a href="#live-indexes" className={QUIET_LINK}>
                See a live index
              </a>
            </div>
          </div>
        </div>

        {/* Card B — the free proof + on-ramp. Muted top rule: present, secondary. */}
        <div className="flex flex-col overflow-hidden rounded-[5px] border hairline bg-parchment-50">
          <div className="h-[3px] bg-[color:var(--color-rule)]" aria-hidden />
          <div className="flex flex-1 flex-col p-6">
            <p className="font-mono text-[11px] uppercase tracking-[0.18em] text-ink-faint mb-2.5">
              Free &amp; public
            </p>
            <h2 className="font-serif text-2xl tracking-tight text-ink leading-[1.1]">
              The public trust index
            </h2>
            <p className="mt-3 flex-1 text-[14px] leading-relaxed text-ink-muted">
              Every grade we publish is free to read and reproducible. Browse behavioral grades for
              MCP servers and skills across networks, and see exactly what an index looks like before
              you run one for yours.
            </p>
            <div className="mt-6 flex flex-wrap items-center gap-x-5 gap-y-3">
              <Link href="/mcp-index" className={CARD_B_CTA}>
                Browse the index <span aria-hidden>→</span>
              </Link>
              <Link href="/methodology" className={QUIET_LINK}>
                Methodology
              </Link>
            </div>
          </div>
        </div>
      </div>

      {/* Builders: present, one line, not prominent. */}
      <p className="mt-4 font-mono text-[12px] leading-relaxed text-ink-faint">
        Building the tools yourself? The open litmus harness (CLI, GitHub Action, and README badges)
        is self-serve on the{" "}
        <Link
          href="/builders"
          className="text-ink-muted border-b hairline border-dotted hover:text-oxblood transition-colors"
        >
          builders page →
        </Link>
      </p>
    </section>
  );
}
