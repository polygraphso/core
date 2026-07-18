import { SectionHeader } from "./SectionHeader";

/**
 * Section 03 — the monitoring engagement in three beats. The same open harness on a
 * clock: re-grade the whole index, detect what moved against the prior run, and
 * alert the team before users see it. Framed as the offering, set up per network.
 */

const STEPS = [
  {
    n: "01",
    title: "Re-grade",
    body: "The whole index re-run on a schedule, the same behavioral test, repeated, not a one-time snapshot.",
  },
  {
    n: "02",
    title: "Detect",
    body: "Each run compared to the last. A drop, a new failing probe, or a fingerprint mismatch is flagged against what graded before.",
  },
  {
    n: "03",
    title: "Alert",
    body: "Your team hears about a regression before your users do, with the evidence bundle attached.",
  },
];

export function HowMonitoringWorks() {
  return (
    <section className="mx-auto max-w-6xl px-6 py-16 md:py-20">
      <SectionHeader number="03" label="How monitoring works" title="Re-grade, detect, alert." />

      <div className="grid gap-4 md:grid-cols-3">
        {STEPS.map((s) => (
          <div key={s.n} className="border hairline bg-parchment-50 p-5">
            <p className="font-mono text-[11px] uppercase tracking-[0.18em] text-ink-faint mb-2">
              {s.n} · {s.title}
            </p>
            <p className="text-[13px] leading-relaxed text-ink-muted">{s.body}</p>
          </div>
        ))}
      </div>
    </section>
  );
}
