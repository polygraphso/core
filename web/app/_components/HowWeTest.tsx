import { SectionHeader } from "./SectionHeader";

type Probe = {
  code: string;
  question: string; // the plain-English title — the question a buyer actually has
  name: string; // spec name, demoted to the mono subtitle
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
    question: "Does it try to hijack your agent?",
    name: "tool-output injection",
    body: "We bait it with inputs designed to make it slip commands into its output, then scan for hijack attempts — lookalike instructions, hidden text, markdown tricks.",
    probeIds: ["1.1", "1.2"],
    status: "v1",
  },
  {
    code: "C-02",
    question: "Does it touch things it shouldn't?",
    name: "permission overreach",
    body: "We run it in a sandbox that blocks all network traffic by default, then flag any call it tries to make anyway. Phone-home detection.",
    probeIds: ["2.2"],
    status: "v1",
  },
  {
    code: "C-03",
    question: "Does it leak your data?",
    name: "sensitive-data handling",
    body: "We plant fake secrets — keys, personal details — and watch every path out of the sandbox to see if they leave, including the tool's own replies to the agent.",
    probeIds: ["4.1", "4.2"],
    status: "v1",
  },
  {
    code: "C-04",
    question: "How does it handle hostile input?",
    name: "adversarial input handling",
    body: "Malformed inputs, oversized payloads, known jailbreak patterns. Deferred to v2 — the deterministic checks ship first.",
    probeIds: [],
    status: "v2",
  },
];

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
    when: "Passed every check inside the sandbox.",
  },
  {
    letter: "B",
    colorVar: "var(--color-grade-b)",
    when: "Passed the hijack and data-leak checks; its network traffic couldn't be verified (remote server, or no sandbox). Capped by design — unverified is not verified-good.",
  },
  {
    letter: "C",
    colorVar: "var(--color-grade-c)",
    when: "Reserved — nothing maps to it yet. Results jump from a capped B to a contained-failure D. Future checks may claim it.",
    reserved: true,
  },
  {
    letter: "D",
    colorVar: "var(--color-grade-d)",
    when: "Made network calls it shouldn't have (C-02 fail), with no hijack or leak. Serious, but not necessarily theft.",
  },
  {
    letter: "F",
    colorVar: "var(--color-grade-f)",
    when: "Tried to hijack the agent, or leaked data (C-01 / C-03 fail). Disqualifying — these directly harm the agent that trusted the server.",
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
        title="How a tool earns its grade."
      >
        Five probes, three checks, one sandbox that blocks everything by
        default. A check we can&rsquo;t run is reported as skipped &mdash;
        never passed &mdash; and every grade ships with the evidence: not a
        star rating, the actual artifacts.
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
                  {p.question}
                </h3>
                <p className="mt-1.5 font-mono text-[11px] text-ink-faint uppercase tracking-[0.16em]">
                  {[p.name, ...p.probeIds.map((id) => `probe ${id}`)].join(
                    " · ",
                  )}
                </p>
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
        Every grade is pinned to the exact version of the tool we tested: a
        sha256{" "}
        <span className="font-mono text-[0.92em] text-ink">fingerprint</span>{" "}
        of its tool definitions. If the server later changes a tool &mdash; a
        rug pull &mdash; the fingerprint stops matching and the grade goes
        stale automatically.
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
