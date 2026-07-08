import type { Metadata } from "next";
import Link from "next/link";
import { BuildersTooling } from "@/app/_components/BuildersTooling";

export const metadata: Metadata = {
  title: "Builders",
  description:
    "Grade an MCP server A to F with the open litmus harness: install it in your agent, run it from your terminal, gate CI with the GitHub Action, or embed a live README badge. All self-serve, all free.",
};

// The builders surface: everything a maintainer of an MCP server or skill needs,
// self-serve. Lives on its own page so the homepage can lead with ecosystem
// monitoring; the tooling here is what the homepage's one-line "for builders"
// link points to.
export default function BuildersPage() {
  return (
    <>
      <header className="mx-auto max-w-6xl px-6 pt-16 md:pt-24 pb-14">
        <p className="font-mono text-[11px] uppercase tracking-[0.2em] text-ink-faint mb-4">
          Builders
        </p>
        <h1 className="font-serif text-4xl md:text-5xl leading-[1.05] tracking-tight text-ink max-w-[20ch]">
          Grade a server. Gate your CI. Ship a badge.
        </h1>
        <p className="mt-6 max-w-2xl text-ink-muted text-lg leading-relaxed">
          The open litmus harness grades an MCP server A to F with reproducible,
          content-addressed evidence. Add it to your agent, run it from your terminal, gate a build
          on it, or embed a live badge. All self-serve, all free.
        </p>

        {/* Cross-sell up to the revenue motion: builders who run a whole network. */}
        <div className="mt-6 inline-flex flex-wrap items-center gap-3 rounded-[5px] border hairline bg-parchment-50 px-4 py-3">
          <span className="font-mono text-[12px] text-ink-muted">
            Run a whole network, not just your own tools?
          </span>
          <Link
            href="/ecosystems"
            className="font-mono text-[12px] uppercase tracking-[0.14em] text-oxblood border-b border-dotted border-[color:var(--color-oxblood-soft)] hover:text-ink transition-colors"
          >
            Ecosystem monitoring →
          </Link>
        </div>
      </header>

      <BuildersTooling />

      <div className="mx-auto max-w-6xl px-6 pb-20 md:pb-28">
        <p className="font-mono text-[11px] text-ink-faint leading-relaxed border-t hairline pt-5">
          Every grade is behavioral and reproducible. Re-run the open harness against the same
          ref to check it. Browse the full{" "}
          <Link
            href="/mcp-index"
            className="text-ink-muted underline decoration-dotted underline-offset-2 hover:text-oxblood transition-colors"
          >
            MCP Security Index
          </Link>
          , or read the{" "}
          <Link
            href="/methodology"
            className="text-ink-muted underline decoration-dotted underline-offset-2 hover:text-oxblood transition-colors"
          >
            methodology
          </Link>
          .
        </p>
      </div>
    </>
  );
}
