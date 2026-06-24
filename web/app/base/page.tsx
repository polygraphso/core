import type { Metadata } from "next";
import Link from "next/link";
import {
  loadBaseIndex,
  GROUP_LABEL,
  GROUP_ORDER,
  type GradedEntry,
} from "@/lib/baseIndex";
import { GRADE_HEX } from "@/lib/gradeColors";
import type { LitmusGrade } from "@/lib/hostedGrades";

/**
 * UNLISTED Base-network MCP index. Not linked from nav/footer, not in any
 * sitemap, robots noindex — reachable only by direct link. Reads grades live
 * from hosted_runs INCLUDING unpublished rows (see lib/baseIndex), so it shows
 * grades that are not yet public anywhere else. Keep it private until a publish
 * decision is made per server.
 */
export const metadata: Metadata = {
  title: "Base-network MCP index — polygraph (private)",
  robots: { index: false, follow: false },
};

// Always render per-request against runtime env + the latest grade rows.
export const dynamic = "force-dynamic";

const GRADE_ORDER: LitmusGrade[] = ["A", "B", "C", "D", "F"];

/** Category status → accent: pass green, skip/none faint, fail/partial oxblood. */
function statusColor(status: string | null): string {
  if (status === "pass") return GRADE_HEX.A;
  if (!status || status.startsWith("skip")) return "var(--color-ink-faint)";
  return GRADE_HEX.F;
}

/** The left-anchored grade stamp — the row's visual authority. */
function Stamp({ grade }: { grade: LitmusGrade }) {
  return (
    <span
      className="inline-flex h-8 w-8 items-center justify-center rounded-[3px] font-mono text-[15px] font-semibold text-parchment-50 shadow-[inset_0_0_0_1px_rgba(255,255,255,0.14)]"
      style={{ backgroundColor: GRADE_HEX[grade] }}
      aria-label={`grade ${grade}`}
    >
      {grade}
    </span>
  );
}

function Check({ status }: { status: string | null }) {
  const label = !status ? "—" : status.startsWith("skip") ? "skip" : status;
  const fail = status && !status.startsWith("skip") && status !== "pass";
  return (
    <span className={`font-mono text-[11px] ${fail ? "font-semibold" : ""}`} style={{ color: statusColor(status) }}>
      {label}
    </span>
  );
}

const CHECKS = "grid grid-cols-3 gap-x-3 text-center w-[8.5rem]";

/** Project name — links to X when a handle is known, otherwise plain. */
function ProjectLink({ e }: { e: GradedEntry }) {
  return e.handle ? (
    <a href={`https://x.com/${e.handle}`} target="_blank" rel="noreferrer noopener" className="text-ink hover:text-oxblood transition-colors">
      {e.project}
    </a>
  ) : (
    <span className="text-ink">{e.project}</span>
  );
}

/** Category + a third-party flag (the trust caveat — a community wrapper, not the protocol's own). */
function CategoryLine({ e }: { e: GradedEntry }) {
  if (!e.category && e.party !== "third") return null;
  return (
    <div className="font-mono text-[10px] text-ink-faint uppercase tracking-[0.12em]">
      {e.category}
      {e.party === "third" ? <span className="text-oxblood/70">{e.category ? " · 3rd-party" : "3rd-party"}</span> : null}
    </div>
  );
}

/** The MCP-server cell: a link to the canonical /mcp report when one exists. */
function RefCell({ e, size }: { e: GradedEntry; size: string }) {
  if (!e.mcpRef) return <span className={`font-mono ${size} text-ink-faint`}>{e.note}</span>;
  const ref = <code className={`font-mono ${size} break-all`}>{e.mcpRef}</code>;
  return e.reportPath ? (
    <Link href={`/mcp/${e.reportPath}`} className="text-ink-muted underline decoration-dotted underline-offset-2 hover:text-oxblood transition-colors">
      {ref}
    </Link>
  ) : (
    <span className="text-ink-muted">{ref}</span>
  );
}

function PendingCell({ e }: { e: GradedEntry }) {
  if (e.ownMcp) {
    return <>pending{e.pending ? ` · ${e.pending}` : ""}</>;
  }
  return <>no MCP</>;
}

function DesktopRow({ e }: { e: GradedEntry }) {
  return (
    <div className="hidden md:grid grid-cols-[2.75rem_minmax(120px,1.25fr)_minmax(150px,1.9fr)_8.5rem_5.5rem_4.5rem] items-center gap-x-5 px-3 py-3 border-t hairline transition-colors hover:bg-[#efe8d6]">
      <div>{e.grade ? <Stamp grade={e.grade} /> : <span className="font-mono text-[12px] text-ink-faint">{e.ownMcp ? "·" : "—"}</span>}</div>
      <div className="min-w-0">
        <ProjectLink e={e} />
        <CategoryLine e={e} />
      </div>
      <div className="min-w-0">
        <RefCell e={e} size="text-[11.5px]" />
      </div>
      {e.grade ? (
        <div className={CHECKS}>
          <Check status={e.detail?.c01 ?? null} />
          <Check status={e.detail?.c02 ?? null} />
          <Check status={e.detail?.c03 ?? null} />
        </div>
      ) : (
        <div className="w-[8.5rem] text-center font-mono text-[11px] text-ink-faint">
          <PendingCell e={e} />
        </div>
      )}
      <div className="font-mono text-[10.5px] text-ink-faint tabular">{e.detail?.tool_defs_fingerprint ? `${e.detail.tool_defs_fingerprint.slice(0, 10)}…` : "—"}</div>
      <div className="font-mono text-[10.5px] text-ink-faint tabular">{e.completedAt ? e.completedAt.slice(0, 10) : "—"}</div>
    </div>
  );
}

function MobileCard({ e }: { e: GradedEntry }) {
  return (
    <div className="md:hidden border-t hairline px-1 py-4">
      <div className="flex items-start gap-3">
        <div className="pt-0.5">{e.grade ? <Stamp grade={e.grade} /> : <span className="inline-flex h-8 w-8 items-center justify-center font-mono text-ink-faint">{e.ownMcp ? "·" : "—"}</span>}</div>
        <div className="min-w-0 flex-1">
          <div className="flex items-baseline justify-between gap-2">
            <ProjectLink e={e} />
            <span className="font-mono text-[10px] text-ink-faint tabular whitespace-nowrap">{e.completedAt ? e.completedAt.slice(0, 10) : ""}</span>
          </div>
          <CategoryLine e={e} />
          <div className="mt-1.5">
            <RefCell e={e} size="text-[11px]" />
          </div>
          <div className="mt-2 font-mono text-[11px]">
            {e.grade ? (
              <span className="inline-flex gap-3">
                <span>C-01 <Check status={e.detail?.c01 ?? null} /></span>
                <span>C-02 <Check status={e.detail?.c02 ?? null} /></span>
                <span>C-03 <Check status={e.detail?.c03 ?? null} /></span>
              </span>
            ) : (
              <span className="text-ink-faint">{e.ownMcp ? `grade pending${e.pending ? ` · ${e.pending}` : ""}` : "no standalone MCP"}</span>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

/** Within a cohort: graded first (A→F), then own-MCP-pending, then no-MCP. */
function sortRows(rows: GradedEntry[]): GradedEntry[] {
  const rank = (e: GradedEntry) => (e.grade ? GRADE_ORDER.indexOf(e.grade) : e.ownMcp ? 100 : 200);
  return [...rows].sort((a, b) => rank(a) - rank(b) || a.project.localeCompare(b.project));
}

function CohortSection({ label, rows }: { label: string; rows: GradedEntry[] }) {
  if (rows.length === 0) return null;
  return (
    <>
      <div className="section-label pt-7 pb-1 px-3">
        {label} <span className="text-ink-faint">· {rows.length}</span>
      </div>
      {sortRows(rows).map((e) => (
        <div key={`${e.project}-${e.mcpRef ?? e.handle}`}>
          <DesktopRow e={e} />
          <MobileCard e={e} />
        </div>
      ))}
    </>
  );
}

export default async function BaseIndexPage() {
  const entries = await loadBaseIndex();
  const graded = entries.filter((e) => e.grade);
  const pending = entries.filter((e) => !e.grade && e.ownMcp);
  const noMcp = entries.filter((e) => !e.ownMcp);
  const methodology = graded[0]?.detail?.methodology_version ?? "litmus";

  const counts = GRADE_ORDER.map((g) => ({ g, n: graded.filter((e) => e.grade === g).length })).filter((c) => c.n > 0);

  return (
    <main className="flex-1">
      <article className="mx-auto max-w-5xl px-6 pt-14 pb-24 md:pt-20 md:pb-28">
        <header className="mb-9">
          <p className="section-label mb-4">Private · unpublished · {methodology}</p>
          <h1 className="font-serif text-4xl md:text-5xl text-ink tracking-tight leading-[1.05]">Base-network MCP index</h1>
          <p className="mt-5 font-serif italic text-ink-muted text-lg md:text-xl leading-snug max-w-2xl">
            Independent, reproducible behavioral grades for the MCP servers an onchain agent on Base
            can use — the projects integrating Base MCP, and the wider DeFi, data, and infrastructure
            servers that support the network.
          </p>
        </header>

        {/* Distribution strip — grades at a glance. */}
        <div className="mb-8 flex flex-wrap items-center gap-x-6 gap-y-3">
          <div className="flex h-2 w-44 overflow-hidden rounded-full border hairline">
            {counts.map(({ g, n }) => (
              <span key={g} style={{ backgroundColor: GRADE_HEX[g], flexGrow: n }} title={`${n} × ${g}`} />
            ))}
          </div>
          <div className="flex flex-wrap items-center gap-x-4 gap-y-1 font-mono text-[11px] text-ink-muted">
            {counts.map(({ g, n }) => (
              <span key={g} className="inline-flex items-center gap-1.5">
                <span className="inline-block h-2 w-2 rounded-[1px]" style={{ backgroundColor: GRADE_HEX[g] }} />
                {n}<span className="text-ink-faint">{g}</span>
              </span>
            ))}
            <span className="text-ink-faint">· {graded.length} graded · {pending.length} pending · {noMcp.length} no&nbsp;MCP</span>
          </div>
        </div>

        {/* Thesis: pull-quote the audit hook + the methodology caveats. */}
        <figure className="mb-9 border-l-2 pl-5" style={{ borderColor: "var(--color-oxblood)" }}>
          <blockquote className="font-serif text-ink text-lg md:text-xl leading-snug">
            Base&rsquo;s own skill states its plugins are &ldquo;built by third parties&hellip; Base
            doesn&rsquo;t operate, endorse, or audit them.&rdquo; <span className="text-oxblood">This is that audit</span>
            {" "}— extended to the wider set of Base-supporting MCP servers.
          </blockquote>
          <figcaption className="mt-3 text-[13px] leading-relaxed text-ink-muted max-w-2xl">
            Each server is graded on its own MCP surface. Grades reflect the testable surface
            (state-changing tools aren&rsquo;t exercised by default); remote-only servers cap at{" "}
            <strong className="text-ink-muted">B</strong> (egress unverifiable), npm servers run
            sandboxed and can reach A, and a C-04 (adversarial-input) failure caps a grade at D.{" "}
            <span className="text-oxblood/70">3rd-party</span> marks a community wrapper rather than the
            protocol&rsquo;s own server. These rows are <strong className="text-ink-muted">not published</strong>{" "}
            — no public badge or report shows them.
          </figcaption>
        </figure>

        {/* Header row (desktop) */}
        <div className="hidden md:grid grid-cols-[2.75rem_minmax(120px,1.25fr)_minmax(150px,1.9fr)_8.5rem_5.5rem_4.5rem] items-center gap-x-5 px-3 pb-1 section-label">
          <div>Grade</div>
          <div>Project</div>
          <div>MCP server</div>
          <div className="grid grid-cols-3 gap-x-3 text-center w-[8.5rem]"><span>C-01</span><span>C-02</span><span>C-03</span></div>
          <div>Surface</div>
          <div>Graded</div>
        </div>

        {GROUP_ORDER.map((g) => (
          <CohortSection key={g} label={GROUP_LABEL[g]} rows={entries.filter((e) => e.group === g)} />
        ))}

        <p className="mt-9 font-mono text-[11px] text-ink-faint leading-relaxed border-t hairline pt-5">
          C-01 tool-output injection · C-02 permission/egress overreach · C-03 sensitive-data handling ·
          C-04 adversarial input (off-table; caps the letter at D). Surface = tool-definitions fingerprint
          (sha256, first bytes). Reproduce any grade by re-running the open harness against the same ref.
          Each server links to its polygraph report; see the full{" "}
          <Link href="/rankings" className="underline decoration-dotted underline-offset-2 hover:text-oxblood transition-colors">
            MCP Security Index
          </Link>
          .
        </p>
      </article>
    </main>
  );
}
