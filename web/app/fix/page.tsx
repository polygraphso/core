/**
 * /fix — remediation funnel, currently a "coming soon" placeholder.
 *
 * Reached from the "How to fix this" CTA on any non-A skill (/skill/<…>) or
 * server (/mcp/<…>) report, carrying the target in `?for=<key>`. The real,
 * paywalled remediation guidance will fill this page in later; for now it just
 * stakes out the URL + `?for=` contract. Unlisted (noindex), like /notify.
 */

import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "Remediation — coming soon",
  description: "Guided fixes for a flagged polygraph grade. Coming soon.",
  alternates: { canonical: "/fix" },
  robots: { index: false, follow: true },
};

type SearchParams = Promise<{ [key: string]: string | string[] | undefined }>;

export default async function FixPage({ searchParams }: { searchParams: SearchParams }) {
  const params = await searchParams;
  const rawFor = Array.isArray(params.for) ? params.for[0] : params.for;
  // Display only — this is a placeholder, so no parsing/validation. Cap length
  // so a pathological query can't blow out the layout.
  const target = rawFor && rawFor.length <= 512 ? rawFor : null;

  return (
    <main className="flex-1">
      <section className="mx-auto max-w-3xl px-6 pt-20 pb-24 md:pt-24 md:pb-32">
        <div className="border-t hairline pt-6 mb-10">
          <div className="flex items-baseline gap-4">
            <span className="section-label tabular">§ Fix</span>
            <span className="section-label">/</span>
            <span className="section-label">Remediation</span>
          </div>
        </div>

        <h1 className="font-serif text-3xl md:text-4xl tracking-tight text-ink leading-[1.1] max-w-2xl">
          Guided remediation is coming soon.
        </h1>

        {target ? (
          <p className="mt-5 font-mono text-[12px] text-ink-faint break-all">
            for <span className="text-ink-muted">{target}</span>
          </p>
        ) : null}

        <p className="mt-6 max-w-xl text-ink-muted leading-relaxed">
          A report tells you the grade and the evidence behind it. We&rsquo;re building the next
          step: the specific, reproducible changes that clear a flagged grade — for skills and MCP
          servers alike. It isn&rsquo;t ready yet.
        </p>

        <div className="mt-8">
          <Link
            href="/"
            className="inline-flex items-center gap-2 border hairline px-5 py-3 font-mono text-sm tracking-wide text-ink-muted hover:text-ink transition-colors"
          >
            ← Back to polygraph.so
          </Link>
        </div>
      </section>
    </main>
  );
}
