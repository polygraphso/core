/**
 * Self-reported descriptions for graded targets — the one per-page fact the
 * harness doesn't produce: what the artifact says it does. Rendered on report
 * pages as the subject's own claim ("describes itself as"), never as
 * polygraph's assessment, and always as plain text (React escapes it).
 *
 * Sources are the public registries of record: the npm registry `description`,
 * the PyPI `info.summary`, and a skill's own SKILL.md frontmatter at the exact
 * commit the grade was run against. Every fetcher is failure-tolerant (null on
 * any miss) and cached for a day — descriptions change rarely and the report
 * pages themselves already re-render every 10 minutes.
 */

const MAX_LEN = 280;
const REVALIDATE_SECONDS = 86400;

/** Collapse whitespace, trim, cap at a word boundary. Null when empty. */
function clean(raw: unknown): string | null {
  if (typeof raw !== "string") return null;
  const s = raw.replace(/\s+/g, " ").trim();
  if (!s) return null;
  if (s.length <= MAX_LEN) return s;
  return `${s.slice(0, MAX_LEN - 1).replace(/\s+\S*$/, "")}…`;
}

/** `npm/<pkg>` or `pypi/<name>` → the registry's own description/summary. */
export async function fetchRegistryDescription(serverKey: string): Promise<string | null> {
  try {
    if (serverKey.startsWith("npm/")) {
      const pkg = serverKey.slice("npm/".length);
      // Registry paths take the literal scoped name; reject anything that
      // isn't a plausible package name before building a URL from it.
      if (!/^(@[\w.-]+\/)?[\w.-]+$/.test(pkg)) return null;
      const res = await fetch(`https://registry.npmjs.org/${pkg}`, {
        next: { revalidate: REVALIDATE_SECONDS },
      });
      if (!res.ok) return null;
      const data = (await res.json()) as { description?: unknown };
      return clean(data.description);
    }
    if (serverKey.startsWith("pypi/")) {
      const name = serverKey.slice("pypi/".length);
      if (!/^[\w.-]+$/.test(name)) return null;
      const res = await fetch(`https://pypi.org/pypi/${name}/json`, {
        next: { revalidate: REVALIDATE_SECONDS },
      });
      if (!res.ok) return null;
      const data = (await res.json()) as { info?: { summary?: unknown } };
      return clean(data.info?.summary);
    }
    return null; // github/ and remote targets have no registry description
  } catch {
    return null;
  }
}

/**
 * A skill's own `description:` from its SKILL.md frontmatter, read at the
 * commit the grade is anchored to (no commit pin → no claim). Handles the
 * common frontmatter shapes: single-line scalars, quoted strings, and
 * folded/literal blocks (`>`, `>-`, `|`) by joining the indented lines.
 */
export async function fetchSkillSelfDescription(
  skillRef: string,
  commitSha: string | null,
): Promise<string | null> {
  if (!commitSha || !/^[0-9a-f]{7,40}$/.test(commitSha)) return null;
  const m = /^github\/([\w.-]+)\/([\w.-]+)#([\w./-]+)$/.exec(skillRef);
  if (!m) return null;
  const [, owner, repo, subpath] = m;
  try {
    const res = await fetch(
      `https://raw.githubusercontent.com/${owner}/${repo}/${commitSha}/${subpath}/SKILL.md`,
      { next: { revalidate: REVALIDATE_SECONDS } },
    );
    if (!res.ok) return null;
    const text = await res.text();
    const fm = /^---\r?\n([\s\S]*?)\r?\n---/.exec(text);
    if (!fm) return null;
    const lines = fm[1]!.split(/\r?\n/);
    const start = lines.findIndex((l) => /^description\s*:/.test(l));
    if (start === -1) return null;
    let value = lines[start]!.replace(/^description\s*:/, "").trim();
    if (value === "" || /^[>|][+-]?$/.test(value)) {
      // Block scalar: the value is the following more-indented lines.
      const block: string[] = [];
      for (let i = start + 1; i < lines.length; i++) {
        const line = lines[i]!;
        if (line.trim() === "") continue;
        if (!/^\s/.test(line)) break; // next top-level key
        block.push(line.trim());
      }
      value = block.join(" ");
    }
    return clean(value.replace(/^["']|["']$/g, ""));
  } catch {
    return null;
  }
}
