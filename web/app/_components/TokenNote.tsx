import { SectionHeader } from "./SectionHeader";

// §05 — the funding note. Compact by design: the token is stated as fact
// and kept off the hero. The believer who wants it finds it; the
// security reader who doesn't care scrolls past in one beat.
//
// The independence line is load-bearing: "nobody can pay for a grade"
// is what keeps the token from reading as a rating-for-pay scheme.

const BANKR_URL =
  "https://bankr.bot/discover/0x2878cfc54aabdadd9bb5d70dd24d6b91485afba3";

export function TokenNote() {
  return (
    <section id="funding" className="mx-auto max-w-6xl px-6 py-20 md:py-28">
      <SectionHeader number="§ 05" label="Funding" title="How this is funded.">
        Free to read, and not paid for by anyone we grade. Here&rsquo;s where
        the money comes from instead.
      </SectionHeader>

      <figure className="border hairline bg-parchment-50 max-w-3xl">
        <figcaption className="flex items-center justify-between px-4 py-2.5 border-b hairline font-mono text-[10.5px] uppercase tracking-[0.18em] text-ink-faint">
          <span>$POLYGRAPH</span>
          <span className="hidden sm:inline">community-launched</span>
        </figcaption>
        <div className="p-5 md:p-7 grid md:grid-cols-12 gap-6 md:gap-10">
          <div className="md:col-span-7 text-ink-muted leading-relaxed">
            <p>
              The Bankr community launched{" "}
              <span className="font-mono text-[0.92em] text-ink">
                $POLYGRAPH
              </span>{" "}
              &mdash; we didn&rsquo;t issue it. We claim the dev fees publicly
              and use them to fund the work: the harness, the grades, and the
              evidence stay free to read.
            </p>
            <p className="mt-4 font-serif text-lg md:text-xl text-ink leading-snug">
              Nobody can pay for a grade. No graded party gets review or
              approval rights over their result.
            </p>
          </div>
          <div className="md:col-span-5 md:border-l hairline md:pl-8 flex flex-col justify-between gap-5">
            <a
              href={BANKR_URL}
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center justify-center gap-2 bg-ink text-parchment px-4 py-3 font-mono text-sm tracking-wide hover:bg-oxblood transition-colors text-center"
            >
              View $POLYGRAPH on Bankr →
            </a>
            <p className="font-mono text-[10.5px] uppercase tracking-[0.14em] text-ink-faint leading-relaxed">
              Not financial advice. The token funds the work; it doesn&rsquo;t
              move a grade.
            </p>
          </div>
        </div>
      </figure>
    </section>
  );
}
