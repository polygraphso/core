/**
 * /monitor — per-server new-version regrade alerts.
 *
 * Deep-linked from a graded /mcp or /skill report ("Monitor this →
 * /monitor?for=<ref>"). Leave an email; when the target changes, polygraph
 * re-runs the litmus and emails the new grade. One email per change, with a
 * one-click unsubscribe in every message.
 *
 * Accepts the refs with a version stream: npm/pypi package versions, and the
 * github commit behind a skill (github/owner/repo#path) or a github server.
 */

import type { Metadata } from "next";
import Link from "next/link";
import { ServerRefParseError, parseServerRef, serverKey } from "@/lib/identity";
import { decodeSkillRef } from "@/lib/skillGrades";
import { getSession } from "@/lib/session";
import { MonitorForm } from "./_components/MonitorForm";

export const metadata: Metadata = {
  title: "Monitor a server or skill",
  description:
    "Get an email when a monitored MCP server or skill changes and polygraph re-grades it.",
  alternates: { canonical: "/monitor" },
  robots: { index: false, follow: true },
};

type SearchParams = Promise<{ [key: string]: string | string[] | undefined }>;

type TargetKind = "server" | "skill";

type Resolution =
  | { kind: "ok"; ref: string; targetKind: TargetKind }
  | { kind: "unmonitorable" }
  | { kind: "none" };

function resolveServerRef(raw: string | undefined): Resolution {
  if (!raw || raw.length === 0 || raw.length > 512) return { kind: "none" };
  // A '#' marks a skill ref (github/owner/repo#path); accept the slash-path form too.
  if (raw.includes("#")) {
    const canonical = decodeSkillRef(raw);
    if (canonical && canonical.startsWith("github/") && canonical.includes("#")) {
      return { kind: "ok", ref: canonical, targetKind: "skill" };
    }
    return { kind: "unmonitorable" };
  }
  try {
    const parsed = parseServerRef(raw);
    if (parsed.registry === "npm" || parsed.registry === "pypi") {
      return { kind: "ok", ref: serverKey(parsed), targetKind: "server" };
    }
    // github servers are monitorable via their commit stream; an immutable @commit
    // pin is not (nothing to watch).
    if (parsed.registry === "github" && !parsed.version) {
      return { kind: "ok", ref: serverKey(parsed), targetKind: "server" };
    }
    return { kind: "unmonitorable" };
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
      <section className="mx-auto max-w-3xl">
        <div className="border-t hairline pt-6 mb-10">
          <div className="flex items-baseline gap-4">
            <span className="section-label tabular">§ MONITOR</span>
            <span className="section-label">/</span>
            <span className="section-label">New-version alerts</span>
          </div>
        </div>

        {resolution.kind === "ok" ? (
          <Tracked serverRef={resolution.ref} targetKind={resolution.targetKind} />
        ) : resolution.kind === "unmonitorable" ? (
          <Unmonitorable />
        ) : (
          <Fallback />
        )}
      </section>
  );
}

async function Tracked({ serverRef, targetKind }: { serverRef: string; targetKind: TargetKind }) {
  const session = await getSession();
  const isSkill = targetKind === "skill";

  return (
    <>
      <h1 className="font-serif text-3xl md:text-4xl tracking-tight text-ink leading-[1.1] max-w-2xl">
        Watch{" "}
        <span className="font-mono text-[0.85em] text-ink bg-parchment-200 px-1.5 py-0.5 align-baseline">
          {serverRef}
        </span>{" "}
        for {isSkill ? "changes" : "new-version regrades"}.
      </h1>

      <p className="mt-6 max-w-xl text-ink-muted leading-relaxed">
        {isSkill ? (
          <>
            A grade is a snapshot of the skill&rsquo;s files at one commit. When a new
            commit changes this skill, polygraph re-runs the litmus and emails you the
            new grade &mdash; one message per change, nothing else.
          </>
        ) : (
          <>
            A grade is a snapshot of one version. When this server publishes a new
            version, polygraph re-runs the behavioral litmus and emails you the new
            grade &mdash; one message per new version, nothing else.
          </>
        )}
      </p>

      <div className="mt-10 max-w-xl">
        {session ? (
          <MonitorForm mode="signed-in" serverRef={serverRef} sessionEmail={session.email} />
        ) : (
          <MonitorForm mode="anonymous" serverRef={serverRef} />
        )}
      </div>

      <div className="mt-14 border-t hairline pt-6 font-mono text-[11.5px] text-ink-faint max-w-xl leading-relaxed">
        Every alert carries a one-click unsubscribe.
        {!isSkill && (
          <>
            {" "}Not graded yet?{" "}
            <Link
              href={`/notify?for=${serverRef}`}
              className="text-ink hover:text-oxblood transition-colors underline decoration-dotted underline-offset-4"
            >
              Get notified when it&rsquo;s first graded
            </Link>
            .
          </>
        )}
      </div>
    </>
  );
}

function Unmonitorable() {
  return (
    <>
      <h1 className="font-serif text-3xl md:text-4xl tracking-tight text-ink leading-[1.1] max-w-2xl">
        This reference can&rsquo;t be monitored.
      </h1>

      <p className="mt-6 max-w-xl text-ink-muted leading-relaxed">
        Monitoring watches a version stream: an npm/pypi package version, or the
        github commit behind a skill or a github server. A remote https endpoint or
        a ref pinned to a fixed commit doesn&rsquo;t publish a stream we can track.
      </p>

      <pre className="mt-6 border hairline bg-parchment-50 px-4 py-4 font-mono text-sm text-ink overflow-x-auto leading-relaxed">
        <code>/monitor?for=npm/@scope/server{"\n"}/monitor?for=github/owner/repo#skill-name</code>
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
