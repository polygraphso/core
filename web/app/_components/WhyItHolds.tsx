import { SectionHeader } from "./SectionHeader";

/**
 * Section 02 — why the index is worth trusting: it's continuous (a grade decays, so we
 * keep grading) and it's unbuyable (a subscription changes what we watch, never
 * the letter). Two paired blockquotes, the /ecosystems figure styling reused so
 * the argument reads the same across surfaces.
 */

const FIGURES = [
  {
    label: "Continuous",
    lead: "A grade is a measurement, and measurements have a date.",
    emphasis: "The tool it describes won’t hold still.",
    body: "A stale A is worse than no grade, because someone is trusting it. Re-running the same test on a cadence is the only thing that keeps an index honest, and catches a rug pull when the tool surface changes.",
  },
  {
    label: "Independent",
    lead: "Nobody can pay for a grade.",
    emphasis: "No graded party gets review or approval rights.",
    body: "A subscription changes what we watch and how often, never the letter we publish. The harness is open and deterministic, so any grade is something you can re-run and check, not take on faith.",
  },
];

export function WhyItHolds() {
  return (
    <section className="mx-auto max-w-6xl px-6 py-16 md:py-20">
      <SectionHeader number="02" label="Why it holds" title="Continuous, and impossible to buy." />

      <div className="grid gap-10 md:grid-cols-2 md:gap-14">
        {FIGURES.map((f) => (
          <figure key={f.label} className="border-l-2 pl-5 m-0" style={{ borderColor: "var(--color-oxblood)" }}>
            <p className="font-mono text-[11px] uppercase tracking-[0.16em] text-ink-faint mb-2.5">
              {f.label}
            </p>
            <blockquote className="font-serif text-ink text-lg md:text-xl leading-snug">
              {f.lead} <span className="text-oxblood">{f.emphasis}</span>
            </blockquote>
            <figcaption className="mt-3.5 text-[14px] leading-relaxed text-ink-muted">
              {f.body}
            </figcaption>
          </figure>
        ))}
      </div>
    </section>
  );
}
