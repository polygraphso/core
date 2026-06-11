"use client";

// House-style error boundary. Honest and brief: something on our side
// broke; nothing about the reader's data or payment is implied lost.
export default function ErrorPage({
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
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
          <p className="section-label mb-4">error · our side</p>
          <h1 className="font-serif text-4xl md:text-5xl text-ink tracking-tight leading-[1.05]">
            Something failed on our side.
          </h1>
          <p className="mt-5 text-ink-muted leading-relaxed max-w-xl">
            The page hit an error while rendering. Your data and any
            payment are not affected by a display failure &mdash; retry, and
            if it persists email{" "}
            <a
              className="text-ink hover:text-oxblood transition-colors"
              href="mailto:hello@polygraph.so"
            >
              hello@polygraph.so
            </a>
            .
          </p>
          <button
            type="button"
            onClick={reset}
            className="mt-8 inline-flex items-center justify-center bg-ink text-parchment px-5 py-3 font-mono text-sm tracking-wide hover:bg-oxblood transition-colors"
          >
            Retry
          </button>
        </div>
      </div>
    </main>
  );
}
