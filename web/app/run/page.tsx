import type { Metadata } from "next";
import { RunSubmitForm } from "./_components/RunSubmitForm";

export const metadata: Metadata = {
  title: "Run a polygraph",
  description:
    "Submit an MCP server and we run the litmus battery in our sandbox — grade, per-check evidence, and fingerprint at a permanent URL. Payment buys the run, never the grade.",
  alternates: { canonical: "/run" },
};

export default function RunPage() {
  return (
    <main className="flex-1">
      <div className="border-b hairline">
        <div className="mx-auto max-w-6xl px-6 py-3 flex items-center justify-between font-mono text-[11px] uppercase tracking-[0.18em] text-ink-muted">
          <a
            href="/"
            className="flex items-center gap-3 hover:text-ink transition-colors"
          >
            <span aria-hidden className="inline-block w-1.5 h-1.5 bg-oxblood" />
            <span className="text-ink">polygraph.so</span>
          </a>
          <nav className="hidden sm:flex items-center gap-5">
            <a href="/" className="hover:text-ink transition-colors">
              Home
            </a>
            <a href="/methodology" className="hover:text-ink transition-colors">
              Methodology
            </a>
          </nav>
        </div>
      </div>

      <div className="mx-auto max-w-3xl px-6 pt-14 pb-24 md:pt-20 md:pb-32">
        <header className="mb-10">
          <p className="section-label mb-4">Hosted run · litmus</p>
          <h1 className="font-serif text-4xl md:text-5xl text-ink tracking-tight leading-[1.05]">
            Run a polygraph.
          </h1>
          <p className="mt-5 font-serif italic text-ink-muted text-lg md:text-xl leading-snug">
            Don&rsquo;t want to run the harness yourself? Submit a server and
            we run the full litmus battery in our sandbox &mdash; grade,
            per-check evidence, and fingerprint at a permanent URL.
          </p>
        </header>

        {/* The independence rule — shown before any money moves */}
        <figure className="border hairline bg-parchment-50 mb-10">
          <figcaption className="px-4 py-2.5 border-b hairline font-mono text-[10.5px] uppercase tracking-[0.18em] text-ink-faint">
            Before you pay — the rule
          </figcaption>
          <div className="p-4 md:p-5 text-ink-muted leading-relaxed text-sm space-y-2">
            <p className="font-serif text-lg text-ink leading-snug">
              Payment buys the run, never the grade.
            </p>
            <p>
              The result publishes pass or fail. A failing grade is not
              refundable, retractable, or negotiable, and the payment is
              disclosed on the report. Nobody &mdash; including you &mdash;
              gets review or approval rights over the result.
            </p>
            <p className="font-mono text-[11px] text-ink-faint">
              Remote https:// servers can&rsquo;t be egress-sandboxed, so
              their grade ceiling is B by design. Registry packages run in
              the full sandbox &mdash; A is reachable.
            </p>
          </div>
        </figure>

        <RunSubmitForm />
      </div>
    </main>
  );
}
