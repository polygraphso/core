import type { Metadata } from "next";
import { RequestForm } from "./_components/RequestForm";

export const metadata: Metadata = {
  title: "Request a grade",
  description:
    "Ask us to run the litmus battery on an MCP server you care about. Free — add it to the queue and we'll email you when its grade publishes.",
  alternates: { canonical: "/request" },
};

export default function RequestPage() {
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
          <p className="section-label mb-4">Grade queue · free</p>
          <h1 className="font-serif text-4xl md:text-5xl text-ink tracking-tight leading-[1.05]">
            Request a grade.
          </h1>
          <p className="mt-5 font-serif italic text-ink-muted text-lg md:text-xl leading-snug">
            Want a server graded that isn&rsquo;t up yet? Add it to the bench.
            We work the queue on our own timeline &mdash; demand moves servers
            up &mdash; and email you when the grade publishes.
          </p>
        </header>

        <RequestForm />

        <p className="mt-8 font-mono text-[11px] text-ink-faint leading-relaxed">
          Just want to hear about new grades in general?{" "}
          <a
            href="/#updates"
            className="text-ink-muted border-b hairline border-dotted hover:text-ink transition-colors"
          >
            Subscribe on the homepage
          </a>{" "}
          instead &mdash; one email per publishing drop.
        </p>
      </div>
    </main>
  );
}
