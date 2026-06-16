export function Footer() {
  return (
    <footer className="mt-10 border-t hairline">
      <div className="mx-auto max-w-6xl px-6 py-14 grid md:grid-cols-12 gap-10">
        <nav
          aria-label="Footer"
          className="md:col-span-9 grid grid-cols-1 sm:grid-cols-2 gap-8 text-sm"
        >
          <div>
            <div className="font-mono text-[11px] uppercase tracking-[0.18em] text-ink-faint mb-3">
              CLI
            </div>
            <ul className="space-y-2 font-mono text-[11.5px] text-ink whitespace-nowrap">
              <li>
                <code className="text-ink">polygraphso check &lt;ref&gt;</code>
              </li>
              <li>
                <code className="text-ink">polygraphso list</code>
              </li>
            </ul>
            <p className="mt-3 text-ink-faint font-sans text-[11.5px] leading-relaxed">
              <code className="text-ink-muted">npm i -g polygraphso</code>, or{" "}
              <code className="text-ink-muted">npx</code>.
            </p>
            <p className="mt-3 font-sans text-[11.5px] leading-relaxed">
              <a
                className="text-ink hover:text-oxblood transition-colors"
                href="/docs/api"
              >
                API docs →
              </a>
            </p>
            <p className="mt-1.5 font-sans text-[11.5px] leading-relaxed">
              <a
                className="text-ink hover:text-oxblood transition-colors"
                href="/methodology"
              >
                Methodology →
              </a>
            </p>
            <p className="mt-1.5 font-sans text-[11.5px] leading-relaxed">
              <a
                className="text-ink hover:text-oxblood transition-colors"
                href="/brand-kit"
              >
                Brand kit →
              </a>
            </p>
          </div>

          <div>
            <div className="font-mono text-[11px] uppercase tracking-[0.18em] text-ink-faint mb-3">
              Contact
            </div>
            <ul className="space-y-2">
              <li>
                <a
                  className="text-ink hover:text-oxblood transition-colors"
                  href="mailto:hello@polygraph.so"
                >
                  hello@polygraph.so
                </a>
              </li>
              <li>
                <a
                  className="text-ink hover:text-oxblood transition-colors"
                  href="https://x.com/polygraphso"
                  target="_blank"
                  rel="noreferrer"
                >
                  @polygraphso
                </a>
              </li>
            </ul>
          </div>
        </nav>

        <div className="md:col-span-3 md:text-right">
          <div className="font-mono text-[11px] text-ink-faint uppercase tracking-[0.18em] tabular">
            v0.3
          </div>
        </div>
      </div>

      <div className="border-t hairline">
        <div className="mx-auto max-w-6xl px-6 py-4 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 font-mono text-[10.5px] uppercase tracking-[0.18em] text-ink-faint">
          <div>© {new Date().getFullYear()} polygraph.so</div>
          <div className="normal-case tracking-normal font-sans text-[11.5px]">
            From the team behind{" "}
            <a
              className="text-ink-muted hover:text-oxblood transition-colors"
              href="https://talentprotocol.com"
              target="_blank"
              rel="noreferrer"
            >
              Talent Protocol
            </a>
          </div>
        </div>
      </div>
    </footer>
  );
}
