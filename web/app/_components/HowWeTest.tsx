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
        Every probe runs in an isolated sandbox. Every result is reproducible
        and published with the evidence &mdash; not a star rating, the actual
        artifacts.
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
                  {isV2 ? "v2 · deferred" : "shipping v1"}
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

      <p className="mt-8 max-w-2xl text-ink-muted text-sm leading-relaxed">
        Probes evolve as agents do &mdash; new failure modes get new probes.
        The methodology is versioned and public. Read{" "}
        <a
          href="#"
          className="text-ink border-b hairline border-dotted hover:text-oxblood transition-colors"
        >
          the v1 spec
        </a>
        .
      </p>
    </section>
  );
}
