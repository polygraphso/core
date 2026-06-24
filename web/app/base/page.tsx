import type { Metadata } from "next";
import { loadBaseIndex, type GradedEntry } from "@/lib/baseIndex";
import { GRADE_HEX } from "@/lib/gradeColors";

/**
 * UNLISTED Base MCP ecosystem index. Not linked from nav/footer, not in any
 * sitemap, robots noindex — reachable only by direct link. Reads grades live
 * from hosted_runs INCLUDING unpublished rows (see lib/baseIndex), so it shows
 * grades that are not yet public anywhere else. Keep it private until a publish
 * decision is made per server.
 */
export const metadata: Metadata = {
  title: "Base MCP ecosystem — polygraph (private)",
  robots: { index: false, follow: false },
};

// Always render per-request against runtime env + the latest grade rows.
export const dynamic = "force-dynamic";

const INK = "var(--color-ink)";
const FAINT = "var(--color-ink-faint)";

/** Category status → accent: pass green, skip/none faint, fail/partial oxblood. */
function statusColor(status: string | null): string {
  if (status === "pass") return GRADE_HEX.A;
  if (!status || status.startsWith("skip")) return FAINT;
  return GRADE_HEX.F; // fail / partial
}

function GradePill({ grade }: { grade: keyof typeof GRADE_HEX }) {
  return (
    <span
      className="inline-flex h-6 w-6 items-center justify-center rounded-sm font-mono text-[13px] font-semibold text-parchment-50"
      style={{ backgroundColor: GRADE_HEX[grade] }}
    >
      {grade}
    </span>
  );
}

function Cat({ status }: { status: string | null }) {
  const label = !status ? "—" : status.startsWith("skip") ? "skip" : status;
  return (
    <span className="font-mono text-[11px]" style={{ color: statusColor(status) }}>
      {label}
    </span>
  );
}

function Row({ e }: { e: GradedEntry }) {
  return (
    <tr className="border-t hairline align-top">
      <td className="py-3 pr-3">
        <a
          href={`https://x.com/${e.handle}`}
          target="_blank"
          rel="noreferrer noopener"
          className="text-ink hover:text-oxblood transition-colors"
        >
          {e.project}
        </a>
        {e.category ? <div className="font-mono text-[10.5px] text-ink-faint">{e.category}</div> : null}
      </td>
      <td className="py-3 pr-3">
        {e.mcpRef ? (
          <code className="font-mono text-[11.5px] text-ink-muted break-all">{e.mcpRef}</code>
        ) : (
          <span className="font-mono text-[11px] text-ink-faint">no standalone MCP{e.note ? ` · ${e.note}` : ""}</span>
        )}
      </td>
      <td className="py-3 pr-3 whitespace-nowrap">
        {e.grade ? (
          <GradePill grade={e.grade} />
        ) : e.ownMcp ? (
          <span className="font-mono text-[11px] text-ink-faint" title={e.note ?? undefined}>
            pending{e.pending ? ` · ${e.pending}` : ""}
          </span>
        ) : (
          <span className="font-mono text-[11px] text-ink-faint">—</span>
        )}
      </td>
      <td className="py-3 pr-3"><Cat status={e.detail?.c01 ?? null} /></td>
      <td className="py-3 pr-3"><Cat status={e.detail?.c02 ?? null} /></td>
      <td className="py-3 pr-3"><Cat status={e.detail?.c03 ?? null} /></td>
      <td className="py-3 pr-3 whitespace-nowrap">
        <span className="font-mono text-[10.5px] text-ink-faint">
          {e.detail?.tool_defs_fingerprint ? `${e.detail.tool_defs_fingerprint.slice(0, 10)}…` : "—"}
        </span>
      </td>
      <td className="py-3 whitespace-nowrap">
        <span className="font-mono text-[10.5px] text-ink-faint">
          {e.completedAt ? e.completedAt.slice(0, 10) : "—"}
        </span>
      </td>
    </tr>
  );
}

export default async function BaseIndexPage() {
  const entries = await loadBaseIndex();
  const graded = entries.filter((e) => e.grade);
  const pending = entries.filter((e) => !e.grade && e.ownMcp);
  const noMcp = entries.filter((e) => !e.ownMcp);
  const methodology = graded[0]?.detail?.methodology_version ?? "litmus";

  return (
    <main className="flex-1">
      <article className="mx-auto max-w-5xl px-6 pt-14 pb-24 md:pt-20 md:pb-28">
        <header className="mb-10">
          <p className="section-label mb-4">Private · unpublished · {methodology}</p>
          <h1 className="font-serif text-4xl md:text-5xl text-ink tracking-tight leading-[1.05]">
            Base MCP ecosystem
          </h1>
          <p className="mt-5 font-serif italic text-ink-muted text-lg md:text-xl leading-snug max-w-2xl">
            Independent, reproducible behavioral grades for the projects integrating Base MCP —
            graded on the projects&rsquo; own MCP servers, not the Base gateway.
          </p>
        </header>

        <div className="mb-10 rounded-sm border hairline bg-parchment-50 px-4 py-3 text-[13px] leading-relaxed text-ink-muted">
          <p>
            Base MCP is one hosted gateway; its 13 named integrations are plugin specs, not separate
            servers. Of those 13, <strong className="text-ink">8 ship their own MCP server</strong> and
            are independently gradeable. Base&rsquo;s own skill states the plugins are{" "}
            <em>&ldquo;built by third parties&hellip; Base doesn&rsquo;t operate, endorse, or audit them.&rdquo;</em>{" "}
            This is that audit.
          </p>
          <p className="mt-2 text-ink-faint">
            Grades reflect the testable surface (state-changing tools are not exercised by default).
            Remote-only servers cap at <strong className="text-ink-muted">B</strong> (egress
            unverifiable); npm servers run sandboxed and can reach A. C-04 (adversarial input) caps a
            grade at D. These rows are <strong className="text-ink-muted">not published</strong> — no
            public badge or report page shows them.
          </p>
        </div>

        <table className="w-full text-left">
          <thead>
            <tr className="section-label">
              <th className="pb-2 pr-3 font-normal">Project</th>
              <th className="pb-2 pr-3 font-normal">MCP server</th>
              <th className="pb-2 pr-3 font-normal">Grade</th>
              <th className="pb-2 pr-3 font-normal">C-01</th>
              <th className="pb-2 pr-3 font-normal">C-02</th>
              <th className="pb-2 pr-3 font-normal">C-03</th>
              <th className="pb-2 pr-3 font-normal">Surface</th>
              <th className="pb-2 font-normal">Graded</th>
            </tr>
          </thead>
          <tbody>
            {graded.length > 0 && (
              <tr><td colSpan={8} className="pt-5 pb-1 section-label" style={{ color: INK }}>Graded</td></tr>
            )}
            {graded.map((e) => <Row key={`${e.project}-${e.mcpRef}`} e={e} />)}

            {pending.length > 0 && (
              <tr><td colSpan={8} className="pt-6 pb-1 section-label">Own MCP · grade pending</td></tr>
            )}
            {pending.map((e) => <Row key={`${e.project}-${e.mcpRef}`} e={e} />)}

            {noMcp.length > 0 && (
              <tr><td colSpan={8} className="pt-6 pb-1 section-label">No standalone MCP</td></tr>
            )}
            {noMcp.map((e) => <Row key={`${e.project}-${e.handle}`} e={e} />)}
          </tbody>
        </table>

        <p className="mt-8 font-mono text-[11px] text-ink-faint leading-relaxed">
          C-01 tool-output injection · C-02 permission/egress overreach · C-03 sensitive-data handling ·
          C-04 adversarial input (off-table; caps the letter at D). Reproduce any grade by re-running the
          open harness against the same ref. Surface = tool-definitions fingerprint (sha256, first bytes).
        </p>
      </article>
    </main>
  );
}
