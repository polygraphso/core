/**
 * /notify — per-server notify funnel.
 *
 * Deep-linked from the CLI ("not available yet · get notified when it lands
 * → polygraph.so/notify?for=<server_ref>") and from a soon-to-ship MCP tool.
 *
 * Distinct from the landing newsletter (which lives on the homepage). This
 * page is targeted: one ref, one notify request. See landing-brief.md
 * §"Signup lanes (do not blur)" for the separation rule.
 */

import type { Metadata } from "next";
import Link from "next/link";
import { ServerRefParseError, parseServerRef, serverKey } from "@/lib/identity";
import { getSession } from "@/lib/session";
import { NotifyForm } from "./_components/NotifyForm";

export const metadata: Metadata = {
  title: "Notify me",
  description:
    "Get notified when a specific MCP server gets its first polygraph.",
  alternates: { canonical: "/notify" },
  robots: { index: false, follow: true },
};

type SearchParams = Promise<{ [key: string]: string | string[] | undefined }>;

function resolveServerRef(raw: string | undefined): string | null {
  if (!raw || raw.length === 0 || raw.length > 512) return null;
  try {
    return serverKey(parseServerRef(raw));
  } catch (err) {
    if (err instanceof ServerRefParseError) return null;
    throw err;
  }
}

export default async function NotifyPage({
  searchParams,
}: {
  searchParams: SearchParams;
}) {
  const params = await searchParams;
  const rawFor = Array.isArray(params.for) ? params.for[0] : params.for;
  const serverRef = resolveServerRef(rawFor);

  return (
    <main className="flex-1">
      <section className="mx-auto max-w-3xl px-6 pt-20 pb-24 md:pt-24 md:pb-32">
        <div className="border-t hairline pt-6 mb-10">
          <div className="flex items-baseline gap-4">
            <span className="section-label tabular">§ NOTIFY</span>
            <span className="section-label">/</span>
            <span className="section-label">Per-server</span>
          </div>
        </div>

        {serverRef ? <Tracked serverRef={serverRef} /> : <Fallback />}
      </section>
    </main>
  );
}

async function Tracked({ serverRef }: { serverRef: string }) {
  const session = await getSession();

  return (
    <>
      <h1 className="font-serif text-3xl md:text-4xl tracking-tight text-ink leading-[1.1] max-w-2xl">
        Notify me when{" "}
        <span className="font-mono text-[0.85em] text-ink bg-parchment-200 px-1.5 py-0.5 align-baseline">
          {serverRef}
        </span>{" "}
        gets its first polygraph.
      </h1>

      <p className="mt-6 max-w-xl text-ink-muted leading-relaxed">
        This server isn&rsquo;t in the tracked set yet. Leave your email and
        we&rsquo;ll send one message when it&rsquo;s evaluated &mdash; no
        drip, no newsletter, no queue position.
      </p>

      <div className="mt-10 max-w-xl">
        {session ? (
          <NotifyForm
            mode="signed-in"
            serverRef={serverRef}
            sessionEmail={session.email}
          />
        ) : (
          <NotifyForm mode="anonymous" serverRef={serverRef} />
        )}
      </div>

      <div className="mt-14 border-t hairline pt-6 font-mono text-[11.5px] text-ink-faint max-w-xl leading-relaxed">
        Want broader updates instead?{" "}
        <Link href="/#updates" className="text-ink hover:text-oxblood transition-colors underline decoration-dotted underline-offset-4">
          Subscribe to new-polygraph announcements
        </Link>
        .
      </div>
    </>
  );
}

function Fallback() {
  return (
    <>
      <h1 className="font-serif text-3xl md:text-4xl tracking-tight text-ink leading-[1.1] max-w-2xl">
        This page expects a server reference.
      </h1>

      <p className="mt-6 max-w-xl text-ink-muted leading-relaxed">
        The /notify page is the per-server funnel reached from the CLI. To get
        here for a specific server, run:
      </p>

      <pre className="mt-6 border hairline bg-parchment-50 px-4 py-4 font-mono text-sm text-ink overflow-x-auto">
        <code>npx polygraphso check &lt;server&gt;</code>
      </pre>

      <p className="mt-6 max-w-xl text-ink-muted leading-relaxed">
        If the server isn&rsquo;t tracked yet, the CLI prints a link back here
        with the right reference attached.
      </p>

      <div className="mt-14 border-t hairline pt-6 font-mono text-[11.5px] text-ink-faint max-w-xl leading-relaxed">
        Looking for broadcast updates on every new polygraph?{" "}
        <Link href="/#updates" className="text-ink hover:text-oxblood transition-colors underline decoration-dotted underline-offset-4">
          Subscribe on the landing page
        </Link>
        .
      </div>
    </>
  );
}
