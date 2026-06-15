import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "API",
  description:
    "Public HTTP endpoints behind the polygraphso CLI. POST /api/cli/check looks up a server; GET /api/cli/list returns every tracked server with its adoption tier and polygraph.",
  alternates: { canonical: "/docs/api" },
};

const NOTIFY_URL =
  "https://polygraph.so/notify?for=npm/@modelcontextprotocol/server-filesystem";

function Section({
  num,
  label,
  children,
  id,
}: {
  num: string;
  label: string;
  id?: string;
  children: React.ReactNode;
}) {
  return (
    <section id={id} className="mt-16 first:mt-0 scroll-mt-24">
      <div className="flex items-baseline gap-3 mb-5">
        <span className="font-mono text-[11px] uppercase tracking-[0.18em] text-ink-faint tabular">
          §{num}
        </span>
        <h2 className="font-serif text-2xl md:text-3xl text-ink tracking-tight">
          {label}
        </h2>
      </div>
      <div className="space-y-4 text-ink-muted leading-relaxed">{children}</div>
    </section>
  );
}

function Code({ children }: { children: React.ReactNode }) {
  return (
    <pre className="mt-3 mb-1 overflow-x-auto rounded-sm border hairline bg-parchment-50 px-4 py-3 font-mono text-[12.5px] leading-relaxed text-ink">
      <code>{children}</code>
    </pre>
  );
}

function Inline({ children }: { children: React.ReactNode }) {
  return (
    <code className="font-mono text-[0.92em] text-ink bg-parchment-200/60 px-1 py-[1px] rounded-sm">
      {children}
    </code>
  );
}

function Method({ verb, path }: { verb: string; path: string }) {
  return (
    <div className="mt-1 mb-2 flex items-center gap-3 font-mono text-[13px]">
      <span className="px-2 py-[2px] bg-ink text-parchment uppercase tracking-[0.14em] text-[10.5px]">
        {verb}
      </span>
      <span className="text-ink">{path}</span>
    </div>
  );
}

export default function ApiDocsPage() {
  return (
    <main className="flex-1">
      <div className="border-b hairline">
        <div className="mx-auto max-w-6xl px-6 py-3 flex items-center justify-between font-mono text-[11px] uppercase tracking-[0.18em] text-ink-muted">
          <a href="/" className="flex items-center gap-3 hover:text-ink transition-colors">
            <span aria-hidden className="inline-block w-1.5 h-1.5 bg-oxblood" />
            <span className="text-ink">polygraph.so</span>
          </a>
          <nav className="hidden sm:flex items-center gap-5">
            <a href="/" className="hover:text-ink transition-colors">
              Home
            </a>
            <a href="/methodology" className="hover:text-ink transition-colors">
              Methodology
            </a>
          </nav>
        </div>
      </div>

      <article className="mx-auto max-w-3xl px-6 pt-14 pb-24 md:pt-20 md:pb-32">
        <header className="mb-14">
          <p className="section-label mb-4">Docs · API · v0</p>
          <h1 className="font-serif text-4xl md:text-5xl text-ink tracking-tight leading-[1.05]">
            HTTP API
          </h1>
          <p className="mt-5 font-serif italic text-ink-muted text-lg md:text-xl leading-snug max-w-2xl">
            Two public endpoints behind the <Inline>polygraphso</Inline> CLI.
            Same data, same shape — pick whichever you prefer to integrate
            against.
          </p>
        </header>

        <Section num="01" label="Overview" id="overview">
          <p>
            The API exposes two endpoints: a lookup for a single server and a
            full list of everything we track. Both are read-only, anonymous,
            and serve the same data the CLI displays.
          </p>
          <ul className="list-none space-y-1 mt-2">
            <li>
              <span className="text-ink-faint">Base URL · </span>
              <Inline>https://polygraph.so</Inline>
            </li>
            <li>
              <span className="text-ink-faint">Auth · </span>none on these
              endpoints; subscriber endpoints land later under a separate path.
            </li>
            <li>
              <span className="text-ink-faint">Rate limit · </span>none
              currently. We'll publish a budget here if we add one.
            </li>
            <li>
              <span className="text-ink-faint">Content type · </span>
              <Inline>application/json</Inline> in and out.
            </li>
          </ul>
          <p>
            Prefer the CLI for ergonomics:{" "}
            <Inline>npx polygraphso check &lt;ref&gt;</Inline> and{" "}
            <Inline>npx polygraphso list</Inline>. The CLI hits these same
            routes.
          </p>
        </Section>

        <Section num="02" label="Server-ref format" id="server-ref">
          <p>
            Every server we track is addressed by a registry-prefixed reference.
            Three variants, each matching its registry's native namespace:
          </p>
          <Code>
{`npm/<package>@<version>           name (unscoped) or @scope/name (scoped)
pypi/<name>@<version>             flat — no owner segment
github/<owner>/<repo>@<version>   owner required`}
          </Code>
          <p>Real examples from the tracked set:</p>
          <Code>
{`npm/@modelcontextprotocol/server-filesystem
npm/@notionhq/notion-mcp-server
pypi/mcp-server-git
pypi/mcp-server-fetch`}
          </Code>
          <p>
            The version segment is optional. Server lookups are versionless —{" "}
            <Inline>1.0.0</Inline> and <Inline>1.0.1</Inline> of the same
            package resolve to the same server record. Adoption tier and
            polygraph are reported for the latest tracked version.
          </p>
        </Section>

        <Section num="03" label="Check a server" id="check">
          <Method verb="POST" path="/api/cli/check" />
          <p>
            Looks up one server. Returns its adoption tier and polygraph if we
            track it, or a notify URL if we don't.
          </p>

          <h3 className="font-serif text-lg text-ink mt-6 mb-2">Request</h3>
          <Code>
{`{
  "server_ref": "npm/@modelcontextprotocol/server-filesystem"
}`}
          </Code>

          <h3 className="font-serif text-lg text-ink mt-6 mb-2">
            Response · tracked
          </h3>
          <Code>
{`{
  "status": "tracked",
  "adoption_tier": "top10",
  "polygraph": null,
  "notify_url": "${NOTIFY_URL}"
}`}
          </Code>
          <p className="text-sm">
            <span className="text-ink-faint">Note · </span>
            <Inline>polygraph</Inline> is <Inline>null</Inline> on every
            tracked server today. Published litmus-v2 grades are rolling out;
            until a server&rsquo;s grade lands, adoption tier is the live
            signal.{" "}
            <Inline>adoption_tier</Inline> is one of{" "}
            <Inline>top10</Inline>, <Inline>top25</Inline>,{" "}
            <Inline>top50</Inline>, <Inline>top100</Inline>, or{" "}
            <Inline>null</Inline> (tracked but unranked).
          </p>

          <h3 className="font-serif text-lg text-ink mt-6 mb-2">
            Response · not tracked
          </h3>
          <Code>
{`{
  "status": "not_available",
  "notify_url": "https://polygraph.so/notify?for=npm/some-owner/some-package"
}`}
          </Code>
          <p className="text-sm">
            A miss bumps an anonymous counter so we can see which untracked
            servers are most in demand. No request body is logged beyond the
            ref itself.
          </p>

          <h3 className="font-serif text-lg text-ink mt-6 mb-2">curl</h3>
          <Code>
{`curl -X POST https://polygraph.so/api/cli/check \\
  -H 'content-type: application/json' \\
  -d '{"server_ref":"npm/@modelcontextprotocol/server-filesystem"}'`}
          </Code>

          <h3 className="font-serif text-lg text-ink mt-6 mb-2">Errors</h3>
          <ul className="list-none space-y-1 text-sm">
            <li>
              <Inline>400</Inline> — missing, malformed, or too-long{" "}
              <Inline>server_ref</Inline>. The body includes a short{" "}
              <Inline>error</Inline> string.
            </li>
            <li>
              <Inline>500</Inline> — lookup failed server-side. Safe to retry.
            </li>
          </ul>
        </Section>

        <Section num="04" label="List every tracked server" id="list">
          <Method verb="GET" path="/api/cli/list" />
          <p>
            Returns every server we currently track, sorted by adoption tier
            (top10 first), then alphabetically within tier. No pagination in
            v0 — the tracked set is small and the payload is well under a
            megabyte. We'll add pagination here if the list grows past that.
          </p>

          <h3 className="font-serif text-lg text-ink mt-6 mb-2">
            Response shape
          </h3>
          <Code>
{`{
  "servers": [
    {
      "server_ref": "npm/@modelcontextprotocol/server-filesystem",
      "adoption_tier": "top10",
      "polygraph": null
    },
    {
      "server_ref": "pypi/mcp-server-git",
      "adoption_tier": "top25",
      "polygraph": null
    }
  ],
  "total": 78
}`}
          </Code>
          <p className="text-sm">
            <Inline>polygraph</Inline> is <Inline>null</Inline> today on every
            row. As published grades roll out, it becomes one of{" "}
            <Inline>"A"</Inline>, <Inline>"B"</Inline>, <Inline>"D"</Inline>,{" "}
            <Inline>"F"</Inline> (there is no C — see the{" "}
            <a
              href="/methodology"
              className="text-ink hover:text-oxblood transition-colors border-b hairline border-dotted"
            >
              rubric
            </a>
            ), or the sentinel <Inline>"pending"</Inline> while a run is
            scheduled.
          </p>

          <h3 className="font-serif text-lg text-ink mt-6 mb-2">curl</h3>
          <Code>{`curl https://polygraph.so/api/cli/list`}</Code>
        </Section>

        <Section num="05" label="Versioning" id="versioning">
          <p>
            v0 changes are additive. We add fields; we don't remove or rename
            them. A breaking change — a removed field, a renamed key, a changed
            shape — would ship under a new path (<Inline>/api/v1/...</Inline>),
            and the v0 path would keep its existing behavior for a deprecation
            window we'll announce here.
          </p>
          <p>
            The harness version that produced a given polygraph will be exposed
            on the grade payload once behavioral grading lands, so grades stay
            comparable within a harness version.
          </p>
        </Section>

        <Section num="06" label="Stability" id="stability">
          <p>
            These endpoints are the contract the CLI is built against, so the
            URLs and field names are stable. The notify URL pattern (
            <Inline>polygraph.so/notify?for=&lt;ref&gt;</Inline>) is stable too;
            it's the same place the website's "tell me when this is graded"
            funnel writes to.
          </p>
          <p>
            What isn't stable yet: the cadence of behavioral grade
            publication. The methodology and rubric are documented at{" "}
            <a
              href="/methodology"
              className="text-ink hover:text-oxblood transition-colors border-b hairline border-dotted"
            >
              /methodology
            </a>
            .
          </p>
        </Section>

        <Section num="07" label="See also" id="see-also">
          <ul className="list-none space-y-1">
            <li>
              <a
                href="/llms.txt"
                className="text-ink hover:text-oxblood transition-colors border-b hairline border-dotted"
              >
                /llms.txt
              </a>{" "}
              <span className="text-ink-faint">
                · short, machine-readable summary for agents.
              </span>
            </li>
            <li>
              <a
                href="/"
                className="text-ink hover:text-oxblood transition-colors border-b hairline border-dotted"
              >
                Landing
              </a>{" "}
              <span className="text-ink-faint">
                · positioning, principles, who we are.
              </span>
            </li>
          </ul>
        </Section>
      </article>
    </main>
  );
}
