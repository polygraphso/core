/**
 * Remediation content for the /fix page — turns a published grade into the
 * concrete changes that would clear it.
 *
 * Pure and db-free (no `server-only`): the page loads the grade with the same
 * loaders the reports use (lib/badgeData, lib/skillGrades) and passes the detail
 * here. Keyed off the public evidence the report already shows — the failing
 * categories and their findings — so nothing here is privileged.
 *
 * The mapping is finding-first: each finding's `kind` selects a specific fix;
 * a failing category with no recorded finding falls back to category-level
 * guidance; a B (egress unverified, the ceiling for a target the harness can't
 * run) gets its own item.
 */

import type { PolygraphDetail, PolygraphCategory } from "./hostedGrades";
import type { SkillDetail, SkillCategory } from "./skillGrades";

/** One concrete fix to render: what's wrong and the change that clears it. */
export interface FixItem {
  /** The check this addresses ("C-01"…"C-04", "S-01"/"S-03"/"S-04"). */
  categoryCode: string;
  /** Human label for the check. */
  categoryName: string;
  /** Short name of the problem. */
  title: string;
  /** Why it drags the grade down. */
  problem: string;
  /** The change to make. */
  fix: string;
  /** The offending tool / bundled file / reached host, when the finding names one. */
  locus?: string;
  /** The matched artifact or its context window — the report's evidence, muted. */
  evidence?: string;
  /** Finding severity ("high"|"medium"|"low"), when recorded. */
  severity?: string;
}

const CATEGORY_NAME: Record<string, string> = {
  "C-01": "Tool-output injection",
  "C-02": "Permission / egress overreach",
  "C-03": "Sensitive-data handling",
  "C-04": "Adversarial-input handling",
  "S-01": "Prompt-injection / context-poisoning",
  "S-03": "Data-exfiltration instructions",
  "S-04": "Dangerous bundled commands",
};

/** F-causes first (C-01/C-03 · S-01/S-03), then D-causes (C-02/C-04 · S-04). */
const CATEGORY_RANK: Record<string, number> = {
  "C-01": 0,
  "C-03": 1,
  "C-02": 2,
  "C-04": 3,
  "S-01": 0,
  "S-03": 1,
  "S-04": 2,
};

const SEVERITY_RANK: Record<string, number> = { high: 0, medium: 1, low: 2 };

/** Findings that record allowed behavior, not a problem — never a fix. */
const SKIP_KINDS = new Set(["egress-allowed"]);

interface Guidance {
  title: string;
  problem: string;
  fix: string;
}

/** Per finding-kind remediation. The precise case; the offending tool/file/host
 *  comes from the finding itself. */
const REMEDIATION_BY_KIND: Record<string, Guidance> = {
  "instruction-mimicry": {
    title: "Instructions aimed at the calling agent",
    problem:
      "A tool name, description, or output reads as a command to the agent — an imperative directive (“ignore previous instructions”, “you must…”), role/override framing, or tool-call JSON embedded in free text. An agent that trusts the server can be steered by it.",
    fix: "Rewrite tool descriptions and outputs as neutral, declarative data — document what the tool does, never tell the agent what to do. Strip any embedded tool-call JSON or system-style directives.",
  },
  "invisible-unicode": {
    title: "Hidden characters in tool text",
    problem:
      "Tool text carries characters a human reviewer can’t see — zero-width spaces, bidi overrides, or Unicode tags — the classic vehicle for instructions hidden from review but read by the model.",
    fix: "Strip control and formatting characters (U+200B–200D, U+FEFF, bidi U+202A–202E / U+2066–2069, Unicode-tag U+E0000–E007F) from every tool name, description, and output. Emit plain text only.",
  },
  "markdown-trick": {
    title: "Misleading markdown or links",
    problem:
      "A tool emits markdown that misdirects — a javascript:/data: URI, link text that contradicts its href, or an image/link whose query string is shaped to exfiltrate data.",
    fix: "Emit plain text or sanitized markdown. Drop javascript:/data: URIs, make link text match its destination, and never place credential-named or high-entropy values in a link’s query string.",
  },
  "permission-mislabel": {
    title: "Read-only label on a mutating tool",
    problem:
      "A tool is marked readOnlyHint: true, but its name, parameters, or description evidence mutation — a destructive verb, or a parameter like recipient / to_address / private_key. The hint tells an agent the call is safe to make unattended when it isn’t.",
    fix: "Set readOnlyHint: false on any tool that writes, transfers, signs, or deletes — or split the read path and the write path into separate tools so the hint is honest.",
  },
  egress: {
    title: "Network call outside the declared allowlist",
    problem:
      "The server opened a connection to a host it never declared — undeclared egress (telemetry, an update check, analytics, or worse) that an operator can’t see coming.",
    fix: "Declare every host you legitimately reach in the server’s polygraph.egress manifest, and remove any outbound call you don’t need. The sandbox passes when every connection is accounted for.",
  },
  canary: {
    title: "Planted secret surfaced back",
    problem:
      "A secret the server was handed (a planted canary) came back out — echoed in a tool output or carried over the network. A server that re-emits the data it’s given will leak the real thing in production.",
    fix: "Never echo input secrets in responses, logs, or error messages, and never forward them to a third-party host. Treat anything passed in as need-to-know and keep it inside the call.",
  },
  "internals-leak": {
    title: "Stack trace leaked on bad input",
    problem:
      "Malformed input produced an uncaught stack trace in a tool output — internal paths and implementation detail handed to the caller, and a sign the error path is unguarded.",
    fix: "Wrap tool handlers so a failure returns a clean, structured error. Never let a raw exception or stack trace reach the output.",
  },
  crash: {
    title: "Server stopped responding under bad input",
    problem:
      "Malformed or oversized input made the server crash or hang instead of rejecting it — a denial-of-service an agent can trigger by accident.",
    fix: "Validate arguments and bound their size before processing. Reject bad input with a structured error and keep the server responsive.",
  },
  "exfil-instruction": {
    title: "Instruction to send data out",
    problem:
      "The skill body or a bundled file tells the agent to send secrets, tokens, or files to an address or endpoint — an exfiltration instruction the agent may follow at runtime.",
    fix: "Remove the instruction. A skill should describe a task, not direct the agent to transmit credentials or data anywhere.",
  },
  "dangerous-command": {
    title: "Dangerous command in a bundled file",
    problem:
      "A bundled script runs a dangerous command — a piped remote installer, a destructive filesystem operation, or similar — that executes with the user’s privileges if the skill runs.",
    fix: "Remove the command, or replace it with an explicit, reviewable step. Never pipe a remote script straight into a shell from a bundled file.",
  },
  "over-broad-trigger": {
    title: "Trigger fires on almost anything",
    problem:
      "The skill’s frontmatter description is broad enough to activate on nearly any prompt, so it inserts itself into contexts it has no business in.",
    fix: "Narrow the description to the skill’s actual purpose — the concrete tasks and keywords it’s for — so it activates only when relevant.",
  },
};

/** Fallback when a failing category recorded no specific finding. */
const REMEDIATION_BY_CATEGORY: Record<string, Guidance> = {
  "C-01": {
    title: "Tool-output injection",
    problem: "Something in the tool surface or a tool’s output can hijack the calling agent.",
    fix: "Make every tool name, description, and output neutral data — no directives to the agent, no hidden characters, no misleading links. The full report names the exact match.",
  },
  "C-02": {
    title: "Permission / egress overreach",
    problem: "The server reached the network beyond what it declared, or labeled a mutating tool read-only.",
    fix: "Declare the hosts you reach in polygraph.egress, remove undeclared calls, and set readOnlyHint honestly. The report names the exact host or tool.",
  },
  "C-03": {
    title: "Sensitive-data handling",
    problem: "A secret the server was handed leaked back out, in an output or over the network.",
    fix: "Never echo or forward data passed into a tool — keep secrets inside the call. The report shows where the canary surfaced.",
  },
  "C-04": {
    title: "Adversarial-input handling",
    problem: "Hostile or malformed input made the server crash, leak internals, or amplify the attack instead of rejecting it cleanly.",
    fix: "Validate and bound inputs, catch errors into structured responses, and never reflect hostile input back as instructions. The report names the offending tool.",
  },
  "S-01": {
    title: "Prompt-injection / context-poisoning",
    problem: "The skill’s text can steer the agent that loads it.",
    fix: "Keep the skill instructional and neutral — no hidden characters, no directives aimed at overriding the agent. The report names the exact match.",
  },
  "S-03": {
    title: "Data-exfiltration instructions",
    problem: "The skill instructs the agent to send data or secrets somewhere.",
    fix: "Remove any instruction to transmit credentials or files. The report shows the flagged line.",
  },
  "S-04": {
    title: "Dangerous bundled commands",
    problem: "A bundled file runs a dangerous command.",
    fix: "Remove or make reviewable any destructive or remote-execution command in the bundle. The report names the file.",
  },
};

/** The B-grade ceiling: nothing failed, but egress couldn’t be exercised. */
const EGRESS_UNVERIFIED: Guidance = {
  title: "Egress couldn’t be verified",
  problem:
    "Nothing failed — but the server was graded over a remote endpoint or without a sandbox, so its network behavior (C-02) couldn’t be exercised. A B means “no injection or data leak, egress unverified”, the ceiling for a target the harness can’t run.",
  fix: "Publish a locally-runnable build (npm or pypi) so the egress sandbox can run against it, and declare your egress hosts in polygraph.egress. A clean sandboxed run lifts the grade to A.",
};

/** Common shape across McpFinding (carries tool/host) and SkillFinding (file only). */
interface AnyFinding {
  kind: string | null;
  severity: string | null;
  match: string | null;
  context: string | null;
  tool?: string | null;
  file: string | null;
  host?: string | null;
}
interface AnyCategory {
  code: string;
  status: string | null;
  findings: ReadonlyArray<AnyFinding>;
}

function nameFor(code: string): string {
  return CATEGORY_NAME[code] ?? code;
}

/** A finding → its FixItem: specific guidance by kind, else the category fallback,
 *  always carrying the finding's own locus/evidence/severity. */
function itemFromFinding(code: string, f: AnyFinding): FixItem {
  const g = (f.kind && REMEDIATION_BY_KIND[f.kind]) || REMEDIATION_BY_CATEGORY[code] || REMEDIATION_BY_CATEGORY["C-01"];
  // Command/file findings read clearest as the literal; text findings as the
  // captured context window — mirrors the skill report's FindingChip.
  const evidence = (f.file ? f.match : f.context ?? f.match)?.trim() || undefined;
  return {
    categoryCode: code,
    categoryName: nameFor(code),
    title: g.title,
    problem: g.problem,
    fix: g.fix,
    locus: f.tool ?? f.file ?? f.host ?? undefined,
    evidence,
    severity: f.severity ?? undefined,
  };
}

function categoryFallbackItem(code: string): FixItem {
  const g = REMEDIATION_BY_CATEGORY[code] ?? REMEDIATION_BY_CATEGORY["C-01"];
  return { categoryCode: code, categoryName: nameFor(code), title: g.title, problem: g.problem, fix: g.fix };
}

function dedupeAndSort(items: FixItem[]): FixItem[] {
  const seen = new Set<string>();
  const out: FixItem[] = [];
  for (const it of items) {
    const key = `${it.categoryCode}|${it.title}|${it.locus ?? ""}`;
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(it);
  }
  return out.sort((a, b) => {
    const r = (CATEGORY_RANK[a.categoryCode] ?? 9) - (CATEGORY_RANK[b.categoryCode] ?? 9);
    if (r !== 0) return r;
    return (SEVERITY_RANK[a.severity ?? ""] ?? 3) - (SEVERITY_RANK[b.severity ?? ""] ?? 3);
  });
}

/** Shared walk: emit a fix per actionable finding; for a failing category that
 *  recorded none, emit category-level guidance. */
function itemsFromCategories(cats: ReadonlyArray<AnyCategory>): FixItem[] {
  const items: FixItem[] = [];
  for (const cat of cats) {
    const actionable = cat.findings.filter((f) => !(f.kind && SKIP_KINDS.has(f.kind)));
    for (const f of actionable) items.push(itemFromFinding(cat.code, f));
    if (cat.status === "fail" && actionable.length === 0) items.push(categoryFallbackItem(cat.code));
  }
  return dedupeAndSort(items);
}

/**
 * Fix items for an MCP server grade. A is clean (no items); B is the
 * egress-unverified ceiling (a single structural item); D/F expand their failing
 * categories' findings.
 */
export function mcpFixItems(detail: PolygraphDetail): FixItem[] {
  if (detail.grade === "A") return [];
  if (detail.grade === "B") {
    return [{ categoryCode: "C-02", categoryName: nameFor("C-02"), ...EGRESS_UNVERIFIED }];
  }
  const cats: PolygraphCategory[] =
    detail.categories && detail.categories.length ? detail.categories : flatCategories(detail);
  return itemsFromCategories(cats);
}

/** Legacy/thin bundles carry no per-category findings — fall back to the flat
 *  c01..c04 verdicts so a failing check still yields category-level guidance.
 *  Only an exact "fail" triggers a fallback item (decorated "skipped — …" / "pass"
 *  pass through inert). */
function flatCategories(d: PolygraphDetail): PolygraphCategory[] {
  const rows: Array<[string, string | null]> = [
    ["C-01", d.c01],
    ["C-02", d.c02],
    ["C-03", d.c03],
    ["C-04", d.c04],
  ];
  return rows.map(([code, s]) => ({ code, status: s, reason: null, findings: [] }));
}

/**
 * Fix items for a skill grade. A is clean; any lower grade expands the findings
 * recorded across S-01/S-03/S-04 (including the sub-threshold ones that hold a
 * skill at B), plus category-level guidance for a failing check with no finding.
 */
export function skillFixItems(detail: SkillDetail): FixItem[] {
  if (detail.grade === "A") return [];
  const cats: SkillCategory[] = detail.categories ?? [];
  return itemsFromCategories(cats);
}
