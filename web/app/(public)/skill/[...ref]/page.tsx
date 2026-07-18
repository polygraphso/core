/**
 * /skill/<github>/<owner>/<repo>/<subpath> — the per-skill grade report.
 *
 * The static counterpart to /mcp/<…>: where that page reports a server's
 * behavioral grade, this reports a Claude Code / Agent Skill's STATIC safety
 * grade from the skill litmus (litmus-skill-v2) — the S-01/S-03/S-04 breakdown,
 * the flagged findings behind a fail, the content hash the grade is anchored to,
 * and how to reproduce it. Read live from hosted_runs (grade-only, like /base).
 *
 * The catch-all ref is canonicalized to its `github/owner/repo#subpath` target
 * (see lib/skillGrades). An ungraded skill gets a short note, not a dead page.
 */

import { cache } from "react";
import type { Metadata } from "next";
import Link from "next/link";
import {
  decodeSkillRef,
  loadSkillGrade,
  skillRefToPath,
  githubUrlForSkillRef,
  skillDisplayName,
  SKILL_CATEGORIES,
  type SkillDetail,
  type SkillLitmusGrade,
  type SkillCategory,
  type SkillFinding,
} from "@/lib/skillGrades";
import { GRADE_HEX } from "@/lib/gradeColors";
import { getSupabaseAdmin } from "@/lib/supabase";
import { findLatestConfirmedByServer } from "@/lib/attestations/store";
import { getChainConfig, attestationUrl, attesterName } from "@/lib/attestations/chains";
import { FixCta } from "@/app/_components/FixCta";
import { EmbedSnippets } from "@/app/_components/EmbedSnippets";
import { ShareGrade } from "@/app/_components/ShareGrade";
import { ReportFaq } from "@/app/_components/ReportFaq";
import { JsonLd } from "@/app/_components/JsonLd";
import { SITE_ORIGIN, SKILL_METHODOLOGY_VERSION } from "@/lib/site";
import { fetchSkillSelfDescription } from "@/lib/selfDescription";

const ORIGIN = SITE_ORIGIN;

// Letter grade → numeric rating for Review markup (Google requires a number;
// the letter stays in the review name/body). A=5 … F=1, C=3 (E is skipped).
const GRADE_RATING: Record<string, number> = { A: 5, B: 4, C: 3, D: 2, F: 1 };

// generateMetadata and the page both need the grade; cache() collapses them to
// one query per request.
const getGrade = cache((target: string) => loadSkillGrade(getSupabaseAdmin(), target));

// A regrade surfaces within 10 min; the grade-only rows are otherwise stable.
export const revalidate = 600;

type Params = Promise<{ ref?: string[] }>;

/** Catch-all segments → canonical skill target, or null if unparseable. */
function targetFromParams(parts: string[] | undefined): string | null {
  if (!parts || parts.length === 0) return null;
  // Next hands catch-all segments percent-encoded to the render; decode each
  // back to its literal form before rejoining (a no-op when already decoded).
  let raw: string;
  try {
    raw = parts.map((s) => decodeURIComponent(s)).join("/");
  } catch {
    return null; // malformed percent-encoding in the path
  }
  return decodeSkillRef(raw);
}

/** Category status → color: pass green, fail oxblood, unrecorded neutral. */
function statusColor(status: string | null): string {
  if (status === "pass") return GRADE_HEX.A;
  if (!status) return "var(--color-ink-faint)";
  return "var(--color-oxblood)";
}

/**
 * Finding severity → accent. Keyed to severity, NOT the category verdict: a
 * sub-threshold finding noted on a passing check must never inherit the green
 * "pass" color and read as approval.
 */
function severityColor(severity: string | null): string {
  if (severity === "high") return "var(--color-oxblood)";
  if (severity === "medium") return "var(--color-terracotta)";
  return "var(--color-ink-faint)";
}

function shortHash(hash: string | null): string | null {
  if (!hash) return null;
  return hash.length <= 18 ? hash : `${hash.slice(0, 12)}…${hash.slice(-4)}`;
}

export async function generateMetadata({ params }: { params: Params }): Promise<Metadata> {
  const { ref } = await params;
  const target = targetFromParams(ref);
  if (!target) {
    return { title: "Skill grade", robots: { index: false, follow: true } };
  }
  const path = skillRefToPath(target);
  const canonical = `/skill/${path}`;
  const cardUrl = `/api/badge/skill/card?skill=${path}`;
  const name = skillDisplayName(target);
  const result = await getGrade(target);
  if (result) {
    const title = `${name} — skill security grade ${result.grade} | polygraph`;
    return {
      title,
      description: `Is the ${name} skill safe? polygraph's static skill litmus (${result.detail.methodology_version}) graded it ${result.grade}: prompt injection, exfiltration, dangerous bundled commands.`,
      alternates: { canonical },
      openGraph: { title, url: canonical, images: [cardUrl] },
      twitter: { card: "summary_large_image", images: [cardUrl] },
      robots: { index: true, follow: true },
    };
  }
  const title = `polygraph: ${name} — not yet graded`;
  return {
    title,
    description: `The ${name} skill hasn't been graded by polygraph yet.`,
    alternates: { canonical },
    openGraph: { title, url: canonical, images: [cardUrl] },
    robots: { index: false, follow: true },
  };
}

export default async function SkillReportPage({ params }: { params: Params }) {
  const { ref } = await params;
  const target = targetFromParams(ref);

  return (
      <section className="mx-auto max-w-3xl">
        <div className="border-t hairline pt-6 mb-10">
          <div className="flex items-baseline gap-4">
            <span className="section-label tabular">Skill</span>
            <span className="section-label">/</span>
            <span className="section-label">Static safety grade</span>
          </div>
        </div>

        {!target ? <Fallback /> : <Report target={target} />}
      </section>
  );
}

async function Report({ target }: { target: string }) {
  const result = await getGrade(target);
  const path = skillRefToPath(target);
  const badgeUrl = `${ORIGIN}/api/badge/skill?skill=${path}`;
  const cardUrl = `${ORIGIN}/api/badge/skill/card?skill=${path}`;
  const pageUrl = `${ORIGIN}/skill/${path}`;
  // The skill's own SKILL.md description at the graded commit — the one
  // per-skill fact that differentiates 100+ otherwise-templated report pages.
  const selfDescription = result
    ? await fetchSkillSelfDescription(target, result.detail.commit_sha)
    : null;

  return result ? (
    <Graded
      target={target}
      grade={result.grade}
      detail={result.detail}
      selfDescription={selfDescription}
      badgeUrl={badgeUrl}
      cardUrl={cardUrl}
      pageUrl={pageUrl}
    />
  ) : (
    <Ungraded target={target} badgeUrl={badgeUrl} cardUrl={cardUrl} pageUrl={pageUrl} />
  );
}

function Graded({
  target,
  grade,
  detail,
  selfDescription,
  badgeUrl,
  cardUrl,
  pageUrl,
}: {
  target: string;
  grade: SkillLitmusGrade;
  detail: SkillDetail;
  selfDescription: string | null;
  badgeUrl: string;
  cardUrl: string;
  pageUrl: string;
}) {
  const name = skillDisplayName(target);
  const source = githubUrlForSkillRef(target);
  const hash = shortHash(detail.content_hash);
  const dated = detail.computed_at?.slice(0, 10) ?? null;
  // The github commit this grade was run against — the commit stream the monitor
  // watches. Shown when present (backfilled or graded after the anchor landed).
  const commitShort = detail.commit_sha ? detail.commit_sha.slice(0, 7) : null;
  const commitDate = detail.commit_at?.slice(0, 10) ?? null;
  const repoSegs = target.split("#")[0]!.split("/"); // [github, owner, repo]
  const commitUrl =
    detail.commit_sha && repoSegs.length >= 3
      ? `https://github.com/${repoSegs[1]}/${repoSegs[2]}/commit/${detail.commit_sha}`
      : null;

  // Same critic-review shape as /mcp reports: polygraph (Organization) reviews
  // third-party software; the static skill litmus is the review method.
  const reviewJsonLd = {
    "@context": "https://schema.org",
    "@type": "SoftwareApplication",
    name,
    ...(selfDescription ? { description: selfDescription } : {}),
    applicationCategory: "DeveloperApplication",
    operatingSystem: "Cross-platform",
    url: pageUrl,
    ...(source ? { downloadUrl: source } : {}),
    offers: { "@type": "Offer", price: "0", priceCurrency: "USD" },
    review: {
      "@type": "Review",
      name: `polygraph static skill safety grade: ${grade}`,
      reviewBody: `polygraph ran the open static skill litmus (${detail.methodology_version}) over the ${name} skill's bytes: prompt-injection and context poisoning, data-exfiltration instructions, and dangerous bundled commands. Grade: ${grade}, anchored to the skill's content hash. Static scan, not behavioral proof.`,
      ...(dated ? { datePublished: dated } : {}),
      author: {
        "@type": "Organization",
        "@id": `${SITE_ORIGIN}/#org`,
        name: "polygraph",
        url: SITE_ORIGIN,
      },
      reviewRating: {
        "@type": "Rating",
        ratingValue: GRADE_RATING[grade] ?? 1,
        bestRating: 5,
        worstRating: 1,
      },
    },
  };

  // Home → Index → this report; the still-supported rich result (unlike FAQ).
  const breadcrumbJsonLd = {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: [
      { "@type": "ListItem", position: 1, name: "polygraph.so", item: SITE_ORIGIN },
      { "@type": "ListItem", position: 2, name: "The MCP Security Index", item: `${SITE_ORIGIN}/mcp-index` },
      { "@type": "ListItem", position: 3, name },
    ],
  };

  return (
    <>
      <JsonLd data={reviewJsonLd} />
      <JsonLd data={breadcrumbJsonLd} />
      <div className="flex items-start gap-6">
        <span
          className="font-serif text-7xl md:text-8xl leading-none shrink-0"
          style={{ color: GRADE_HEX[grade] }}
          aria-label={`Grade ${grade}`}
        >
          {grade}
        </span>
        <div className="min-w-0">
          <h1 className="font-mono text-lg md:text-xl text-ink break-words leading-snug">{name}</h1>
          <p className="mt-2 font-mono text-[11.5px] text-ink-faint leading-relaxed break-all">
            {target}
          </p>
          <p className="mt-2 font-mono text-[11.5px] text-ink-faint leading-relaxed">
            <Link
              href="/methodology"
              className="text-ink-muted border-b hairline border-dotted hover:text-oxblood transition-colors"
            >
              {detail.methodology_version}
            </Link>
            {dated ? <> · {dated}</> : null}
          </p>
          {commitShort ? (
            <p className="mt-1 font-mono text-[11.5px] text-ink-faint leading-relaxed">
              graded at commit{" "}
              {commitUrl ? (
                <a
                  href={commitUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-ink-muted border-b hairline border-dotted hover:text-oxblood transition-colors"
                >
                  {commitShort}
                </a>
              ) : (
                commitShort
              )}
              {commitDate ? <> · {commitDate}</> : null}
            </p>
          ) : null}
        </div>
      </div>

      {/* One self-contained, quotable verdict sentence for answer engines. */}
      <p className="mt-6 font-sans text-[14px] text-ink-muted leading-relaxed max-w-xl">
        The <span className="text-ink">{name}</span> skill is graded{" "}
        <span className="text-ink">{grade}</span> by polygraph under{" "}
        {detail.methodology_version}
        {dated ? <>, as of {dated}</> : null}, anchored to its content hash.
      </p>

      {/* Stale-methodology disclosure, mirroring the server reports. */}
      {detail.methodology_version !== SKILL_METHODOLOGY_VERSION ? (
        <p className="mt-2 font-mono text-[11px] text-ink-faint leading-relaxed">
          Graded under {detail.methodology_version}; the current skill methodology is{" "}
          {SKILL_METHODOLOGY_VERSION}. A re-run may change the grade.
        </p>
      ) : null}

      {selfDescription ? (
        <p className="mt-4 font-sans text-[13px] text-ink-muted leading-relaxed max-w-xl">
          <span className="font-mono text-[10.5px] uppercase tracking-[0.16em] text-ink-faint">
            Self-reported
          </span>{" "}
          &ldquo;{selfDescription}&rdquo; &mdash; the skill&rsquo;s own SKILL.md
          description at the graded commit, not part of the grade.
        </p>
      ) : null}

      <p className="mt-4 max-w-xl text-[13.5px] text-ink-muted leading-relaxed">
        A <span className="text-ink">static</span>{" "}
        safety grade — a deterministic scan of the skill&rsquo;s{" "}
        <code className="font-mono text-[12.5px]">SKILL.md</code>{" "}
        and bundled files. An A means static-clean,{" "}
        <span className="text-ink">not behavioral proof</span>: a skill&rsquo;s
        instructions are interpreted by an agent at runtime.
      </p>

      <ShareGrade
        pageUrl={pageUrl}
        text={`${name} graded ${grade} by polygraph's static skill litmus — reproducible and content-hash-anchored.`}
      />

      {/* category breakdown */}
      <div className="mt-10 border-t hairline">
        {detail.categories.map((cat) => (
          <CategoryRow key={cat.code} cat={cat} />
        ))}
      </div>

      {hash ? (
        <p className="mt-3 font-mono text-[11px] text-ink-faint break-all">
          content hash · <span className="text-ink-muted">{hash}</span>
        </p>
      ) : null}

      {/* how to fix — only when there's something to fix (non-A) */}
      {grade !== "A" ? <FixCta target={target} kind="skill" /> : null}

      {/* source */}
      {source ? (
        <p className="mt-8 font-sans text-[13px] text-ink-muted leading-relaxed">
          Source ·{" "}
          <a
            href={source}
            target="_blank"
            rel="noreferrer noopener"
            className="text-ink border-b hairline border-dotted hover:text-oxblood transition-colors break-all"
          >
            {source.replace(/^https:\/\//, "")}
          </a>
        </p>
      ) : null}

      {/* monitor — watch the skill's github path for changes */}
      <div className="mt-12 border-t hairline pt-6">
        <h2 className="font-serif text-lg text-ink mb-1">Watch for changes</h2>
        <p className="font-sans text-[13px] text-ink-muted leading-relaxed max-w-xl mb-4">
          This grade is a snapshot of the skill&rsquo;s files at one commit. Get an email when a new
          commit changes <span className="font-mono text-[12px] text-ink">{name}</span> and polygraph
          re-runs the litmus — one message per change, one-click unsubscribe.
        </p>
        <Link
          href={`/monitor?for=${encodeURIComponent(target)}`}
          className="inline-flex items-center gap-2 border hairline px-5 py-3 font-mono text-sm tracking-wide text-ink-muted hover:text-ink transition-colors"
        >
          Monitor this skill
          <span aria-hidden className="text-base leading-none">→</span>
        </Link>
      </div>

      {/* on-chain attestation — shown only when this skill's grade is attested */}
      <OnchainSection target={target} />

      {/* reproduce — trust rests on re-runnability, not on a claim */}
      <div className="mt-12 border-t hairline pt-6">
        <h2 className="font-serif text-lg text-ink mb-2">Reproduce this grade</h2>
        <p className="font-sans text-[13px] text-ink-muted leading-relaxed max-w-xl">
          The skill litmus is open and deterministic. Point it at the skill directory and compare the
          grade and content hash — a false grade is{" "}
          <Link
            href="/methodology#reproducibility"
            className="text-ink border-b hairline border-dotted hover:text-oxblood transition-colors"
          >
            falsifiable, not merely disputable
          </Link>
          .
        </p>
        <pre className="mt-3 overflow-x-auto rounded-sm border hairline bg-parchment-50 px-4 py-3 font-mono text-[12.5px] text-ink">
          <code>npx -p @polygraphso/litmus polygraphso-litmus-skill &lt;skill-dir&gt;</code>
        </pre>
      </div>

      {/* embed */}
      <div className="mt-12 border-t hairline pt-6">
        <h2 className="font-serif text-lg text-ink mb-1">Embed this badge</h2>
        <p className="font-sans text-[13px] text-ink-muted leading-relaxed max-w-xl mb-5">
          Drop it in the skill&rsquo;s README, docs, or listing. It always shows the current
          grade and links back here.
        </p>
        <div className="mb-5">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={badgeUrl} alt={`polygraph skill grade ${grade}`} height={20} />
        </div>
        <EmbedSnippets badgeUrl={badgeUrl} cardUrl={cardUrl} pageUrl={pageUrl} />
      </div>

      <ReportFaq kind="skill" subject={name} grade={grade} />
    </>
  );
}

/**
 * On-chain attestation block — rendered only when this skill's grade is published
 * as an EAS attestation. Mirrors the /grade evidence section; the evidenceHash is
 * the re-hashable tamper-proof anchor.
 */
async function OnchainSection({ target }: { target: string }) {
  const db = getSupabaseAdmin();
  if (!db) return null;
  const cfg = getChainConfig();
  const att = await findLatestConfirmedByServer(db, target, cfg.chainId);
  if (!att?.attestation_uid) return null;
  return (
    <div className="mt-12 border-t hairline pt-6">
      <h2 className="font-serif text-lg text-ink mb-2">On-chain attestation</h2>
      <p className="font-sans text-[13px] text-ink-muted leading-relaxed max-w-xl">
        This grade is published as an EAS attestation on {cfg.chain}, signed by polygraph&rsquo;s
        attester. The <code className="font-mono text-[12.5px]">evidenceHash</code> is keccak256 of
        the canonical evidence bundle — anyone can recompute it and confirm the grade was not altered.
      </p>
      <dl className="mt-3 font-mono text-[11px] text-ink-faint space-y-1">
        <div>
          attester · <span className="text-ink-muted">{attesterName(att.attester_address)}</span>
        </div>
        <div className="break-all">
          evidenceHash · <span className="text-ink-muted">{att.evidence_hash}</span>
        </div>
      </dl>
      <p className="mt-3 font-sans text-[13px]">
        <a
          href={attestationUrl(cfg, att.attestation_uid)}
          target="_blank"
          rel="noreferrer noopener"
          className="text-oxblood border-b hairline border-dotted hover:opacity-80 transition-opacity"
        >
          View on {cfg.chain} EAS explorer ↗
        </a>
      </p>
    </div>
  );
}

/** One S-0x row: status on the right; for a FAIL, the findings that drove it
 *  underneath. Findings are not shown for a passing check — a pass may carry
 *  sub-threshold matches (e.g. instruction-mimicry, which fires on benign skill
 *  instructions) that didn't move the grade, and rendering them under a green
 *  "pass" reads as a contradiction. */
function CategoryRow({ cat }: { cat: SkillCategory }) {
  const label = SKILL_CATEGORIES.find((c) => c.code === cat.code)?.name ?? "";
  return (
    <div className="border-b hairline py-3">
      <div className="flex items-baseline justify-between gap-4">
        <span className="font-mono text-[12px] text-ink-muted">
          <span className="text-ink-faint">{cat.code}</span> {label}
        </span>
        <span className="font-mono text-[12px] text-right" style={{ color: statusColor(cat.status) }}>
          {cat.status ?? "—"}
        </span>
      </div>
      {cat.reason ? (
        <p className="mt-1.5 font-mono text-[11px] text-ink-faint leading-relaxed">{cat.reason}</p>
      ) : null}
      {cat.status !== "pass" && cat.findings.length > 0 ? (
        <ul className="mt-2.5 space-y-2 border-l-2 pl-4" style={{ borderColor: "var(--color-rule-soft)" }}>
          {cat.findings.map((f, i) => (
            <FindingChip key={i} finding={f} />
          ))}
        </ul>
      ) : null}
    </div>
  );
}

/**
 * One flagged location as a quoted evidence chip — the report's load-bearing
 * detail. The matched literal (or its bounded context window, for text findings)
 * reads as an artifact, not prose; severity, not the verdict, drives the accent.
 */
function FindingChip({ finding }: { finding: SkillFinding }) {
  // Command findings carry the literal in `match` + a file; text findings are
  // clearer shown with the surrounding context window the scan captured.
  const snippet = (finding.file ? finding.match : finding.context ?? finding.match)?.trim();
  return (
    <li className="rounded-sm border hairline bg-parchment-50 px-3 py-2">
      <div className="flex flex-wrap items-baseline gap-x-2 gap-y-0.5">
        <span
          className="font-mono text-[10px] uppercase tracking-[0.12em]"
          style={{ color: severityColor(finding.severity) }}
        >
          {finding.kind ?? "finding"}
        </span>
        {finding.severity ? (
          <span className="font-mono text-[10px] text-ink-faint">· {finding.severity}</span>
        ) : null}
        {finding.file ? (
          <span className="font-mono text-[10px] text-ink-faint break-all">· {finding.file}</span>
        ) : null}
      </div>
      {snippet ? (
        <code className="mt-1.5 block font-mono text-[11.5px] text-ink-muted break-all leading-relaxed">
          {snippet}
        </code>
      ) : null}
    </li>
  );
}

function Ungraded({
  target,
  badgeUrl,
  cardUrl,
  pageUrl,
}: {
  target: string;
  badgeUrl: string;
  cardUrl: string;
  pageUrl: string;
}) {
  const name = skillDisplayName(target);
  const source = githubUrlForSkillRef(target);
  return (
    <>
      <h1 className="font-serif text-3xl md:text-4xl tracking-tight text-ink leading-[1.1] max-w-2xl">
        <span className="font-mono text-[0.7em] text-ink bg-parchment-200 px-1.5 py-0.5 align-baseline">
          {name}
        </span>{" "}
        hasn&rsquo;t been graded yet.
      </h1>

      <p className="mt-6 max-w-xl text-ink-muted leading-relaxed">
        No skill litmus has been run against{" "}
        <code className="font-mono text-[13px] text-ink-muted break-all">{target}</code>. Unevaluated
        is neither safe nor unsafe — it just means the static battery hasn&rsquo;t been run.
      </p>

      {source ? (
        <p className="mt-6 font-sans text-[13px] text-ink-muted leading-relaxed">
          Source ·{" "}
          <a
            href={source}
            target="_blank"
            rel="noreferrer noopener"
            className="text-ink border-b hairline border-dotted hover:text-oxblood transition-colors break-all"
          >
            {source.replace(/^https:\/\//, "")}
          </a>
        </p>
      ) : null}

      <div className="mt-12 border-t hairline pt-6">
        <h2 className="font-serif text-lg text-ink mb-2">Grade it yourself</h2>
        <p className="font-sans text-[13px] text-ink-muted leading-relaxed max-w-xl">
          The skill litmus is open. Point it at the skill directory to get the same A/B/D/F grade and
          content hash.
        </p>
        <pre className="mt-3 overflow-x-auto rounded-sm border hairline bg-parchment-50 px-4 py-3 font-mono text-[12.5px] text-ink">
          <code>npx -p @polygraphso/litmus polygraphso-litmus-skill &lt;skill-dir&gt;</code>
        </pre>
      </div>

      {/* embed */}
      <div className="mt-12 border-t hairline pt-6">
        <h2 className="font-serif text-lg text-ink mb-1">Embed the badge anyway</h2>
        <p className="font-sans text-[13px] text-ink-muted leading-relaxed max-w-xl mb-5">
          It reads <span className="font-mono">unrated</span> today and updates itself to the
          grade the moment one publishes — no edit needed.
        </p>
        <div className="mb-5">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={badgeUrl} alt="polygraph skill grade unrated" height={20} />
        </div>
        <EmbedSnippets badgeUrl={badgeUrl} cardUrl={cardUrl} pageUrl={pageUrl} />
      </div>
    </>
  );
}

function Fallback() {
  return (
    <>
      <h1 className="font-serif text-3xl md:text-4xl tracking-tight text-ink leading-[1.1] max-w-2xl">
        This page expects a skill reference.
      </h1>
      <p className="mt-6 max-w-xl text-ink-muted leading-relaxed">
        Address a skill by its GitHub-prefixed ref in the path, for example:
      </p>
      <pre className="mt-6 border hairline bg-parchment-50 px-4 py-4 font-mono text-sm text-ink overflow-x-auto">
        <code>/skill/github/BankrBot/skills/base-account</code>
      </pre>
    </>
  );
}
