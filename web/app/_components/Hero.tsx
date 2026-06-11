import { PolygraphTrace } from "./PolygraphTrace";
import { InstallCard } from "./InstallCard";

export function Hero() {
  return (
    <section className="relative">
      {/* Minimal product nav — preprint framing retired per landing-brief v1 */}
      <div className="border-b hairline">
        <div className="mx-auto max-w-6xl px-6 py-3 flex items-center justify-between font-mono text-[11px] uppercase tracking-[0.18em] text-ink-muted">
          <div className="flex items-center gap-3">
            <span
              className="inline-block w-1.5 h-1.5 bg-oxblood pulse-soft"
              aria-hidden
            />
            <span className="text-ink">polygraph.so</span>
          </div>
          <nav className="hidden sm:flex items-center gap-5">
            <a
              href="#install"
              className="hover:text-ink transition-colors"
            >
              Install
            </a>
            <a
              href="#try"
              className="hover:text-ink transition-colors"
            >
              Try it
            </a>
            <a
              href="/methodology"
              className="hover:text-ink transition-colors"
            >
              Methodology
            </a>
          </nav>
        </div>
      </div>

      <div className="mx-auto max-w-6xl px-6 pt-16 pb-24 md:pt-24 md:pb-32 grid md:grid-cols-12 gap-10 md:gap-16">
        <div className="md:col-span-7 fade-up">
          <p className="font-serif italic text-ink-muted text-xl md:text-2xl mb-7 max-w-xl leading-snug">
            Catch the agents you can&rsquo;t trust before they touch your data.
          </p>
          <h1 className="font-serif text-[44px] leading-[1.04] tracking-tight md:text-[68px] md:leading-[1.04] text-ink">
            We polygraph
            <br />
            AI agents so you
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

          <p className="mt-8 max-w-xl text-ink-muted text-lg leading-relaxed">
            Independent behavioral polygraphs for MCP servers and the agents
            that use them &mdash; a grade backed by evidence anyone can re-run.
            Free and public.{" "}
            <span className="font-mono text-base text-ink">CLI</span> for
            sub-second checks.
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
              href="#try"
              className="font-mono text-xs text-ink-faint border-b hairline border-dotted hover:text-ink transition-colors"
            >
              Try it live ↓
            </a>
          </div>
        </div>

        <div
          className="md:col-span-5 fade-up"
          style={{ animationDelay: "120ms" }}
        >
          <InstallCard />
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
