import type { Metadata } from "next";
import Link from "next/link";
import { loadUniswapSkills, UNISWAP_COHORT_ORDER, UNISWAP_COHORT_LABEL } from "@/lib/uniswapIndex";
import { SkillEcosystemTable, type SkillEcosystemConfig } from "@/app/_components/SkillEcosystemTable";

/**
 * UNLISTED Uniswap-skills index. Not linked from nav/footer, not in any sitemap,
 * robots noindex — reachable only by direct link. Reads grades live from hosted_runs
 * (grade-only, any publish state) via the shared skill-ecosystem loader. Scope note:
 * these are community "build on Uniswap" skills in the Bankr library, not Uniswap's own.
 */
export const metadata: Metadata = {
  title: "Uniswap builder-skills index — polygraph (private)",
  robots: { index: false, follow: false },
};

// Cache for 1 hour — grades update at most daily.
export const revalidate = 3600;

const CONFIG: SkillEcosystemConfig = {
  methodologyLabel: "litmus-skill-v3",
  title: "Uniswap builder skills",
  blurb:
    "Static safety grades for the skills an agent loads to build on Uniswap — Uniswap Labs’ own uniswap-ai plugins, standalone community skills, and the Bankr library’s set: v4 hooks, trading, and integration helpers.",
  cohortOrder: UNISWAP_COHORT_ORDER,
  cohortLabel: UNISWAP_COHORT_LABEL,
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
        Skills come from three sources: Uniswap Labs&rsquo; official{" "}
        <code className="font-mono text-[12px]">uniswap-ai</code> monorepo, standalone community repos, and the
        Bankr skill library. A grade scans the skill text; it is not an audit of Uniswap&rsquo;s contracts.
        Every grade here is read live from its hosted_runs row — reproduce any of them with{" "}
        <code className="font-mono">npx -p @polygraphso/litmus polygraphso-litmus-skill</code> — and none are
        published onchain.
      </p>
    </>
  ),
  cta: {
    heading: "Monitor the Uniswap builder-skill surface.",
    body: "This index is a snapshot. We re-grade the Uniswap builder skills on a cadence and flag regressions — a dropped grade, a newly failing check, a changed content hash — as the library ships. Set up per ecosystem.",
    mailtoSubject: "Monitor the Uniswap builder skills with polygraph",
  },
  footer: (
    <>
      Skills: S-01 prompt-injection · S-03 exfil instructions · S-04 dangerous bundled commands (static,
      content-hash anchored). Reproduce a skill grade with{" "}
      <code className="font-mono">npx -p @polygraphso/litmus polygraphso-litmus-skill &lt;dir&gt;</code>. Sources:{" "}
      <Link
        href="https://github.com/Uniswap/uniswap-ai"
        className="underline decoration-dotted underline-offset-2 hover:text-oxblood transition-colors"
      >
        Uniswap/uniswap-ai
      </Link>{" "}
      ·{" "}
      <Link
        href="https://github.com/BankrBot/skills"
        className="underline decoration-dotted underline-offset-2 hover:text-oxblood transition-colors"
      >
        BankrBot/skills
      </Link>
      .
    </>
  ),
};

export default async function UniswapIndexPage() {
  const skills = await loadUniswapSkills();
  return <SkillEcosystemTable config={CONFIG} skills={skills} />;
}
