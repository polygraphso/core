export function Footer() {
  return (
    <footer className="mt-10 border-t hairline">
      {/* Closing brand moment — tagline + vision. The tagline is brand-resonant
          and earns its place here (downstream of the page, brand established).
          Per landing-brief: not the hero, but yes the footer / stickers / bios. */}
      <div className="border-b hairline">
        <div className="mx-auto max-w-6xl px-6 py-14 grid md:grid-cols-12 gap-8 md:gap-12 items-end">
          <div className="md:col-span-8">
            <p className="font-serif text-3xl md:text-5xl leading-[1.05] tracking-tight text-ink">
              <span className="relative inline-block">
                We polygraph AI agents
                <svg
                  aria-hidden
                  viewBox="0 0 460 14"
                  preserveAspectRatio="none"
                  className="absolute left-0 -bottom-1 w-full h-3 text-oxblood"
                >
                  <path
                    d="M2 10 C 100 2, 240 14, 458 6"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="1.4"
                    strokeLinecap="round"
                  />
                </svg>
              </span>{" "}
              so you don&rsquo;t have to.
            </p>
          </div>
          <div className="md:col-span-4">
            <p className="font-serif italic text-lg md:text-xl text-ink-muted leading-snug">
              AI agent trust becomes infrastructure, not guesswork.
            </p>
            <p className="mt-2 font-mono text-[10.5px] uppercase tracking-[0.18em] text-ink-faint">
              What&rsquo;s true if we win.
            </p>
          </div>
        </div>
      </div>

      <div className="mx-auto max-w-6xl px-6 py-14 grid md:grid-cols-12 gap-10">
        <div className="md:col-span-5">
          <div className="font-serif text-2xl text-ink">polygraph.so</div>
          <p className="mt-3 text-ink-muted text-sm leading-relaxed max-w-sm">
            Originally{" "}
            <em className="font-serif">poligrafo.ai</em>. We pivoted to the
            English spelling so people could find us.
          </p>
        </div>

        <nav
          aria-label="Footer"
          className="md:col-span-4 grid grid-cols-2 gap-8 text-sm"
        >
          <div>
            <div className="font-mono text-[11px] uppercase tracking-[0.18em] text-ink-faint mb-3">
              Methodology
            </div>
            <ul className="space-y-2">
              <li>
                <a
                  className="text-ink hover:text-oxblood transition-colors"
                  href="#how-we-test"
                >
                  Probes &amp; categories
                </a>
              </li>
              <li>
                <a
                  className="text-ink hover:text-oxblood transition-colors"
                  href="#"
                >
                  v1 spec
                </a>
              </li>
              <li>
                <a
                  className="text-ink hover:text-oxblood transition-colors"
                  href="#"
                >
                  Sandbox guarantees
                </a>
              </li>
              <li>
                <a
                  id="disclosures"
                  className="text-ink hover:text-oxblood transition-colors"
                  href="#disclosures"
                >
                  Disclosures registry{" "}
                  <span className="text-ink-faint font-mono text-[10.5px] uppercase tracking-[0.16em] ml-1">
                    soon
                  </span>
                </a>
              </li>
            </ul>
          </div>
          <div>
            <div className="font-mono text-[11px] uppercase tracking-[0.18em] text-ink-faint mb-3">
              Contact
            </div>
            <ul className="space-y-2">
              <li>
                <a
                  className="text-ink hover:text-oxblood transition-colors"
                  href="https://x.com/0x_leal"
                  target="_blank"
                  rel="noreferrer"
                >
                  @0x_leal
                </a>
              </li>
              <li>
                <a
                  className="text-ink hover:text-oxblood transition-colors"
                  href="https://x.com/pcbo"
                  target="_blank"
                  rel="noreferrer"
                >
                  @pcbo
                </a>
              </li>
            </ul>
          </div>
        </nav>

        <div className="md:col-span-3 md:text-right">
          <div className="font-mono text-[11px] uppercase tracking-[0.18em] text-ink-faint">
            Status
          </div>
          <div className="mt-1 inline-flex items-center gap-2 font-mono text-[12px] text-ink">
            <span
              aria-hidden
              className="inline-block w-1.5 h-1.5 bg-grade-a"
            />
            v1 in private testing
          </div>
          <div className="mt-6 font-mono text-[11px] text-ink-faint uppercase tracking-[0.18em] tabular">
            v0.1
          </div>
        </div>
      </div>

      <div className="border-t hairline">
        <div className="mx-auto max-w-6xl px-6 py-4 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2 font-mono text-[10.5px] uppercase tracking-[0.18em] text-ink-faint">
          <span>© {new Date().getFullYear()} polygraph.so</span>
          <span>
            Material support is on the{" "}
            <a
              href="#disclosures"
              className="border-b hairline border-dotted hover:text-ink transition-colors"
            >
              disclosures registry
            </a>
            .
          </span>
        </div>
      </div>
    </footer>
  );
}
