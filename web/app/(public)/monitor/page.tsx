/**
 * /monitor — per-server new-version regrade alerts.
 *
 * Deep-linked from a graded /mcp report ("Monitor this server →
 * /monitor?for=<server_ref>"). Leave an email; when the server ships a new
 * version, polygraph re-runs the litmus and emails the new grade. One email per
 * new-version regrade, with a one-click unsubscribe in every message.
 *
 * v1 accepts npm/pypi refs only — the targets with a version stream we can watch.
 */

import type { Metadata } from "next";
import Link from "next/link";
import { ServerRefParseError, parseServerRef, serverKey } from "@/lib/identity";
import { getSession } from "@/lib/session";
import { MonitorForm } from "./_components/MonitorForm";

export const metadata: Metadata = {
  title: "Monitor a server",
  description:
    "Get an email when an MCP server ships a new version and polygraph re-grades it.",
  alternates: { canonical: "/monitor" },
  robots: { index: false, follow: true },
};

type SearchParams = Promise<{ [key: string]: string | string[] | undefined }>;

type Resolution =
  | { kind: "ok"; ref: string }
  | { kind: "unmonitorable" }
  | { kind: "none" };

function resolveServerRef(raw: string | undefined): Resolution {
  if (!raw || raw.length === 0 || raw.length > 512) return { kind: "none" };
  try {
    const parsed = parseServerRef(raw);
    if (parsed.registry !== "npm" && parsed.registry !== "pypi") {
      return { kind: "unmonitorable" };
    }
    return { kind: "ok", ref: serverKey(parsed) };
  } catch (err) {
    if (err instanceof ServerRefParseError) return { kind: "unmonitorable" };
    throw err;
  }
}

export default async function MonitorPage({
  searchParams,
}: {
  searchParams: SearchParams;
}) {
  const params = await searchParams;
  const rawFor = Array.isArray(params.for) ? params.for[0] : params.for;
  const resolution = resolveServerRef(rawFor);

  return (
      <section className="max-w-3xl">
        <div className="border-t hairline pt-6 mb-10">
          <div className="flex items-baseline gap-4">
            <span className="section-label tabular">§ MONITOR</span>
            <span className="section-label">/</span>
            <span className="section-label">New-version alerts</span>
          </div>
        </div>

        {resolution.kind === "ok" ? (
          <Tracked serverRef={resolution.ref} />
        ) : resolution.kind === "unmonitorable" ? (
          <Unmonitorable />
        ) : (
          <Fallback />
        )}
      </section>
  );
}

async function Tracked({ serverRef }: { serverRef: string }) {
  const session = await getSession();

  return (
    <>
      <h1 className="font-serif text-3xl md:text-4xl tracking-tight text-ink leading-[1.1] max-w-2xl">
        Watch{" "}
        <span className="font-mono text-[0.85em] text-ink bg-parchment-200 px-1.5 py-0.5 align-baseline">
          {serverRef}
        </span>{" "}
        for new-version regrades.
      </h1>

      <p className="mt-6 max-w-xl text-ink-muted leading-relaxed">
        A grade is a snapshot of one version. When this server publishes a new
        version, polygraph re-runs the behavioral litmus and emails you the new
        grade &mdash; one message per new version, nothing else.
      </p>

      <div className="mt-10 max-w-xl">
        {session ? (
          <MonitorForm mode="signed-in" serverRef={serverRef} sessionEmail={session.email} />
        ) : (
          <MonitorForm mode="anonymous" serverRef={serverRef} />
        )}
      </div>

      <div className="mt-14 border-t hairline pt-6 font-mono text-[11.5px] text-ink-faint max-w-xl leading-relaxed">
        Every alert carries a one-click unsubscribe. Not graded yet?{" "}
        <Link
          href={`/notify?for=${serverRef}`}
          className="text-ink hover:text-oxblood transition-colors underline decoration-dotted underline-offset-4"
        >
          Get notified when it&rsquo;s first graded
        </Link>
        .
      </div>
    </>
  );
}

function Unmonitorable() {
  return (
    <>
      <h1 className="font-serif text-3xl md:text-4xl tracking-tight text-ink leading-[1.1] max-w-2xl">
        Monitoring is available for npm and pypi servers.
      </h1>

      <p className="mt-6 max-w-xl text-ink-muted leading-relaxed">
        New-version alerts watch a package&rsquo;s registry version stream, so v1
        supports npm and pypi refs. Remote endpoints and github-only refs
        don&rsquo;t publish a version we can track yet.
      </p>

      <pre className="mt-6 border hairline bg-parchment-50 px-4 py-4 font-mono text-sm text-ink overflow-x-auto">
        <code>/monitor?for=npm/@scope/server</code>
      </pre>
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
        Reach /monitor for a specific server from its graded report page, or pass
        the ref directly:
      </p>

      <pre className="mt-6 border hairline bg-parchment-50 px-4 py-4 font-mono text-sm text-ink overflow-x-auto">
        <code>/monitor?for=npm/@scope/server</code>
      </pre>
    </>
  );
}
