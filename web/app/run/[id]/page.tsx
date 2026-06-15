import type { Metadata } from "next";
import { fetchRunForDisplay } from "@/lib/runs";
import { RunView } from "./_components/RunView";

// Status + payment + report page for a hosted run. The client component
// fetches /api/runs/:id and polls while the run is in flight, so this
// page is a thin shell — but share metadata is resolved server-side so
// a tweeted report link carries the grade in its title, matching the
// OG card.

export async function generateMetadata({
  params,
}: {
  params: Promise<{ id: string }>;
}): Promise<Metadata> {
  const { id } = await params;
  const run = await fetchRunForDisplay(id);

  const base: Metadata = {
    robots: { index: false, follow: false },
  };

  if (!run) {
    return { ...base, title: "Run report" };
  }
  if (run.status === "complete" && run.grade) {
    return {
      ...base,
      title: `${run.grade} · ${run.target}`,
      description:
        run.rationale ??
        `${run.methodology_version ?? "litmus"} hosted run — grade ${run.grade}. Evidence and per-check results at this URL.`,
    };
  }
  return {
    ...base,
    title: `${run.target} — hosted run`,
    description:
      "A behavioral litmus run on an MCP server. The report publishes at this URL when the run completes.",
  };
}

export default async function RunReportPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;

  return (
    <main className="flex-1">
      <div className="border-b hairline">
        <div className="mx-auto max-w-6xl px-6 py-3 flex items-center justify-between font-mono text-[11px] uppercase tracking-[0.18em] text-ink-muted">
          <a
            href="/"
            className="flex items-center gap-3 hover:text-ink transition-colors"
          >
            <span aria-hidden className="inline-block w-1.5 h-1.5 bg-oxblood" />
            <span className="text-ink">polygraph.so</span>
          </a>
          <nav className="hidden sm:flex items-center gap-5">
            <a href="/run" className="hover:text-ink transition-colors">
              New run
            </a>
            <a href="/methodology" className="hover:text-ink transition-colors">
              Methodology
            </a>
          </nav>
        </div>
      </div>

      <div className="mx-auto max-w-3xl px-6 pt-14 pb-24 md:pt-20 md:pb-32">
        <RunView runId={id} />
      </div>
    </main>
  );
}
