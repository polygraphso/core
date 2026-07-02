import { SectionHeader } from "./SectionHeader";

type Probe = {
  code: string;
  question: string; // the plain-English title — the question a buyer actually has
  name: string; // spec name, demoted to the mono subtitle
  body: string;
  probeIds: string[]; // refs to litmus-test.md
  state: "live" | "deferred"; // shipped in the current methodology, or deferred
};

// Source of truth: litmus-test.md (litmus-v11).
// Live = probes 1.1, 1.2, 1.3, 2.1, 2.2, 3.1, 3.2, 4.1, 4.2 — nine probes across four categories.
const probes: Probe[] = [
  {
    code: "C-01",
    question: "Does it try to hijack your agent?",
    name: "tool-output injection",
    body: "We bait it with inputs designed to make it slip commands into its output — including one tool's output fed into another — then scan for hijack attempts: lookalike instructions, hidden text, markdown tricks.",
    probeIds: ["1.1", "1.2", "1.3"],
    state: "live",
  },
  {
    code: "C-02",
    question: "Does it touch things it shouldn't?",
    name: "permission overreach",
    body: "We run local tools in a sandbox that captures every outbound call, then flag any that reach beyond the hosts and ports the server declared it needs. Remote servers can't be sandboxed — there this check is marked skipped, never assumed. We also flag a tool that labels itself read-only while its name, a parameter, or its description shows it mutates — a permission lie your agent would otherwise trust.",
    probeIds: ["2.1", "2.2"],
    state: "live",
  },
  {
    code: "C-03",
    question: "Does it leak your data?",
    name: "sensitive-data handling",
    body: "We plant fake secrets — keys, personal details — and watch every path out of the sandbox to see if they leave, including the tool's own replies to the agent.",
    probeIds: ["4.1", "4.2"],
    state: "live",
  },
  {
    code: "C-04",
    question: "How does it handle hostile input?",
    name: "adversarial input handling",
    body: "We hit each tool with malformed and oversized inputs and known jailbreak patterns, and flag it if it crashes, spills an internal stack trace, or turns the hostile input into an attack of its own.",
    probeIds: ["3.1", "3.2"],
    state: "live",
  },
];

export function HowWeTest() {
  return (
    <section
      id="how-we-test"
      className="mx-auto max-w-6xl px-6 py-20 md:py-28 scroll-mt-12"
    >
      <SectionHeader
        number="§ 03"
        label="How we polygraph"
        title="How a tool earns its grade."
      >
        Nine probes across four live checks &mdash; and one sandbox that
        captures every outbound call. A check we can&rsquo;t run is reported as
        skipped &mdash; never passed &mdash; and every grade ships with the
        evidence: not a star rating, the actual artifacts.
      </SectionHeader>

      <ol className="border-t hairline">
        {probes.map((p) => {
          const isDeferred = p.state === "deferred";
          return (
            <li
              key={p.code}
              className={`grid md:grid-cols-12 gap-6 md:gap-10 border-b hairline py-7 ${
                isDeferred ? "opacity-70" : ""
              }`}
            >
              <div className="md:col-span-2 flex md:flex-col items-baseline md:items-start justify-between md:justify-start gap-2">
                <span className="font-mono text-[11px] uppercase tracking-[0.18em] text-ink-faint tabular">
                  {p.code}
                </span>
                <span
                  className={`font-mono text-[11px] uppercase tracking-[0.18em] ${
                    isDeferred ? "text-ink-faint" : "text-grade-a"
                  }`}
                >
                  {isDeferred ? "deferred" : "litmus-v11 · live"}
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

      <p className="mt-10 max-w-2xl text-ink-muted text-sm leading-relaxed">
        Grades run <span className="text-ink">A&ndash;F</span>{" "}
        &mdash; capped at B when egress can&rsquo;t be verified, down to D for overreach or a crash,
        F for a hijack or leak. Each grade is pinned to a sha256{" "}
        <span className="font-mono text-[0.92em] text-ink">fingerprint</span>{" "}
        of the tool surface, so a later change &mdash; a rug pull &mdash; makes it stale
        automatically. Read the full{" "}
        <a
          href="/methodology#rubric"
          className="text-ink border-b hairline border-dotted hover:text-oxblood transition-colors"
        >
          grade rubric
        </a>{" "}
        and methodology.
      </p>
    </section>
  );
}
