import { SectionHeader } from "./SectionHeader";

type Probe = {
  code: string;
  name: string;
  body: string;
  probeIds: string[]; // refs to litmus-test-v1.md
  status: "v1" | "v2";
};

// Source of truth: litmus-test-v1.md.
// v1 = probes 1.1, 1.2, 2.2, 4.1, 4.2 — five probes across three categories.
// Adversarial input handling (category 3) is deferred to v2.
const probes: Probe[] = [
  {
    code: "C-01",
    name: "Tool-output injection",
    body: "Does the server's output try to hijack the agent calling it? We feed it inputs that bait it into emitting injection-shaped text, then scan outputs for instruction mimicry, hidden unicode, and markdown tricks.",
    probeIds: ["1.1", "1.2"],
    status: "v1",
  },
  {
    code: "C-02",
    name: "Permission overreach",
    body: "Does it touch more than it claimed? In a no-expected-egress run, we flag any outbound network call. Phone-home detection on a default-deny network namespace.",
    probeIds: ["2.2"],
    status: "v1",
  },
  {
    code: "C-03",
    name: "Sensitive data handling",
    body: "Does your data leave the sandbox when it shouldn't? We plant trackable markers (fake keys, distinctive PII strings) and watch every egress path plus the tool's own outputs back to the agent.",
    probeIds: ["4.1", "4.2"],
    status: "v1",
  },
  {
    code: "C-04",
    name: "Adversarial input handling",
    body: "How does it behave on malformed inputs, oversized payloads, and known jailbreak patterns? Deferred from v1 — the deterministic battery ships first; this category waits for the harness to mature.",
    probeIds: [],
    status: "v2",
  },
];

const v1ProbeCount = probes
  .filter((p) => p.status === "v1")
  .reduce((acc, p) => acc + p.probeIds.length, 0);
const v1CategoryCount = probes.filter((p) => p.status === "v1").length;

// Grade rubric — mirrors litmus-test-v1.md §5. The scale is A–F; only
// A / B / D / F are reachable in v1, so C renders as reserved. No E:
// letter scales jump D → F by convention.
const grades: Array<{
  letter: string;
  colorVar: string;
  when: string;
  reserved?: boolean;
}> = [
  {
    letter: "A",
    colorVar: "var(--color-grade-a)",
    when: "All three checks pass inside the sandbox.",
  },
  {
    letter: "B",
    colorVar: "var(--color-grade-b)",
    when: "Injection and data-leak checks pass; egress couldn't be verified (remote target, or no sandbox). Capped by design — unverified is not verified-good.",
  },
  {
    letter: "C",
    colorVar: "var(--color-grade-c)",
    when: "Reserved — no litmus-v1 condition maps to it. Outcomes jump from a capped B to a contained-failure D. Future probe categories (C-04, adversarial input) may claim it.",
    reserved: true,
  },
  {
    letter: "D",
    colorVar: "var(--color-grade-d)",
    when: "Unexpected egress (C-02 fail), no injection or leak. Serious, but not necessarily exfiltration.",
  },
  {
    letter: "F",
    colorVar: "var(--color-grade-f)",
    when: "Any injection or data leak (C-01 / C-03 fail). Disqualifying — these directly harm the agent that trusted the server.",
  },
];

export function HowWeTest() {
  return (
    <section
      id="how-we-test"
      className="mx-auto max-w-6xl px-6 py-20 md:py-28 scroll-mt-12"
    >
      <SectionHeader
        number="§ 02"
        label="How we polygraph"
        title={`${v1ProbeCount} probes. ${v1CategoryCount} categories. One sandbox.`}
      >
        Probes run in a default-deny sandbox where the target allows it, and
        degrade honestly where it doesn&rsquo;t &mdash; a skipped check is
        reported as skipped, never passed. Every result is reproducible and
        ships with the evidence: not a star rating, the actual artifacts.
      </SectionHeader>

      <ol className="border-t hairline">
        {probes.map((p) => {
          const isV2 = p.status === "v2";
          return (
            <li
              key={p.code}
              className={`grid md:grid-cols-12 gap-6 md:gap-10 border-b hairline py-7 ${
                isV2 ? "opacity-70" : ""
              }`}
            >
              <div className="md:col-span-2 flex md:flex-col items-baseline md:items-start justify-between md:justify-start gap-2">
                <span className="font-mono text-[11px] uppercase tracking-[0.18em] text-ink-faint tabular">
                  {p.code}
                </span>
                <span
                  className={`font-mono text-[11px] uppercase tracking-[0.18em] ${
                    isV2 ? "text-ink-faint" : "text-grade-a"
                  }`}
                >
                  {isV2 ? "v2 · deferred" : "litmus-v1 · live"}
                </span>
              </div>
              <div className="md:col-span-4">
                <h3 className="font-serif text-xl md:text-2xl leading-tight text-ink">
                  {p.name}
                </h3>
                {p.probeIds.length > 0 && (
                  <p className="mt-1.5 font-mono text-[11px] text-ink-faint uppercase tracking-[0.16em]">
                    {p.probeIds.map((id) => `probe ${id}`).join(" · ")}
                  </p>
                )}
              </div>
              <div className="md:col-span-6 text-ink-muted leading-relaxed">
                {p.body}
              </div>
            </li>
          );
        })}
      </ol>

      {/* Grade rubric — litmus-test-v1.md §5 */}
      <figure className="mt-12 border hairline bg-parchment-50 max-w-3xl">
        <figcaption className="flex items-center justify-between px-4 py-2.5 border-b hairline font-mono text-[10.5px] uppercase tracking-[0.18em] text-ink-faint">
          <span>Table 1 — Grade rubric · litmus-v1</span>
          <span className="hidden sm:inline">scale a–f</span>
        </figcaption>
        <ul>
          {grades.map((g) => (
            <li
              key={g.letter}
              className={`flex gap-4 px-4 py-4 border-b hairline ${
                g.reserved ? "opacity-60" : ""
              }`}
            >
              <span
                className="font-serif text-2xl leading-none w-7 shrink-0 tabular"
                style={{ color: g.colorVar }}
              >
                {g.letter}
              </span>
              <span className="text-ink-muted text-sm leading-relaxed">
                {g.when}
              </span>
            </li>
          ))}
        </ul>
        <p className="px-4 py-3 font-mono text-[11px] text-ink-faint leading-relaxed">
          There is no E &mdash; the scale runs A to F, skipping E as letter
          grades conventionally do.
        </p>
      </figure>

      <p className="mt-8 max-w-2xl text-ink-muted text-sm leading-relaxed">
        Every grade certifies an exact tool surface: a sha256{" "}
        <span className="font-mono text-[0.92em] text-ink">fingerprint</span>{" "}
        of the server&rsquo;s canonicalized tool definitions. If the server
        later changes a tool &mdash; a rug pull &mdash; the fingerprint stops
        matching and the grade is stale by construction.
      </p>

      <p className="mt-4 max-w-2xl text-ink-muted text-sm leading-relaxed">
        Probes evolve as agents do &mdash; new failure modes get new probes.
        The methodology is versioned;{" "}
        <span className="font-mono text-[0.92em] text-ink">litmus-v1</span>{" "}
        travels with every grade it produced. Read{" "}
        <a
          href="/methodology"
          className="text-ink border-b hairline border-dotted hover:text-oxblood transition-colors"
        >
          the full spec
        </a>
        .
      </p>
    </section>
  );
}
