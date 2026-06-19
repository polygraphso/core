import { PolygraphTrace } from "./PolygraphTrace";
import { InstallCard } from "./InstallCard";
import { HeroPolygraph } from "./HeroPolygraph";

// The skim skeleton: the whole model in three beats, for readers who won't
// go past the fold. Each section below expands one beat.
const BEATS: Array<[string, string, string]> = [
  [
    "01",
    "We test it",
    "Adversarial probes in a sandbox — does it hijack the agent, overreach, or leak?",
  ],
  [
    "02",
    "We grade it",
    "A letter grade, A to F, published free with the evidence attached.",
  ],
  [
    "03",
    "You check it",
    "One command before your agent installs anything.",
  ],
];

export function Hero() {
  return (
    <section className="relative">
      <div className="mx-auto max-w-6xl px-6 pt-16 pb-24 md:pt-24 md:pb-32 grid md:grid-cols-12 gap-10 md:gap-16">
        <div className="md:col-span-7 fade-up">
          <p className="font-serif italic text-ink-muted text-xl md:text-2xl mb-7 max-w-xl leading-snug">
            Catch the tools your agent can&rsquo;t trust before they touch
            your data.
          </p>
          <h1 className="font-serif text-[44px] leading-[1.04] tracking-tight md:text-[68px] md:leading-[1.04] text-ink">
            We polygraph
            <br />
            AI tools so you
            <br />
            <span className="relative inline-block">
              don&rsquo;t have to
              <svg
                aria-hidden
                viewBox="0 0 280 14"
                preserveAspectRatio="none"
                className="absolute left-0 -bottom-1 w-full h-3 text-oxblood"
              >
                <path
                  d="M2 10 C 60 2, 140 14, 278 6"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="1.6"
                  strokeLinecap="round"
                />
              </svg>
            </span>
            .
          </h1>

          {/* Subhead v0.4 — concrete-first for cold readers; the insider
              terms (MCP, re-runnable) drop to the mono line below. */}
          <p className="mt-8 max-w-xl text-ink-muted text-lg leading-relaxed">
            AI agents plug into third-party tools and load skills that can
            hijack them or leak your data. We run those tools through an
            adversarial test, scan those skills for the same tricks, and
            publish a letter grade &mdash; free to read, public, evidence
            attached.
          </p>

          <div className="mt-10 flex flex-wrap items-center gap-4">
            <a
              href="#install"
              className="inline-flex items-center gap-2 bg-ink text-parchment px-5 py-3 font-mono text-sm tracking-wide hover:bg-oxblood transition-colors"
            >
              <span aria-hidden className="font-mono text-base leading-none">
                $
              </span>
              <span>Install the CLI</span>
            </a>
            <a
              href="#checks"
              className="font-mono text-xs text-ink-faint border-b hairline border-dotted hover:text-ink transition-colors"
            >
              See completed checks ↓
            </a>
          </div>
        </div>

        <div
          className="md:col-span-5 fade-up"
          style={{ animationDelay: "120ms" }}
        >
          <HeroPolygraph />
          <InstallCard />
        </div>
      </div>

      {/* Skim strip — the three-beat model for readers who stop here */}
      <div className="border-t hairline bg-parchment-50/40">
        <div className="mx-auto max-w-6xl px-6 py-6 grid sm:grid-cols-3 gap-5 sm:gap-8">
          {BEATS.map(([num, beat, line]) => (
            <div key={num} className="flex items-baseline gap-3">
              <span className="font-mono text-[11px] text-ink-faint tabular shrink-0">
                {num}
              </span>
              <p className="text-sm leading-relaxed text-ink-muted">
                <span className="font-serif text-base text-ink">{beat}.</span>{" "}
                {line}
              </p>
            </div>
          ))}
        </div>
      </div>

      {/* Section-divider polygraph trace */}
      <div className="border-t border-b hairline bg-parchment-50/60">
        <div className="mx-auto max-w-6xl px-6 py-6">
          <PolygraphTrace
            className="block w-full h-16 md:h-20"
            ariaLabel="Polygraph trace — adversarial probe activity"
          />
          <div className="mt-2 flex items-center justify-between font-mono text-[10px] uppercase tracking-[0.18em] text-ink-faint">
            <span>baseline</span>
            <span>adversarial probes</span>
            <span>baseline</span>
          </div>
        </div>
      </div>
    </section>
  );
}
