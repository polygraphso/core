import Link from "next/link";
import type { ReactNode } from "react";

/**
 * The closing FAQ on a grade report — a plain-language "what does this grade
 * mean / what was tested / how do I check it / says who?" block. Two jobs:
 * answer the reader's obvious questions inline, and give search engines a
 * programmatic-SEO surface (one FAQ per graded ref) plus FAQPage JSON-LD for
 * rich results. Rendered only on graded, indexable reports.
 *
 * Shared by /mcp (behavioral, C-01…C-04) and /skill (static, S-01/S-03/S-04);
 * `kind` selects the question set. The visible answer and the JSON-LD answer
 * stay in lockstep — `text` is the plain-text mirror of `body`.
 */
type Kind = "mcp" | "skill";

interface QA {
  q: string;
  /** Plain-text answer for the FAQPage JSON-LD (mirrors the visible answer). */
  text: string;
  /** Rendered answer; may carry internal links. */
  body: ReactNode;
}

const methodologyLink = (label: string, hash = "") => (
  <Link
    href={`/methodology${hash}`}
    className="text-ink border-b hairline border-dotted hover:text-oxblood transition-colors"
  >
    {label}
  </Link>
);

function mcpFaq(subject: string, grade: string): QA[] {
  return [
    {
      q: `What does polygraph's ${grade} grade mean for ${subject}?`,
      text: `It's a behavioral grade on an A–F scale. polygraph connected to ${subject} the way an agent would, exercised its tools, and watched what it did — whether it tried to hijack the caller, send data off-box, leak planted secrets, or mishandle adversarial input. ${grade} is where that evidence placed it. It describes behavior on the day it ran, not a guarantee.`,
      body: (
        <>
          It&rsquo;s a {methodologyLink("behavioral grade")} on an A–F scale. polygraph connected to{" "}
          <span className="font-mono text-[12.5px]">{subject}</span> the way an agent would, exercised
          its tools, and watched what it did — whether it tried to hijack the caller, send data
          off-box, leak planted secrets, or mishandle adversarial input.{" "}
          <span className="text-ink">{grade}</span> is where that evidence placed it. It describes
          behavior on the day it ran, not a guarantee.
        </>
      ),
    },
    {
      q: "What did polygraph test?",
      text: "Four probe categories run against the live server in a sandbox: C-01 tool-output injection, C-02 permission and egress overreach, C-03 sensitive-data handling, and C-04 adversarial-input handling.",
      body: (
        <>
          Four probe categories, run against the live server in a sandbox: C-01 tool-output
          injection, C-02 permission and egress overreach, C-03 sensitive-data handling, and C-04
          adversarial-input handling. The full battery is in the {methodologyLink("methodology")}.
        </>
      ),
    },
    {
      q: "How do I reproduce this grade?",
      text: `Run: npx -p @polygraphso/litmus polygraphso-litmus ${subject}. The harness is open and deterministic, so anyone can re-run it against the same server and disprove a false grade — reproducibility is what the grade rests on.`,
      body: (
        <>
          Run{" "}
          <code className="font-mono text-[12.5px] text-ink">
            npx -p @polygraphso/litmus polygraphso-litmus {subject}
          </code>
          . The harness is open and deterministic, so anyone can re-run it against the same server
          and {methodologyLink("disprove a false grade", "#reproducibility")} — reproducibility is
          what the grade rests on.
        </>
      ),
    },
    {
      q: "Can a server pay polygraph for a better grade?",
      text: "No. Independence is disclosure-based: material support must be publicly registered, and no graded party gets review or approval rights over its letter. The grade is set by the evidence, not the relationship.",
      body: (
        <>
          No. Independence is disclosure-based: material support must be publicly registered, and no
          graded party gets review or approval rights over its letter. The grade is set by the
          evidence, not the relationship.
        </>
      ),
    },
  ];
}

function skillFaq(subject: string, grade: string): QA[] {
  return [
    {
      q: `What does the ${grade} skill grade mean for ${subject}?`,
      text: `It's a static safety grade (A/B/D/F) from a deterministic scan of the skill's SKILL.md and bundled files. An A means static-clean — not behavioral proof, since a skill's instructions are interpreted by an agent at runtime.`,
      body: (
        <>
          It&rsquo;s a {methodologyLink("static safety grade")} (A/B/D/F) from a deterministic scan of
          the skill&rsquo;s <code className="font-mono text-[12.5px]">SKILL.md</code> and bundled
          files. An A means static-clean — <span className="text-ink">not behavioral proof</span>,
          since a skill&rsquo;s instructions are interpreted by an agent at runtime.
        </>
      ),
    },
    {
      q: "What did polygraph check?",
      text: "Three static checks: S-01 prompt-injection and context-poisoning, S-03 data-exfiltration instructions, and S-04 dangerous bundled commands.",
      body: (
        <>
          Three static checks: S-01 prompt-injection and context-poisoning, S-03 data-exfiltration
          instructions, and S-04 dangerous bundled commands. The full battery is in the{" "}
          {methodologyLink("methodology")}.
        </>
      ),
    },
    {
      q: "How do I reproduce this grade?",
      text: `Run: npx -p @polygraphso/litmus polygraphso-litmus-skill <skill-dir>. The scan is open and deterministic, anchored to the skill's content hash, so the same directory yields the same grade.`,
      body: (
        <>
          Run{" "}
          <code className="font-mono text-[12.5px] text-ink">
            npx -p @polygraphso/litmus polygraphso-litmus-skill &lt;skill-dir&gt;
          </code>
          . The scan is open and deterministic, anchored to the skill&rsquo;s content hash, so the
          same directory yields the same grade.
        </>
      ),
    },
  ];
}

export function ReportFaq({
  kind,
  subject,
  grade,
}: {
  kind: Kind;
  subject: string;
  grade: string;
}) {
  const items = kind === "mcp" ? mcpFaq(subject, grade) : skillFaq(subject, grade);
  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    mainEntity: items.map((it) => ({
      "@type": "Question",
      name: it.q,
      acceptedAnswer: { "@type": "Answer", text: it.text },
    })),
  };

  return (
    <section className="mt-12 border-t hairline pt-6">
      <h2 className="font-serif text-lg text-ink mb-4">Questions</h2>
      <dl className="space-y-5">
        {items.map((it) => (
          <div key={it.q}>
            <dt className="font-sans text-[14px] text-ink leading-snug">{it.q}</dt>
            <dd className="mt-1.5 font-sans text-[13px] text-ink-muted leading-relaxed max-w-xl">
              {it.body}
            </dd>
          </div>
        ))}
      </dl>
      <script
        type="application/ld+json"
        // JSON.stringify escapes the one XSS vector (</script>) via <; content is our own copy.
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />
    </section>
  );
}
