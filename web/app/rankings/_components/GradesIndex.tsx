import Link from "next/link";
import { GRADE_HEX } from "@/lib/gradeColors";
import type { RankingRow } from "@/lib/rankings";
import type { SkillIndexRow } from "@/lib/skillGrades";
import { RankingsTable } from "./RankingsTable";
import { SkillsTable } from "./SkillsTable";
import { TabToggle } from "./TabToggle";

function GlyphKey() {
  return (
    <>
      <span>
        <span style={{ color: GRADE_HEX.A }}>✓</span> pass
      </span>
      <span>
        <span style={{ color: "var(--color-oxblood)" }}>✕</span> fail
      </span>
      <span>
        <span className="text-ink-faint">–</span> not run
      </span>
    </>
  );
}

export function GradesIndex({
  serverRows,
  skillRows,
}: {
  serverRows: RankingRow[];
  skillRows: SkillIndexRow[];
}) {
  const mcpPanel = (
    <>
      <RankingsTable rows={serverRows} />
      <p className="mt-5 flex flex-wrap gap-x-5 gap-y-1 font-mono text-[11px] text-ink-faint leading-relaxed">
        <GlyphKey />
        <span className="text-ink-faint/80">
          C-01 tool-output injection · C-02 egress overreach · C-03 sensitive-data handling ·
          C-04 adversarial-input handling
        </span>
      </p>
      <p className="mt-10 text-ink-faint text-xs leading-relaxed max-w-2xl">
        Ranked by the <span className="text-ink-muted">adoption score</span> (0–100, shown at
        right above monthly downloads) — a composite of downloads (npm / PyPI), GitHub stars,
        dependents and release velocity. It measures{" "}
        <span className="text-ink-muted">reach, not safety</span>: the litmus grade is the only
        safety verdict. Grades come from the open litmus harness; you can{" "}
        <Link href="/request" className="border-b hairline border-dotted hover:text-oxblood">
          request a grade
        </Link>{" "}
        for a server, or read the{" "}
        <Link href="/methodology" className="border-b hairline border-dotted hover:text-oxblood">
          methodology
        </Link>
        .
      </p>
    </>
  );

  const skillPanel = (
    <>
      <SkillsTable rows={skillRows} />
      <p className="mt-5 flex flex-wrap gap-x-5 gap-y-1 font-mono text-[11px] text-ink-faint leading-relaxed">
        <GlyphKey />
        <span className="text-ink-faint/80">
          S-01 prompt-injection · S-03 data-exfiltration instructions · S-04 dangerous bundled
          commands
        </span>
      </p>
      <p className="mt-10 text-ink-faint text-xs leading-relaxed max-w-2xl">
        Skills are graded by a <span className="text-ink-muted">static safety scan</span>{" "}
        (litmus-skill-v2) of the <span className="font-mono text-[0.92em]">SKILL.md</span>{" "}
        and its bundled files — A/B/D/F, no adoption ranking. It reads the skill&rsquo;s text, not
        its runtime behavior, so it&rsquo;s a static read rather than behavioral proof. Read the{" "}
        <Link href="/methodology" className="border-b hairline border-dotted hover:text-oxblood">
          methodology
        </Link>
        .
      </p>
    </>
  );

  return (
    <TabToggle
      mcpCount={serverRows.length}
      skillCount={skillRows.length}
      mcpPanel={mcpPanel}
      skillPanel={skillPanel}
    />
  );
}
