import type { Metadata } from "next";
import Link from "next/link";
import { loadSkillsShSkills, SKILLS_SH_COHORT_ORDER, SKILLS_SH_COHORT_LABEL } from "@/lib/skillsShIndex";
import { SkillEcosystemTable, type SkillEcosystemConfig } from "@/app/_components/SkillEcosystemTable";

/**
 * UNLISTED skills.sh index. Not linked from nav/footer, not in any sitemap, robots
 * noindex — reachable only by direct link. Reads grades live from hosted_runs
 * (grade-only, any publish state) via the shared skill-ecosystem loader.
 */
export const metadata: Metadata = {
  title: "skills.sh index — polygraph (private)",
  robots: { index: false, follow: false },
};

// Cache for 1 hour — grades update at most daily.
export const revalidate = 3600;

const CONFIG: SkillEcosystemConfig = {
  methodologyLabel: "litmus-skill-v3",
  title: "skills.sh index",
  blurb:
    "Static safety grades for the most-installed skills on skills.sh — Vercel’s open Agent Skills directory. A behavioral A–F verdict alongside the directory’s existing dependency alerts.",
  cohortOrder: SKILLS_SH_COHORT_ORDER,
  cohortLabel: SKILLS_SH_COHORT_LABEL,
  methodologyNote: (
    <>
      <p>
        Each skill is graded by <strong className="text-ink">litmus-skill-v2</strong>, a deterministic STATIC
        scan of its <code className="font-mono text-[12px]">SKILL.md</code> + bundle:{" "}
        <strong className="text-ink">S-01</strong> prompt-injection / context-poisoning,{" "}
        <strong className="text-ink">S-03</strong> data-exfiltration instructions, and{" "}
        <strong className="text-ink">S-04</strong> dangerous bundled commands. An A means static-clean, not
        behavioral proof — a skill&rsquo;s instructions are interpreted by an agent at runtime.
      </p>
      <p className="mt-2 text-ink-faint">
        skills.sh already links each listing to its public GitHub source and surfaces dependency alerts from
        Socket, Snyk, and Gen — but not a behavioral safety grade. This index adds one over a curated top
        cohort. Every grade is read live from its hosted_runs row — reproduce any with{" "}
        <code className="font-mono">npx -p @polygraphso/litmus polygraphso-litmus-skill</code> — and none are
        published onchain.
      </p>
    </>
  ),
  cta: {
    heading: "Monitor the skills.sh directory.",
    body: "This index is a snapshot of the top cohort. We re-grade skills.sh listings on a cadence and flag regressions — a dropped grade, a newly failing check, a changed content hash — as the directory ships. Set up per registry.",
    mailtoSubject: "Monitor skills.sh with polygraph",
  },
  footer: (
    <>
      Skills: S-01 prompt-injection · S-03 exfil instructions · S-04 dangerous bundled commands (static,
      content-hash anchored). Reproduce a skill grade with{" "}
      <code className="font-mono">npx -p @polygraphso/litmus polygraphso-litmus-skill &lt;dir&gt;</code>. Source:{" "}
      <Link
        href="https://skills.sh"
        className="underline decoration-dotted underline-offset-2 hover:text-oxblood transition-colors"
      >
        skills.sh
      </Link>{" "}
      · each row links to its polygraph skill report.
    </>
  ),
};

export default async function SkillsShIndexPage() {
  const skills = await loadSkillsShSkills();
  return <SkillEcosystemTable config={CONFIG} skills={skills} />;
}
