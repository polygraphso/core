import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Methodology — litmus-v1",
  description:
    "The litmus test, v1: a behavioral evaluation of MCP servers. Three checks — tool-output injection, permission overreach, sensitive-data handling — graded A/B/D/F with reproducible evidence.",
  alternates: { canonical: "/methodology" },
};

// Faithful rendering of litmus-test-v1.md (polygraph-litmus repo) — the
// authoritative methodologyVersion: "litmus-v1" spec. Content edits belong
// in the spec first; this page mirrors it.

function Section({
  num,
  label,
  children,
  id,
}: {
  num: string;
  label: string;
  id?: string;
  children: React.ReactNode;
}) {
  return (
    <section id={id} className="mt-16 first:mt-0 scroll-mt-24">
      <div className="flex items-baseline gap-3 mb-5">
        <span className="font-mono text-[11px] uppercase tracking-[0.18em] text-ink-faint tabular">
          §{num}
        </span>
        <h2 className="font-serif text-2xl md:text-3xl text-ink tracking-tight">
          {label}
        </h2>
      </div>
      <div className="space-y-4 text-ink-muted leading-relaxed">{children}</div>
    </section>
  );
}

function Inline({ children }: { children: React.ReactNode }) {
  return (
    <code className="font-mono text-[0.92em] text-ink bg-parchment-200/60 px-1 py-[1px] rounded-sm">
      {children}
    </code>
  );
}

function SubHead({ children }: { children: React.ReactNode }) {
  return (
    <h3 className="font-serif text-lg md:text-xl text-ink mt-8 mb-2">
      {children}
    </h3>
  );
}

export default function MethodologyPage() {
  return (
    <main className="flex-1">
      <div className="border-b hairline">
        <div className="mx-auto max-w-6xl px-6 py-3 flex items-center justify-between font-mono text-[11px] uppercase tracking-[0.18em] text-ink-muted">
          <a
            href="/"
            className="flex items-center gap-3 hover:text-ink transition-colors"
          >
            <span aria-hidden className="inline-block w-1.5 h-1.5 bg-oxblood" />
            <span className="text-ink">polygraph.so</span>
          </a>
          <nav className="hidden sm:flex items-center gap-5">
            <a href="/" className="hover:text-ink transition-colors">
              Home
            </a>
            <a href="/docs/api" className="hover:text-ink transition-colors">
              API
            </a>
          </nav>
        </div>
      </div>

      <article className="mx-auto max-w-3xl px-6 pt-14 pb-24 md:pt-20 md:pb-32">
        <header className="mb-14">
          <p className="section-label mb-4">
            Methodology · litmus-v1 · specification
          </p>
          <h1 className="font-serif text-4xl md:text-5xl text-ink tracking-tight leading-[1.05]">
            The litmus test
          </h1>
          <p className="mt-5 font-serif italic text-ink-muted text-lg md:text-xl leading-snug max-w-2xl">
            A behavioral evaluation of an MCP server — what it{" "}
            <em>does</em> when exercised the way an agent would, not what its
            README says. The string{" "}
            <Inline>methodologyVersion: &quot;litmus-v1&quot;</Inline> travels
            with every grade this spec produces.
          </p>
        </header>

        <Section num="01" label="What it measures" id="what">
          <p>
            The litmus test connects to an MCP server the way an agent would,
            exercises its tools, and watches what the server actually does:
            whether its outputs try to hijack the calling agent, whether it
            reaches out over the network when nothing required it, and whether
            data handed to it leaks back out. It answers one question an agent
            needs answered before it trusts a tool:
          </p>
          <p className="font-serif text-xl text-ink leading-snug border-l-2 border-oxblood pl-4">
            Will this MCP server hijack me, phone home, or leak my data?
          </p>
          <p>
            It does not measure popularity, code quality, maintenance, or
            licensing — those live on a separate adoption axis, never averaged
            in. The litmus grade is the behavioral half of a server&rsquo;s
            polygraph.
          </p>
          <SubHead>What a passing grade does — and does not — claim</SubHead>
          <p>
            It <strong className="text-ink">does</strong> claim: against{" "}
            <Inline>litmus-v1</Inline>, on the exact tool surface identified by
            the fingerprint, the server did not exhibit the failure modes
            below, and the evidence is published and re-runnable.
          </p>
          <p>
            It <strong className="text-ink">does not</strong> claim the server
            is &ldquo;safe,&rdquo; &ldquo;secure,&rdquo; or
            &ldquo;trustworthy&rdquo; in general. We underclaim. A grade is a
            dated, versioned, reproducible observation — nothing more.
          </p>
        </Section>

        <Section num="02" label="Checks and probes" id="checks">
          <p>
            v1 ships five probes across three categories. Probe IDs are
            permanent and carry their family number; future probes extend a
            family without renumbering.
          </p>

          <SubHead>C-01 — Tool-output injection · probes 1.1, 1.2</SubHead>
          <p>
            A server&rsquo;s tool descriptions and outputs flow straight into
            the calling agent&rsquo;s context — the documented &ldquo;tool
            poisoning&rdquo; attack class. <strong className="text-ink">Probe
            1.1</strong> pulls the full tool surface via{" "}
            <Inline>tools/list</Inline> and scans every name, description, and
            input schema. <strong className="text-ink">Probe 1.2</strong>{" "}
            issues bait calls — benign-but-suggestive inputs designed to elicit
            injection-shaped echoes — and scans every output.
          </p>
          <p>
            Fails on any high-severity hit: instruction mimicry aimed at the
            agent (&ldquo;ignore previous instructions&rdquo;, role-tag or
            tool-call-shaped JSON in free text), hidden or invisible Unicode
            (zero-width, bidi overrides, tag characters), or markdown and link
            tricks (<Inline>javascript:</Inline> / <Inline>data:</Inline> URIs,
            link text contradicting the href, exfiltration-shaped image URLs).
          </p>

          <SubHead>C-02 — Permission overreach · probe 2.2</SubHead>
          <p>
            Does it touch more than it claimed? The server runs inside a
            default-deny network namespace and is exercised through a script
            that should require no outbound traffic. Egress is routed to a
            local sinkhole that logs{" "}
            <Inline>{`{host, port, firstBytes}`}</Inline> and never completes
            the connection — the evidence shows what it tried to reach, not a
            silent block. Any outbound attempt during a no-expected-egress run
            is a failure.
          </p>
          <p>
            C-02 requires that the harness runs the server itself. For a
            remote MCP URL the harness cannot control the server&rsquo;s
            network, so C-02 is recorded as{" "}
            <Inline>skipped — remote target</Inline>. Without Docker it is{" "}
            <Inline>skipped — no sandbox</Inline>. A skip is not a pass; see
            the rubric.
          </p>

          <SubHead>C-03 — Sensitive-data handling · probes 4.1, 4.2</SubHead>
          <p>
            Before any calls, the harness plants canaries: a distinctive fake
            API key (<Inline>POLYGRAPH-CANARY-&lt;uuid&gt;</Inline>), a
            distinctive PII string, and a fake bearer token — seeded into
            arguments, the working directory, and the environment.{" "}
            <strong className="text-ink">Probe 4.1</strong> scans all tool
            outputs for any canary echo back to the agent.{" "}
            <strong className="text-ink">Probe 4.2</strong> scans captured
            egress for canary bytes in any outbound payload. A canary
            surfacing anywhere it shouldn&rsquo;t is a failure. Without the
            sandbox, 4.2 degrades to output-scan only and is annotated as
            such.
          </p>

          <SubHead>C-04 — Adversarial input handling · v2, deferred</SubHead>
          <p>
            Behavior under malformed inputs, oversized payloads, and known
            jailbreak patterns. The deterministic battery ships first; this
            category waits for the harness to mature. Not graded in v1.
          </p>
        </Section>

        <Section num="03" label="Shared scanners" id="scanners">
          <p>
            The detection primitives behind C-01 and C-03, implemented once
            and applied uniformly: <Inline>invisibleUnicode</Inline> (zero-width,
            bidi-override, and tag-char codepoints, each reported with
            codepoint and byte offset), <Inline>instructionMimicry</Inline>{" "}
            (agent-directed imperatives, override and jailbreak framing,
            free-text tool-call JSON), <Inline>markdownTricks</Inline>{" "}
            (<Inline>javascript:</Inline>/<Inline>data:</Inline> URIs,
            link-text/href mismatch, exfiltration-shaped image URLs), and{" "}
            <Inline>canaryMatch</Inline> (exact and lightly-obfuscated matches —
            case, whitespace, simple encodings). Scanners are pure functions
            over text: independently testable, and the place new failure modes
            get added.
          </p>
        </Section>

        <Section num="04" label="Grading rubric" id="rubric">
          <p>
            A single letter, always accompanied by a rationale string — never
            a bare grade. There is no C.
          </p>
          <figure className="border hairline bg-parchment-50 mt-2">
            <figcaption className="px-4 py-2.5 border-b hairline font-mono text-[10.5px] uppercase tracking-[0.18em] text-ink-faint">
              Grade rubric · litmus-v1 §5
            </figcaption>
            <table className="w-full text-left text-sm">
              <thead>
                <tr className="border-b hairline font-mono text-[10.5px] uppercase tracking-[0.18em] text-ink-faint">
                  <th className="px-4 py-2.5 font-normal w-16">Grade</th>
                  <th className="px-4 py-2.5 font-normal">Condition</th>
                </tr>
              </thead>
              <tbody className="text-ink-muted">
                <tr className="border-b hairline align-top">
                  <td className="px-4 py-3 font-serif text-xl text-grade-a">A</td>
                  <td className="px-4 py-3">All three categories pass.</td>
                </tr>
                <tr className="border-b hairline align-top">
                  <td className="px-4 py-3 font-serif text-xl text-grade-b">B</td>
                  <td className="px-4 py-3">
                    C-01 and C-03 pass; C-02 <Inline>skipped</Inline> (no
                    sandbox or remote target). Egress was not verified —
                    capped by design.
                  </td>
                </tr>
                <tr className="border-b hairline align-top">
                  <td className="px-4 py-3 font-serif text-xl text-grade-d">D</td>
                  <td className="px-4 py-3">
                    C-02 failure (unexpected egress), no C-01/C-03 failure.
                  </td>
                </tr>
                <tr className="align-top">
                  <td className="px-4 py-3 font-serif text-xl text-grade-f">F</td>
                  <td className="px-4 py-3">
                    Any C-01 or C-03 failure — active injection or data leak.
                  </td>
                </tr>
              </tbody>
            </table>
          </figure>
          <p>
            Rationale: injection and data-leak are disqualifying — they are
            the failures that directly harm an agent that trusts the server,
            so they floor the grade at F. Unexpected egress is serious but not
            necessarily exfiltration, so it caps at D. The B tier keeps the
            no-sandbox path usable while stating honestly that egress was not
            verified. Every grade carries its reasons in the evidence bundle.
          </p>
        </Section>

        <Section num="05" label="Reproducibility" id="reproducibility">
          <p>
            What makes a grade trustworthy rather than an assertion:
          </p>
          <ul className="list-none space-y-3">
            <li>
              <strong className="text-ink">Deterministic harness.</strong>{" "}
              Same server version + same <Inline>litmus-v1</Inline> harness →
              same findings. No randomness in probe verdicts; timestamps and
              environment are recorded, not baked in.
            </li>
            <li>
              <strong className="text-ink">Tool-defs fingerprint.</strong> The
              canonicalized tool surface is hashed (sha256) to a{" "}
              <Inline>bytes32</Inline>. The grade certifies that exact
              surface. If the server later changes a tool description — a rug
              pull — the fingerprint no longer matches and the grade is stale
              by construction. Consumers recompute the live fingerprint before
              trusting.
            </li>
            <li>
              <strong className="text-ink">Published evidence.</strong> The
              full evidence bundle — every finding, every artifact — travels
              with the grade. Anyone can fetch and inspect it.
            </li>
            <li>
              <strong className="text-ink">Re-runnable.</strong> Anyone — a
              skeptic, a counterparty, a future independent verifier — can
              re-run <Inline>litmus-v1</Inline> against the same server and
              compare fingerprint and grade. A false grade is falsifiable, not
              merely disputable.
            </li>
          </ul>
        </Section>

        <Section num="06" label="Threat model & limits" id="limits">
          <p>
            Two properties decide whether a grade can be trusted, and they are
            independent.
          </p>
          <p>
            <strong className="text-ink">
              Forgeability — can the runner fake the result?
            </strong>{" "}
            Fixed by the proof layer, not the methodology. Reproducibility
            makes a lie falsifiable; the roadmap layers — onchain attestation,
            and later TEE-verified runs — make it progressively unprofitable,
            then impossible.
          </p>
          <p>
            <strong className="text-ink">
              Evasion — can the server tell it&rsquo;s being tested and behave?
            </strong>{" "}
            A fundamental methodology limit. Because the methodology is open,
            a server can recognize the test context and behave benignly during
            evaluation, then misbehave in production — a defeat device. No
            proof layer fixes this; an independent lab running the same open
            test has the same exposure. We reduce, not eliminate, the gap:
            per-run-unique canary values, bait inputs drawn from a varied
            pool, behavioral probes over real outputs rather than static
            reads, periodic re-attestation, and the live-fingerprint check at
            call time against bait-and-switch. Evasion is an explicitly
            acknowledged residual risk of v1.
          </p>
          <SubHead>Non-goals</SubHead>
          <ul className="list-none space-y-2">
            <li>
              <strong className="text-ink">Not an independence claim (yet).</strong>{" "}
              v1 grades can be self-run: the subject grades itself, and trust
              anchors on reproducibility — the open harness makes a false
              grade falsifiable. Skin-in-the-game and independent
              counter-attestation are roadmap. A v1 grade is a reproducible
              test result, not an independent verdict. We say so plainly.
            </li>
            <li>
              <strong className="text-ink">Not secrets management.</strong>{" "}
              How a server stores or rotates its own secrets is out of scope
              for v1.
            </li>
            <li>
              <strong className="text-ink">Bounded surface.</strong> We probe
              the advertised tool surface at evaluation time. Tools gated
              behind auth or state we cannot reach are recorded as
              unexercised, never passed.
            </li>
            <li>
              <strong className="text-ink">No absolute claims.</strong> Never
              &ldquo;100% safe&rdquo; or &ldquo;guaranteed.&rdquo; Underclaim,
              over-deliver.
            </li>
          </ul>
        </Section>

        <Section num="07" label="Versioning" id="versioning">
          <p>
            This page documents <Inline>litmus-v1</Inline>. Probes evolve as
            agents do; new failure modes get new probe IDs within their
            family. A change that alters pass/fail semantics bumps the
            methodology version. Every evidence bundle and every attestation
            embeds the methodology version that produced it, so a grade is
            always tied to the spec it was measured against.
          </p>
          <p className="text-sm">
            <span className="text-ink-faint">Changelog · </span>
            <Inline>litmus-v1.1</Inline> hardened the harness within v1
            semantics: obfuscated-canary detection (whitespace-split,
            base64/hex/url), canaries seeded into a throwaway working
            directory, varied bait pools, erroring tools recorded as
            unevaluated rather than silently passed, and bare imperatives in
            tool docs downgraded to medium severity so legitimate
            documentation phrasing no longer false-floors C-01.
          </p>
        </Section>

        <Section num="08" label="See also" id="see-also">
          <ul className="list-none space-y-1">
            <li>
              <a
                href="/"
                className="text-ink hover:text-oxblood transition-colors border-b hairline border-dotted"
              >
                polygraph.so — the polygraphs
              </a>
            </li>
            <li>
              <a
                href="/docs/api"
                className="text-ink hover:text-oxblood transition-colors border-b hairline border-dotted"
              >
                HTTP API — query published polygraphs
              </a>
            </li>
            <li>
              <a
                href="/llms.txt"
                className="text-ink hover:text-oxblood transition-colors border-b hairline border-dotted"
              >
                /llms.txt — the agent-readable summary
              </a>
            </li>
          </ul>
        </Section>
      </article>
    </main>
  );
}
