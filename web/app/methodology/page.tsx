import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Methodology — litmus-v10",
  description:
    "The litmus test, v10: a behavioral evaluation of MCP servers. Four checks — tool-output injection, permission overreach, sensitive-data handling, adversarial-input handling — graded A–F with reproducible evidence. Plus litmus-skill-v2: a static safety scan of Agent Skills, graded A/B/D/F.",
  alternates: { canonical: "/methodology" },
};

// Faithful rendering of litmus-test.md (polygraphso/hosted-service repo) — the
// authoritative methodologyVersion: "litmus-v10" spec. Content edits belong
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
      <article className="mx-auto max-w-3xl px-6 pt-14 pb-24 md:pt-20 md:pb-32">
        <header className="mb-14">
          <p className="section-label mb-4">
            Methodology · litmus-v10 · specification
          </p>
          <h1 className="font-serif text-4xl md:text-5xl text-ink tracking-tight leading-[1.05]">
            The litmus test
          </h1>
          <p className="mt-5 font-serif italic text-ink-muted text-lg md:text-xl leading-snug max-w-2xl">
            A behavioral evaluation of an MCP server — what it{" "}
            <em>does</em> when exercised the way an agent would, not what its
            README says. The string{" "}
            <Inline>methodologyVersion: &quot;litmus-v10&quot;</Inline> travels
            with every grade this spec produces. The same lab also grades{" "}
            <strong className="text-ink not-italic">Agent Skills</strong> under a
            separate static methodology, <Inline>litmus-skill-v2</Inline> —{" "}
            <a
              href="#skills"
              className="text-ink not-italic hover:text-oxblood transition-colors border-b hairline border-dotted"
            >
              §08
            </a>
            .
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
            licensing — this is a behavioral grade, not a quality or
            popularity score.
          </p>
          <SubHead>What a passing grade does — and does not — claim</SubHead>
          <p>
            It <strong className="text-ink">does</strong> claim: against{" "}
            <Inline>litmus-v10</Inline>, on the exact tool surface identified by
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
            Nine probes across four categories. Probe IDs are permanent and
            carry their family number; future probes extend a family without
            renumbering.
          </p>

          <SubHead>C-01 — Tool-output injection · probes 1.1, 1.2, 1.3</SubHead>
          <p>
            A server&rsquo;s tool descriptions and outputs flow straight into
            the calling agent&rsquo;s context — the documented &ldquo;tool
            poisoning&rdquo; attack class. <strong className="text-ink">Probe
            1.1</strong> pulls the full tool surface via{" "}
            <Inline>tools/list</Inline> and scans every name, description, and
            input schema. <strong className="text-ink">Probe 1.2</strong>{" "}
            issues bait calls — benign-but-suggestive inputs designed to elicit
            injection-shaped echoes — and scans every output.{" "}
            <strong className="text-ink">Probe 1.3</strong> (second-order) feeds
            one tool&rsquo;s output back in as another tool&rsquo;s input — the
            chaining path a real agent takes — and scans the result; only
            injection the server <em>generated</em> from that chained content
            fails, not a verbatim echo.
          </p>
          <p>
            Fails on any high-severity hit: instruction mimicry aimed at the
            agent (&ldquo;ignore previous instructions&rdquo;, role-tag or
            tool-call-shaped JSON in free text), hidden or invisible Unicode
            (zero-width, bidi overrides, tag characters), or markdown and link
            tricks (<Inline>javascript:</Inline> / <Inline>data:</Inline> URIs,
            link text contradicting the href, or a URL whose query string is
            exfiltration-shaped — a credential-named key, a long/high-entropy
            value, or an interpolation marker; an honest{" "}
            <Inline>?q=search</Inline> link is not flagged).
          </p>

          <SubHead>C-02 — Permission overreach · probes 2.1, 2.2</SubHead>
          <p>
            Does it touch more than it claimed — or label itself less capable
            than it is? <strong className="text-ink">Probe 2.1</strong>{" "}
            (declared-permission honesty) flags a tool that annotates itself{" "}
            <Inline>readOnlyHint: true</Inline> while it plainly mutates — caught
            three ways: an unambiguously destructive verb in its{" "}
            <strong className="text-ink">name</strong> (<Inline>delete</Inline>,{" "}
            <Inline>transfer</Inline>, <Inline>withdraw</Inline>, …), a{" "}
            <strong className="text-ink">parameter</strong> that names value
            movement or secrets (<Inline>recipient</Inline>,{" "}
            <Inline>amount</Inline>, <Inline>private_key</Inline>, …), or a{" "}
            <strong className="text-ink">description</strong> that admits it
            (&ldquo;transfers,&rdquo; &ldquo;deletes&rdquo;). An agent — and this
            harness — would otherwise auto-trust that read-only claim. Each layer
            is deliberately narrow: polysemous words like <Inline>create</Inline>,{" "}
            <Inline>update</Inline>, or <Inline>query</Inline> are not flagged,
            so an honest <Inline>create_query</Inline> is no false positive.
            Static and deterministic; needs no sandbox.
          </p>
          <p>
            <strong className="text-ink">Probe 2.2</strong> runs the server
            inside a default-deny network sandbox and exercises it. Egress is
            routed to a local sinkhole that logs{" "}
            <Inline>{`{host, port, firstBytes}`}</Inline> and never completes
            the connection — the evidence shows what it tried to reach. Each
            attempt is classified against an effective allowlist: the operator
            baseline plus the hosts the package <em>declares</em> it reaches
            (<Inline>polygraph.egress</Inline> in its manifest). Egress matching
            that list on <strong className="text-ink">host and port</strong> is
            permitted and recorded; anything beyond it — or a declared host
            reached on an undeclared port — is overreach and fails. A passing
            C-02 means <em>no overreach</em>, not <em>no network</em>; the
            declared hosts are surfaced in the evidence for the consumer to
            judge. A host-level DNAT gateway captures hard-coded IPs and DoH
            too, so an IP literal can&rsquo;t dodge the check.
          </p>
          <p>
            Probe 2.2 requires that the harness runs the server itself. For a
            remote MCP URL the harness cannot control the server&rsquo;s
            network, so 2.2 is recorded as{" "}
            <Inline>skipped — remote target</Inline>; without Docker it is{" "}
            <Inline>skipped — no sandbox</Inline> (a skip is not a pass). Probe
            2.1 is static and always runs — so C-02 can still fail on a remote
            target when a tool lies about being read-only.
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

          <SubHead>C-04 — Adversarial input handling · probes 3.1, 3.2</SubHead>
          <p>
            How the server holds up under hostile input.{" "}
            <strong className="text-ink">Probe 3.1</strong> stresses each tool
            with a deterministic battery of malformed and oversized arguments;
            it fails if the server crashes or hangs, or if its output spills an
            uncaught stack trace (an internals leak).{" "}
            <strong className="text-ink">Probe 3.2</strong> feeds known
            jailbreak patterns and scans the output — failing only if the server{" "}
            <em>amplifies</em> them into agent-directed injection of its own (a
            verbatim echo is excluded). A C-04 failure caps the grade at D. It
            is graded off-chain: it moves the overall letter, but the on-chain
            schema keeps its three per-category slots.
          </p>
        </Section>

        <Section num="03" label="Shared scanners" id="scanners">
          <p>
            The detection primitives behind C-01, C-03, and C-04, implemented
            once and applied uniformly: <Inline>invisibleUnicode</Inline>{" "}
            (zero-width, bidi-override, and tag-char codepoints, each reported
            with codepoint and byte offset), <Inline>instructionMimicry</Inline>{" "}
            (agent-directed imperatives, override and jailbreak framing,
            free-text tool-call JSON), <Inline>markdownTricks</Inline>{" "}
            (<Inline>javascript:</Inline>/<Inline>data:</Inline> URIs,
            link-text/href mismatch, exfiltration-shaped query strings),{" "}
            <Inline>internalsLeak</Inline> (uncaught stack-trace and crash
            signatures across Node, Python, Java, Go, Ruby, Rust, .NET, and
            PHP), and <Inline>canaryMatch</Inline> (exact and lightly-obfuscated
            matches — case, whitespace, simple encodings). A shared reflection
            check lets the second-order and jailbreak probes ignore content a
            tool merely echoed back. Scanners are pure functions over text:
            independently testable, and the place new failure modes get added.
          </p>
        </Section>

        <Section num="04" label="Grading rubric" id="rubric">
          <p>
            A single letter A&ndash;F, always accompanied by a rationale
            string — never a bare grade. Only four grades are reachable: C is
            reserved (no condition maps to it), and the scale skips E, as
            letter grades conventionally do.
          </p>
          <figure className="border hairline bg-parchment-50 mt-2">
            <figcaption className="px-4 py-2.5 border-b hairline font-mono text-[10.5px] uppercase tracking-[0.18em] text-ink-faint">
              Grade rubric · litmus-v10 §5
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
                  <td className="px-4 py-3">All four categories pass.</td>
                </tr>
                <tr className="border-b hairline align-top">
                  <td className="px-4 py-3 font-serif text-xl text-grade-b">B</td>
                  <td className="px-4 py-3">
                    C-01, C-03, and C-04 pass; C-02 <Inline>skipped</Inline> (no
                    sandbox or remote target). Egress was not verified —
                    capped by design.
                  </td>
                </tr>
                <tr className="border-b hairline align-top opacity-60">
                  <td className="px-4 py-3 font-serif text-xl text-grade-c">C</td>
                  <td className="px-4 py-3">
                    Reserved — no litmus-v10 condition maps to it. Future probe
                    categories may claim it.
                  </td>
                </tr>
                <tr className="border-b hairline align-top">
                  <td className="px-4 py-3 font-serif text-xl text-grade-d">D</td>
                  <td className="px-4 py-3">
                    C-02 or C-04 failure — egress overreach, a read-only lie, or
                    a crash / internals-leak / amplification — with no
                    C-01/C-03 failure.
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
            so they floor the grade at F. A C-02 failure (egress overreach or a
            read-only lie) or a C-04 failure (a crash, an internals-leak, or
            jailbreak amplification) is serious but not proven exfiltration or
            harm, so it caps at D. The B tier keeps the no-sandbox path usable
            while stating honestly that egress was not verified. Every grade
            carries its reasons in the evidence bundle.
          </p>
        </Section>

        <Section num="05" label="Reproducibility" id="reproducibility">
          <p>
            What makes a grade trustworthy rather than an assertion:
          </p>
          <ul className="list-none space-y-3">
            <li>
              <strong className="text-ink">Deterministic harness.</strong>{" "}
              Same server version + same <Inline>litmus-v10</Inline> harness →
              same findings. The bait, jailbreak, and malformed batteries are
              varied but fixed — no randomness in probe verdicts; timestamps
              and environment are recorded, not baked in.
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
              re-run <Inline>litmus-v10</Inline> against the same server and
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
            makes a lie falsifiable; the roadmap layers — independently
            verifiable grade records, and later hardware-attested runs — make
            it progressively unprofitable, then impossible.
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
            per-run-unique canary values, bait/jailbreak/malformed inputs drawn
            from varied (widened) but fixed pools, behavioral probes over real
            outputs rather than static reads, periodic re-attestation, and the
            live-fingerprint check at call time against bait-and-switch. Evasion
            is an explicitly acknowledged residual risk of v1.
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
            This page documents <Inline>litmus-v10</Inline>. Probes evolve as
            agents do; new failure modes get new probe IDs within their
            family. A change that alters pass/fail semantics bumps the
            methodology version. Every evidence bundle and every attestation
            embeds the methodology version that produced it, so a grade is
            always tied to the spec it was measured against — earlier{" "}
            <Inline>litmus-v1</Inline>…<Inline>v9</Inline> grades stay valid as
            their own version&rsquo;s results.
          </p>
          <p className="text-sm">
            <span className="text-ink-faint">Changelog · </span>
            <Inline>litmus-v10</Inline> narrows C-02 probe 2.1 so an honestly
            read-only data tool is no longer misread as lying about a mutation
            (the noun &ldquo;transfers,&rdquo; a bare destination address).{" "}
            <Inline>litmus-v9</Inline> stops C-04 probe 3.2 from flooring a
            server that merely echoes a hostile input back — only injection the
            server generates itself fails.{" "}
            <Inline>litmus-v8</Inline> and <Inline>litmus-v7</Inline> narrow the
            C-01 static scan so honest schemas and documentation (a parameter
            named <Inline>function</Inline>, an indented{" "}
            <Inline>system:</Inline> config key, ordinary role-tag prose) no
            longer read as injection. These four are false-positive precision
            fixes — each only turns a wrong fail into a correct pass, never the
            reverse.{" "}
            <Inline>litmus-v6</Inline> stops a tool that lies about being
            read-only from being actively bait-called (probe 2.1 still caps the
            lie at D).{" "}
            <Inline>litmus-v5</Inline> added C-01 probe 1.3 (second-order
            injection), made C-02 egress port-aware, and widened probe 2.1 to
            parameter- and description-evidenced read-only lies.{" "}
            <Inline>litmus-v4</Inline> made C-04 (adversarial input) a graded
            category — a crash, internals-leak, or jailbreak amplification caps
            the grade at D — and closed the hard-coded-IP egress gap with a
            host-DNAT gateway. <Inline>litmus-v3</Inline> reframed C-02 from
            default-deny to egress overreach: a server may reach hosts it
            declares, so a passing C-02 means no overreach, not no network.{" "}
            <Inline>litmus-v2</Inline> added C-02 probe 2.1 (declared-permission
            honesty). Each pass/fail-semantics change bumps the methodology
            version; earlier grades stay valid as their own version&rsquo;s
            results.
          </p>
        </Section>

        <Section num="08" label="Agent Skills · litmus-skill-v2" id="skills">
          <p>
            Everything above grades MCP servers by exercising them. Agent
            Skills are graded differently: a skill is content — a{" "}
            <Inline>SKILL.md</Inline> of instructions plus an optional bundle of
            files — and <Inline>litmus-skill-v2</Inline> is a{" "}
            <strong className="text-ink">static safety scan</strong> of that
            content. <strong className="text-ink">Nothing is executed.</strong>{" "}
            &ldquo;Agent Skills&rdquo; here means the <Inline>SKILL.md</Inline>{" "}
            format used by Claude Code, the Claude apps, the Agent SDK, and
            skill marketplaces — not arbitrary agent frameworks.
          </p>
          <p>
            It reads the skill the way an agent that loads it would, and asks
            one question:
          </p>
          <p className="font-serif text-xl text-ink leading-snug border-l-2 border-oxblood pl-4">
            Will loading this skill try to hijack me, tell me to leak data, or
            ship a dangerous command?
          </p>

          <SubHead>S-01 — Prompt injection / context poisoning</SubHead>
          <p>
            Scans the skill body for instructions aimed at the loading agent
            rather than the user&rsquo;s task — override and jailbreak framing,
            role-tag or tool-call-shaped text, hidden or invisible Unicode. The
            same instruction-mimicry and invisible-Unicode primitives the server
            checks use, applied to skill content.
          </p>

          <SubHead>S-03 — Data-exfiltration instructions</SubHead>
          <p>
            Flags a skill that instructs the agent to read secrets, credentials,
            or environment values and send them somewhere — the exfiltration
            pattern expressed as guidance the agent is meant to follow.
          </p>

          <SubHead>S-04 — Dangerous bundled commands</SubHead>
          <p>
            Inspects the bundled files for commands that would harm the host if
            run — a piped <Inline>curl | bash</Inline>, a reverse shell, and the
            like. The scripts are read, never run; this is a static read of what
            the bundle would do, not a record of what it did.
          </p>

          <SubHead>Grade</SubHead>
          <p>
            A single letter on a strict <Inline>A / B / D / F</Inline> scale —
            skills have <strong className="text-ink">no C tier</strong>, the
            same skipped letter as the server scale. A clean scan across all
            three checks is A. A skill with no bundle to read leaves S-04
            unverified — injection and exfiltration still pass, but a check
            could not run — so it caps at B, stated honestly rather than
            rounded up. A dangerous bundled command (S-04) caps at D; an
            injection or exfiltration hit (S-01 or S-03) floors at F. The grade
            is reproducible: the methodology is open and the letter is
            deterministic, and the skill is content-hashed so a grade ties to
            the exact bytes it measured.
          </p>

          <SubHead>What an A claims — and does not</SubHead>
          <p>
            An A is a <strong className="text-ink">clean static scan</strong>,{" "}
            <strong className="text-ink">not behavioral proof</strong>. A static
            read cannot catch a command built or fetched at runtime, and bundled
            scripts are read but never executed — both are out of scope by
            construction. The grade is a measurement of the skill&rsquo;s
            content as written, not an accusation against it nor an endorsement
            of it. We underclaim here too.
          </p>
          <p className="text-sm">
            <span className="text-ink-faint">Advisory · </span>A separate,
            model-judged <em>honesty</em> signal can be reported alongside the
            letter — does the skill do what its description claims? It is
            non-deterministic, kept apart from the <Inline>A / B / D / F</Inline>{" "}
            grade, and never minted.
          </p>
          <p className="text-sm">
            <span className="text-ink-faint">Run it yourself · </span>
            <Inline>
              npx -p @polygraphso/litmus polygraphso-litmus-skill
              &lt;path-to-skill&gt;
            </Inline>{" "}
            — zero-install, or the <Inline>run_skill_litmus</Inline> MCP tool.
            (The MCP-server grader is the separate{" "}
            <Inline>polygraphso-litmus</Inline> / <Inline>run_litmus</Inline>.)
          </p>
        </Section>

        <Section num="09" label="See also" id="see-also">
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
