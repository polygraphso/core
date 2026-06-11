import { SectionHeader } from "./SectionHeader";

// §05 — the proof rails (onchain attestations, burn-to-write, TEE) and the
// funding model. One calm section: product-first page, crypto stated as fact.
// Source: Polygraph 101 (Notion) + onchain-proof-spec.md in polygraph-litmus.

const rails: Array<{
  code: string;
  name: string;
  status: string;
  live: boolean;
  body: string;
}> = [
  {
    code: "P-01",
    name: "Onchain grades",
    status: "built · testnet",
    live: true,
    body: "Each grade publishes as an EAS attestation on Base — server ref, tool-surface fingerprint, per-check results, grade, methodology version, timestamp — with the full evidence bundle pinned to IPFS. Readable without asking us.",
  },
  {
    code: "P-02",
    name: "$POLYGRAPH burn-to-write",
    status: "roadmap",
    live: false,
    body: "Writing a grade onchain will burn $POLYGRAPH. The public record gets a public write-fee, paid in the token the community launched around the project.",
  },
  {
    code: "P-03",
    name: "TEE-verified runs",
    status: "roadmap",
    live: false,
    body: "A trusted execution environment signs the run itself, so a third party can prove a specific grade came from the real harness against the real server — not just take the runner's word for it.",
  },
];

export function ProofAndFunding() {
  return (
    <section id="proof" className="mx-auto max-w-6xl px-6 py-20 md:py-28">
      <SectionHeader
        number="§ 05"
        label="Proof & funding"
        title="Grades you can verify. Funding you can see."
      >
        A grade you have to take on faith is just another review. Every layer
        here is moving onto rails a stranger can check &mdash; including the
        money.
      </SectionHeader>

      <ol className="border-t hairline">
        {rails.map((r) => (
          <li
            key={r.code}
            className={`grid md:grid-cols-12 gap-6 md:gap-10 border-b hairline py-7 ${
              r.live ? "" : "opacity-70"
            }`}
          >
            <div className="md:col-span-2 flex md:flex-col items-baseline md:items-start justify-between md:justify-start gap-2">
              <span className="font-mono text-[11px] uppercase tracking-[0.18em] text-ink-faint tabular">
                {r.code}
              </span>
              <span
                className={`font-mono text-[11px] uppercase tracking-[0.18em] ${
                  r.live ? "text-grade-a" : "text-ink-faint"
                }`}
              >
                {r.status}
              </span>
            </div>
            <div className="md:col-span-4">
              <h3 className="font-serif text-xl md:text-2xl leading-tight text-ink">
                {r.name}
              </h3>
            </div>
            <div className="md:col-span-6 text-ink-muted leading-relaxed">
              {r.body}
            </div>
          </li>
        ))}
      </ol>

      {/* Funding covenant — contract-styled, mirrors the independence framing */}
      <figure className="mt-12 border hairline bg-parchment-50">
        <figcaption className="flex items-center justify-between px-4 py-2.5 border-b hairline font-mono text-[10.5px] uppercase tracking-[0.18em] text-ink-faint">
          <span>How Polygraph is funded</span>
          <span className="hidden sm:inline">public by design</span>
        </figcaption>
        <div className="p-5 md:p-7 grid md:grid-cols-12 gap-6 md:gap-10">
          <div className="md:col-span-7 text-ink-muted leading-relaxed">
            <p>
              The Bankr community launched{" "}
              <span className="font-mono text-[0.92em] text-ink">
                $POLYGRAPH
              </span>{" "}
              &mdash; we didn&rsquo;t issue it. We claim the dev fees publicly
              and use them to fund Polygraph as an open project: the harness,
              the grades, and the evidence stay free and public.
            </p>
            <p className="mt-4 font-serif text-lg md:text-xl text-ink leading-snug">
              Nobody can pay for a grade. Hosted runs are paid &mdash; the
              results aren&rsquo;t. No graded party gets review or approval
              rights over their grade.
            </p>
          </div>
          <div className="md:col-span-5 md:border-l hairline md:pl-8 flex flex-col justify-between gap-5">
            <ul className="space-y-2 font-mono text-[12px]">
              <li>
                <a
                  href="https://bankr.bot/discover/0x2878cfc54aabdadd9bb5d70dd24d6b91485afba3"
                  target="_blank"
                  rel="noreferrer"
                  className="text-ink border-b hairline border-dotted hover:text-oxblood transition-colors"
                >
                  $POLYGRAPH on Bankr →
                </a>
              </li>
              <li>
                <a
                  href="https://x.com/polygraphso"
                  target="_blank"
                  rel="noreferrer"
                  className="text-ink border-b hairline border-dotted hover:text-oxblood transition-colors"
                >
                  @polygraphso →
                </a>
              </li>
            </ul>
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
