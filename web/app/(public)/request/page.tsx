import type { Metadata } from "next";
import { getSession } from "@/lib/session";
import { RequestForm } from "./_components/RequestForm";

export const metadata: Metadata = {
  title: "Request a grade",
  description:
    "Ask us to run the litmus battery on an MCP server you care about. Free — add it to the queue and we'll email you when its grade publishes.",
  alternates: { canonical: "/request" },
  openGraph: {
    title: "Request a grade · polygraph.so",
    description:
      "Ask us to run the litmus battery on an MCP server you care about. Free — we'll email you when its grade publishes.",
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
          <p className="section-label mb-4">Grade queue · free</p>
          <h1 className="font-serif text-4xl md:text-5xl text-ink tracking-tight leading-[1.05]">
            Request a grade.
          </h1>
          <p className="mt-5 font-serif italic text-ink-muted text-lg md:text-xl leading-snug">
            Want a server graded that isn&rsquo;t up yet? Add it to the bench.
            We work the queue on our own timeline &mdash; demand moves servers
            up &mdash; and email you when the grade publishes. A paid 48-hour
            lane is offered once it&rsquo;s queued.
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
