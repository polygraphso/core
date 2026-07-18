import type { Metadata } from "next";
import Link from "next/link";
import { JsonLd } from "@/app/_components/JsonLd";
import { SITE_ORIGIN, METHODOLOGY_VERSION, SKILL_METHODOLOGY_VERSION } from "@/lib/site";

// The entity-grounding page: who publishes the grades, how the lab is funded,
// and where independence comes from. Every claim here restates copy that
// already exists on /methodology, the homepage funding note, or llms.txt —
// this page consolidates it at the URL search engines and LLMs expect
// ("/about" was a 404 until 2026-07). Team bios are deliberately absent until
// there are named authors to stand behind them.
export const metadata: Metadata = {
  title: "About",
  description:
    "polygraph.so is an independent lab publishing behavioral security grades for MCP servers and static safety grades for Agent Skills. Nobody can pay for a grade.",
  alternates: { canonical: "/about" },
  openGraph: {
    title: "About · polygraph.so",
    description:
      "An independent lab publishing behavioral security grades for MCP servers and static safety grades for Agent Skills. Nobody can pay for a grade.",
    url: "/about",
  },
};

const aboutJsonLd = {
  "@context": "https://schema.org",
  "@type": "AboutPage",
  url: `${SITE_ORIGIN}/about`,
  mainEntity: { "@id": `${SITE_ORIGIN}/#org` },
};

function Section({
  num,
  label,
  children,
}: {
  num: string;
  label: string;
  children: React.ReactNode;
}) {
  return (
    <section className="mt-14 first:mt-0">
      <div className="flex items-baseline gap-3 mb-4">
        <span className="font-mono text-[11px] uppercase tracking-[0.18em] text-ink-faint tabular">
          {num}
        </span>
        <h2 className="font-serif text-2xl md:text-3xl text-ink tracking-tight">{label}</h2>
      </div>
      <div className="space-y-4 text-[15px] text-ink-muted leading-relaxed max-w-2xl">
        {children}
      </div>
    </section>
  );
}

export default function AboutPage() {
  return (
    <article className="mx-auto max-w-3xl">
      <JsonLd data={aboutJsonLd} />
      <header className="mb-12">
        <p className="section-label mb-4">About · the lab</p>
        <h1 className="font-serif text-4xl md:text-5xl text-ink tracking-tight leading-[1.05]">
          An independent lab for AI-tool trust.
        </h1>
        <p className="mt-5 font-serif italic text-ink-muted text-lg md:text-xl leading-snug max-w-2xl">
          polygraph.so publishes behavioral security grades for MCP servers and
          static safety grades for Claude Code / Agent Skills — backed by
          evidence anyone can re-run.
        </p>
      </header>

      <Section num="01" label="What we do">
        <p>
          Agents plug into third-party MCP servers and skills that can hijack
          them or leak data. We connect to those tools the way an agent would,
          exercise them, and watch what they actually do: whether their outputs
          try to hijack the caller, whether they reach out over the network when
          nothing required it, and whether data handed to them leaks back out.
          The result is a letter grade, A to F, published with the evidence
          behind it.
        </p>
        <p>
          Servers are graded behaviorally by the open litmus harness (
          {METHODOLOGY_VERSION}); skills are graded by a deterministic static
          scan ({SKILL_METHODOLOGY_VERSION}). The full spec, including what a
          grade does and does not claim, is on the{" "}
          <Link
            href="/methodology"
            className="text-ink border-b hairline border-dotted hover:text-oxblood transition-colors"
          >
            methodology page
          </Link>
          . Every published grade lives in{" "}
          <Link
            href="/mcp-index"
            className="text-ink border-b hairline border-dotted hover:text-oxblood transition-colors"
          >
            the public index
          </Link>
          , free to read.
        </p>
      </Section>

      <Section num="02" label="Why a grade can be trusted">
        <p>
          The harness is open source and deterministic: the same server version
          and the same harness produce the same findings. Anyone — a skeptic, a
          counterparty, a graded vendor — can re-run it against the same server
          and compare. A false grade is falsifiable, not merely disputable. That
          reproducibility, plus a live fingerprint check that catches a server
          changing its tool surface after grading, is what the grade rests on.
        </p>
        <p>
          The harness code is public at{" "}
          <a
            href="https://github.com/polygraphso/litmus"
            target="_blank"
            rel="noreferrer"
            className="text-ink border-b hairline border-dotted hover:text-oxblood transition-colors"
          >
            github.com/polygraphso/litmus
          </a>{" "}
          and ships on npm as <code className="font-mono text-[13px]">@polygraphso/litmus</code>.
        </p>
      </Section>

      <Section num="03" label="Independence and funding">
        <p>
          Nobody can pay for a grade. No graded party gets review or approval
          rights over their result, and significant failures go to the vendor
          before they go public. Independence here is disclosure-based, not
          refusal-based: material relationships are stated publicly rather than
          pretended away.
        </p>
        <p>
          The work is funded away from the grades. Public grades are free to
          read; ecosystem operators pay for continuous, per-network monitoring
          (see{" "}
          <Link
            href="/ecosystems"
            className="text-ink border-b hairline border-dotted hover:text-oxblood transition-colors"
          >
            ecosystems
          </Link>
          ), and the community-launched $POLYGRAPH token&rsquo;s dev fees are
          claimed publicly and put toward the harness, the grades, and the
          evidence. The token funds the work; it doesn&rsquo;t move a grade.
        </p>
      </Section>

      <Section num="04" label="Who runs it">
        <p>
          polygraph.so is built by the team behind{" "}
          <a
            href="https://talentprotocol.com"
            target="_blank"
            rel="noreferrer"
            className="text-ink border-b hairline border-dotted hover:text-oxblood transition-colors"
          >
            Talent Protocol
          </a>
          . Reach us at{" "}
          <a
            href="mailto:hello@polygraph.so"
            className="text-ink border-b hairline border-dotted hover:text-oxblood transition-colors"
          >
            hello@polygraph.so
          </a>{" "}
          or{" "}
          <a
            href="https://x.com/polygraphso"
            target="_blank"
            rel="noreferrer"
            className="text-ink border-b hairline border-dotted hover:text-oxblood transition-colors"
          >
            @polygraphso
          </a>
          .
        </p>
      </Section>
    </article>
  );
}
