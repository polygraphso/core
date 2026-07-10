import type { Metadata } from "next";
import Link from "next/link";
import { loadClawhubSkills, CLAWHUB_COHORT_ORDER, CLAWHUB_COHORT_LABEL } from "@/lib/clawhubIndex";
import { SkillEcosystemTable, type SkillEcosystemConfig } from "@/app/_components/SkillEcosystemTable";

/**
 * UNLISTED ClawHub index. Not linked from nav/footer, not in any sitemap, robots
 * noindex — reachable only by direct link. Reads grades live from hosted_runs
 * (grade-only, any publish state) via the shared skill-ecosystem loader. The malware
 * cohort is graded by a STATIC scan (no execution).
 */
export const metadata: Metadata = {
  title: "ClawHub skills index — polygraph (private)",
  robots: { index: false, follow: false },
};

// Cache for 1 hour — grades update at most daily.
export const revalidate = 3600;

const CONFIG: SkillEcosystemConfig = {
  methodologyLabel: "litmus-skill-v3",
  title: "ClawHub skills index",
  blurb:
    "Static safety grades for skills distributed through ClawHub — including the malicious skills Snyk documented, graded next to the popular ones an agent would actually install.",
  cohortOrder: CLAWHUB_COHORT_ORDER,
  cohortLabel: CLAWHUB_COHORT_LABEL,
  methodologyNote: (
    <>
      <p>
        Each skill is graded by <strong className="text-ink">litmus-skill-v2</strong>, a deterministic STATIC
        scan of its <code className="font-mono text-[12px]">SKILL.md</code> + bundle:{" "}
        <strong className="text-ink">S-01</strong> prompt-injection / context-poisoning,{" "}
        <strong className="text-ink">S-03</strong> data-exfiltration instructions, and{" "}
        <strong className="text-ink">S-04</strong> dangerous bundled commands. The scan reads the files — it
        never runs them — so the malicious skills below are safe to grade.
      </p>
      <p className="mt-2 text-ink-faint">
        Snyk&rsquo;s <em>ToxicSkills</em> analysis of 3,984 skills across ClawHub and skills.sh found{" "}
        <strong className="text-ink-muted">36.8%</strong> carried at least one security flaw,{" "}
        <strong className="text-ink-muted">13.4%</strong> critical, and{" "}
        <strong className="text-ink-muted">76</strong> confirmed malicious payloads — several still live at
        publication. The flagged cohort here each ships a fake &ldquo;prerequisites&rdquo; step that runs a
        base64-decoded <code className="font-mono">curl | bash</code> written into the SKILL.md; the litmus
        grades them <strong className="text-ink-muted">D</strong> on the static text alone.
      </p>
      <p className="mt-2 text-ink-faint">
        Static scanning has a disclosed edge: a sibling of these skills that instead tells the agent to
        &ldquo;visit this link and run the command it shows&rdquo;, or hides the payload in a bundled archive,
        keeps its dangerous command out of the scanned bytes and grades clean. That gap — a command fetched
        or assembled at runtime — is precisely why a static grade is a floor, not a guarantee, and why the
        behavioral harness and continuous re-grading matter. Grades are read live from hosted_runs and none
        are published onchain.
      </p>
    </>
  ),
  cta: {
    heading: "Monitor the ClawHub registry.",
    body: "This index is a snapshot. We re-grade ClawHub skills on a cadence and flag regressions — a newly bundled command, a changed content hash, a fresh malicious upload — as the registry ships. Set up per registry.",
    mailtoSubject: "Monitor ClawHub with polygraph",
  },
  footer: (
    <>
      Skills: S-01 prompt-injection · S-03 exfil instructions · S-04 dangerous bundled commands (static,
      content-hash anchored). Reproduce a skill grade with{" "}
      <code className="font-mono">npx -p @polygraphso/litmus polygraphso-litmus-skill &lt;dir&gt;</code>. Incident source:{" "}
      <Link
        target="_blank" rel="noreferrer" href="https://snyk.io/blog/toxicskills-malicious-ai-agent-skills-clawhub/"
        className="underline decoration-dotted underline-offset-2 hover:text-oxblood transition-colors"
      >
        Snyk ToxicSkills
      </Link>{" "}
      · each row links to its polygraph skill report.
    </>
  ),
};

export default async function ClawhubIndexPage() {
  const skills = await loadClawhubSkills();
  return <SkillEcosystemTable config={CONFIG} skills={skills} />;
}
