import Link from "next/link";

// House-style 404 — keeps the preprint chrome so a mistyped URL doesn't
// drop the reader into Next's default page.
export default function NotFound() {
  return (
    <main className="flex-1 flex flex-col">
      <div className="border-b hairline">
        <div className="mx-auto max-w-6xl w-full px-6 py-3 flex items-center gap-3 font-mono text-[11px] uppercase tracking-[0.18em] text-ink-muted">
          <span aria-hidden className="inline-block w-1.5 h-1.5 bg-oxblood" />
          <span className="text-ink">polygraph.so</span>
        </div>
      </div>
      <div className="flex-1 flex items-center">
        <div className="mx-auto max-w-3xl px-6 py-24 w-full">
          <p className="section-label mb-4">404 · not found</p>
          <h1 className="font-serif text-4xl md:text-5xl text-ink tracking-tight leading-[1.05]">
            This page isn&rsquo;t in the tracked set.
          </h1>
          <p className="mt-5 text-ink-muted leading-relaxed max-w-xl">
            The URL doesn&rsquo;t resolve to anything we publish. No grade
            implied &mdash; an unknown page is unknown, not failing.
          </p>
          <div className="mt-8 flex flex-wrap gap-5 font-mono text-xs">
            <Link
              href="/"
              className="text-ink border-b hairline border-dotted hover:text-oxblood transition-colors"
            >
              Home →
            </Link>
            <Link
              href="/run"
              className="text-ink-muted border-b hairline border-dotted hover:text-oxblood transition-colors"
            >
              Run a polygraph →
            </Link>
            <Link
              href="/methodology"
              className="text-ink-muted border-b hairline border-dotted hover:text-oxblood transition-colors"
            >
              Methodology →
            </Link>
          </div>
        </div>
      </div>
    </main>
  );
}
