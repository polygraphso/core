// web/lib/skillGrades.test.ts
import { describe, it, expect } from "vitest";
import {
  skillRefToPath,
  decodeSkillRef,
  githubUrlForSkillRef,
  githubUrlToSkillRef,
  normalizeSkillInput,
  skillDisplayName,
  detailFromSkillRow,
  SKILL_CATEGORIES,
  type SkillGradeRow,
} from "./skillGrades";

describe("githubUrlToSkillRef", () => {
  it("parses a blob SKILL.md URL, dropping the ref and SKILL.md", () => {
    expect(
      githubUrlToSkillRef("https://github.com/polygraphso/litmus/blob/main/plugins/polygraph/skills/polygraph/SKILL.md"),
    ).toBe("github/polygraphso/litmus#plugins/polygraph/skills/polygraph");
  });
  it("parses a tree URL (skill directory, no SKILL.md)", () => {
    expect(githubUrlToSkillRef("https://github.com/BankrBot/skills/tree/main/bankr")).toBe(
      "github/BankrBot/skills#bankr",
    );
  });
  it("drops a trailing slash and a ?query/#fragment", () => {
    expect(githubUrlToSkillRef("https://github.com/o/r/blob/abc123/a/b/SKILL.md?plain=1")).toBe("github/o/r#a/b");
  });
  it("returns null for non-github or non-blob/tree URLs", () => {
    expect(githubUrlToSkillRef("https://example.com/x/y/blob/main/z")).toBeNull();
    expect(githubUrlToSkillRef("https://github.com/o/r")).toBeNull();
    expect(githubUrlToSkillRef("github/o/r#a")).toBeNull();
  });
});

describe("normalizeSkillInput", () => {
  it("canonicalizes a full SKILL.md URL", () => {
    expect(normalizeSkillInput("https://github.com/BankrBot/skills/blob/main/bankr/SKILL.md")).toBe(
      "github/BankrBot/skills#bankr",
    );
  });
  it("passes an already-canonical ref through, and converts the slash form", () => {
    expect(normalizeSkillInput("github/BankrBot/skills#bankr")).toBe("github/BankrBot/skills#bankr");
    expect(normalizeSkillInput("github/BankrBot/skills/bankr")).toBe("github/BankrBot/skills#bankr");
  });
  it("returns the trimmed input when it isn't a skill", () => {
    expect(normalizeSkillInput("  npm/foo  ")).toBe("npm/foo");
  });
});

describe("skillRefToPath", () => {
  it("turns the `#` subpath separator into a path segment", () => {
    expect(skillRefToPath("github/BankrBot/skills#zerion")).toBe("github/BankrBot/skills/zerion");
  });
  it("only rewrites the first `#` (subpaths never contain another)", () => {
    expect(skillRefToPath("github/o/r#a/b")).toBe("github/o/r/a/b");
  });
  it("passes a repo-level ref through unchanged", () => {
    expect(skillRefToPath("github/o/r")).toBe("github/o/r");
  });
});

describe("decodeSkillRef", () => {
  it("reconstructs the canonical `#` target from a path", () => {
    expect(decodeSkillRef("github/BankrBot/skills/zerion")).toBe("github/BankrBot/skills#zerion");
  });
  it("rejoins a multi-segment subpath under the repo", () => {
    expect(decodeSkillRef("github/o/r/a/b")).toBe("github/o/r#a/b");
  });
  it("keeps an already-canonical ref (literal `#`) as-is", () => {
    expect(decodeSkillRef("github/o/r#x")).toBe("github/o/r#x");
  });
  it("treats a bare 3-segment github ref as a repo-level skill", () => {
    expect(decodeSkillRef("github/o/r")).toBe("github/o/r");
  });
  it("tolerates a trailing slash", () => {
    expect(decodeSkillRef("github/BankrBot/skills/zerion/")).toBe("github/BankrBot/skills#zerion");
  });
  it("round-trips with skillRefToPath", () => {
    const t = "github/BankrBot/skills#base-account";
    expect(decodeSkillRef(skillRefToPath(t))).toBe(t);
  });
  it("returns null for missing, empty, non-github, or too-short input", () => {
    expect(decodeSkillRef(null)).toBeNull();
    expect(decodeSkillRef("")).toBeNull();
    expect(decodeSkillRef("npm/@scope/name")).toBeNull();
    expect(decodeSkillRef("github/owner")).toBeNull();
  });
});

describe("githubUrlForSkillRef", () => {
  it("links a subpath skill into its tree on the default branch", () => {
    expect(githubUrlForSkillRef("github/BankrBot/skills#zerion")).toBe(
      "https://github.com/BankrBot/skills/tree/main/zerion",
    );
  });
  it("links a repo-level skill to the repo root", () => {
    expect(githubUrlForSkillRef("github/o/r")).toBe("https://github.com/o/r");
  });
  it("returns null for a non-github ref", () => {
    expect(githubUrlForSkillRef("npm/@scope/name")).toBeNull();
  });
});

describe("skillDisplayName", () => {
  it("uses the subpath after `#`", () => {
    expect(skillDisplayName("github/BankrBot/skills#zerion")).toBe("zerion");
  });
  it("falls back to the last path segment for a repo-level ref", () => {
    expect(skillDisplayName("github/o/my-skill")).toBe("my-skill");
  });
});

function row(partial: Partial<SkillGradeRow>): SkillGradeRow {
  return {
    target: "github/BankrBot/skills#example",
    grade: "A",
    content_hash: "0xabc",
    evidence: { methodologyVersion: "litmus-skill-v2", categories: [] },
    completed_at: "2026-06-25T14:00:00Z",
    commit_sha: null,
    commit_at: null,
    ...partial,
  };
}

describe("detailFromSkillRow", () => {
  it("builds the grade + the three canonical categories from the evidence bundle", () => {
    const result = detailFromSkillRow(
      row({
        target: "github/BankrBot/skills#gitlawb",
        grade: "D",
        content_hash: "0xdeadbeef",
        evidence: {
          methodologyVersion: "litmus-skill-v2",
          categories: [
            { code: "S-01", status: "pass", findings: [] },
            { code: "S-03", status: "pass", findings: [] },
            {
              code: "S-04",
              status: "fail",
              findings: [
                {
                  file: "scripts/setup.sh",
                  kind: "dangerous-command",
                  match: "curl -sSf https://x/install.sh | sh",
                  severity: "high",
                },
              ],
            },
          ],
        },
      }),
    );
    expect(result).not.toBeNull();
    expect(result!.grade).toBe("D");
    const detail = result!.detail;
    expect(detail.methodology_version).toBe("litmus-skill-v2");
    expect(detail.content_hash).toBe("0xdeadbeef");
    expect(detail.computed_at).toBe("2026-06-25T14:00:00Z");
    // Always the three canonical codes, in order, regardless of bundle ordering.
    expect(detail.categories.map((c) => c.code)).toEqual(["S-01", "S-03", "S-04"]);
    const s04 = detail.categories.find((c) => c.code === "S-04")!;
    expect(s04.status).toBe("fail");
    expect(s04.findings).toHaveLength(1);
    expect(s04.findings[0]).toMatchObject({
      kind: "dangerous-command",
      severity: "high",
      file: "scripts/setup.sh",
    });
  });

  it("fills missing categories with a null status rather than dropping them", () => {
    const detail = detailFromSkillRow(
      row({ evidence: { methodologyVersion: "litmus-skill-v2", categories: [{ code: "S-01", status: "pass", findings: [] }] } }),
    )!.detail;
    expect(detail.categories.map((c) => c.code)).toEqual(SKILL_CATEGORIES.map((c) => c.code));
    expect(detail.categories.find((c) => c.code === "S-04")!.status).toBeNull();
  });

  it("surfaces a category reason when the bundle carries one", () => {
    const detail = detailFromSkillRow(
      row({
        evidence: {
          methodologyVersion: "litmus-skill-v2",
          categories: [{ code: "S-04", status: "pass", reason: "no bundled executable scripts", findings: [] }],
        },
      }),
    )!.detail;
    expect(detail.categories.find((c) => c.code === "S-04")!.reason).toBe("no bundled executable scripts");
  });

  it("falls back to a generic methodology label when the bundle omits it", () => {
    const detail = detailFromSkillRow(row({ evidence: { categories: [] } }))!.detail;
    expect(detail.methodology_version).toBe("litmus-skill");
  });

  it("returns null for a missing or non-skill grade", () => {
    expect(detailFromSkillRow(row({ grade: null }))).toBeNull();
    expect(detailFromSkillRow(row({ grade: "C" }))).toBeNull(); // skills grade A/B/D/F only
    expect(detailFromSkillRow(row({ grade: "Z" }))).toBeNull();
  });
});
