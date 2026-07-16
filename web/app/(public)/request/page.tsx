import type { Metadata } from "next";
import { getSession } from "@/lib/session";
import { RequestForm } from "./_components/RequestForm";

export const metadata: Metadata = {
  title: "Request a grade",
  description:
    "Ask us to run the litmus battery on an MCP server you care about. $1 in $POLYGRAPH per server or skill, graded within 48 hours of payment.",
  alternates: { canonical: "/request" },
  openGraph: {
    title: "Request a grade · polygraph.so",
    description:
      "Ask us to run the litmus battery on an MCP server you care about. $1 per server or skill, graded within 48 hours of payment.",
    url: "/request",
  },
};

// Public by design: this is the only funnel for getting an ungraded server
// graded (the /mcp-index CTA and every ungraded report page point here), so it
// must work without an account. A signed-in session just pre-fills the email;
// a ?target= (from an ungraded report's CTA) pre-fills the server.
export default async function RequestPage({
  searchParams,
}: {
  searchParams: Promise<{ target?: string }>;
}) {
  const session = await getSession();

  const { target } = await searchParams;
  const initialTarget = typeof target === "string" ? target.slice(0, 512) : "";

  return (
      <div className="mx-auto max-w-3xl">
        <header className="mb-10">
          <p className="section-label mb-4">Request a grade · $1 · 48h</p>
          <h1 className="font-serif text-4xl md:text-5xl text-ink tracking-tight leading-[1.05]">
            Request a grade.
          </h1>
          <p className="mt-5 font-serif italic text-ink-muted text-lg md:text-xl leading-snug">
            Want a server graded that isn&rsquo;t up yet? Request it, pay the $1
            fee in $POLYGRAPH, and it&rsquo;s graded within 48 hours. The fee
            buys the run, never the grade &mdash; and every grade stays
            reproducible with the open harness.
          </p>
        </header>

        <RequestForm sessionEmail={session?.email ?? null} initialTarget={initialTarget} />

        <p className="mt-8 font-mono text-[11px] text-ink-faint leading-relaxed">
          Just want to hear about new grades in general?{" "}
          <a
            href="/#updates"
            className="text-ink-muted border-b hairline border-dotted hover:text-ink transition-colors"
          >
            Subscribe on the homepage
          </a>{" "}
          instead &mdash; one email per publishing drop.
        </p>
      </div>
  );
}
