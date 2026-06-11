import { SectionHeader } from "./SectionHeader";

// §04 — where this is going. Status is honest: "now" means built and
// running, everything else is sequenced intent, no dates promised.

const steps: Array<{
  status: "now" | "next" | "later";
  title: string;
  body: string;
}> = [
  {
    status: "now",
    title: "litmus-v1 harness",
    body: "The behavioral test battery is built and running: five probes, three checks, a grade from A to F with the evidence attached, and a fingerprint of the exact tool surface each grade certifies.",
  },
  {
    status: "next",
    title: "First public grades",
    body: "First on the bench: filesystem, github, slack, puppeteer, git. Grades publish to the free lookup and the CLI after review — significant failures go to the vendor before they go public.",
  },
  {
    status: "later",
    title: "Verifiable proof",
    body: "Each grade published as a timestamped, independently verifiable record with its full evidence bundle attached — so a grade can be checked without trusting us.",
  },
  {
    status: "later",
    title: "Verified runs",
    body: "Hardware-attested execution, so a third party can prove a specific grade came from the real harness run against the real server.",
  },
];

const STATUS_STYLE: Record<string, string> = {
  now: "border-ink text-ink",
  next: "border-rule text-ink-muted",
  later: "border-rule text-ink-faint",
};

export function Timeline() {
  return (
    <section id="timeline" className="mx-auto max-w-6xl px-6 py-20 md:py-28">
      <SectionHeader
        number="§ 04"
        label="Timeline"
        title="Where this is going."
      >
        Sequenced, not dated &mdash; we publish when a step survives review,
        not when a calendar says so.
      </SectionHeader>

      <ol className="border-t hairline">
        {steps.map((s) => (
          <li
            key={s.title}
            className="grid md:grid-cols-12 gap-6 md:gap-10 border-b hairline py-7"
          >
            <div className="md:col-span-2">
              <span
                className={`inline-flex items-center gap-1.5 border px-2 py-1 font-mono text-[10.5px] uppercase tracking-[0.16em] ${STATUS_STYLE[s.status]}`}
              >
                {s.status === "now" && (
                  <span
                    aria-hidden
                    className="inline-block w-1.5 h-1.5 bg-oxblood pulse-soft"
                  />
                )}
                {s.status}
              </span>
            </div>
            <div className="md:col-span-4">
              <h3 className="font-serif text-xl md:text-2xl leading-tight text-ink">
                {s.title}
              </h3>
            </div>
            <div className="md:col-span-6 text-ink-muted leading-relaxed">
              {s.body}
            </div>
          </li>
        ))}
      </ol>
    </section>
  );
}
