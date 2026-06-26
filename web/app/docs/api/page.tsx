import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "API",
  description:
    "Public HTTP endpoints behind the polygraphso CLI. POST /api/cli/check looks up a server's polygraph grade; GET /api/cli/list returns every graded server.",
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
          <p>Real examples:</p>
          <Code>
{`npm/@modelcontextprotocol/server-filesystem
npm/@notionhq/notion-mcp-server
pypi/mcp-server-git
pypi/mcp-server-fetch`}
          </Code>
          <p>
            The version segment is optional and version-aware. A pinned{" "}
            <Inline>@version</Inline> returns the grade for that exact version. A
            bare ref resolves the version in play — the installed version (CLI)
            or the registry&rsquo;s current latest — and returns its grade; if
            that version isn&rsquo;t graded yet, the most recent graded version
            is returned and flagged (<Inline>version_match: false</Inline>).
          </p>
        </Section>

        <Section num="03" label="Check a server" id="check">
          <Method verb="POST" path="/api/cli/check" />
          <p>
            Looks up one server&rsquo;s published polygraph grade, or a notify
            URL if it hasn&rsquo;t been graded yet.
          </p>

          <h3 className="font-serif text-lg text-ink mt-6 mb-2">Request</h3>
          <Code>
{`{
  "server_ref": "npm/@modelcontextprotocol/server-filesystem"
}`}
          </Code>

          <h3 className="font-serif text-lg text-ink mt-6 mb-2">
            Response · graded
          </h3>
          <Code>
{`{
  "status": "graded",
  "polygraph": "A",
  "polygraph_detail": {
    "grade": "A",
    "c01": "pass",
    "c02": "pass",
    "c03": "pass",
    "tool_defs_fingerprint": "0x256a…66db6",
    "methodology_version": "litmus-v10",
    "resolved_version": "1.4.0",
    "rationale": "All three categories passed.",
    "computed_at": "2026-06-11T14:14:04Z"
  },
  "current_version": "1.4.0",
  "version_match": true,
  "notify_url": "${NOTIFY_URL}"
}`}
          </Code>
          <p className="text-sm">
            <span className="text-ink-faint">Note · </span>
            <Inline>polygraph</Inline> is one of <Inline>"A"</Inline>,{" "}
            <Inline>"B"</Inline>, <Inline>"D"</Inline>, <Inline>"F"</Inline>{" "}
            (there is no C — see the{" "}
            <a
              href="/methodology"
              className="text-ink hover:text-oxblood transition-colors border-b hairline border-dotted"
            >
              rubric
            </a>
            ). <Inline>polygraph_detail.resolved_version</Inline> is the version
            that was graded; <Inline>current_version</Inline> is the version in
            play, and <Inline>version_match</Inline> is{" "}
            <Inline>false</Inline> when an older graded version is returned
            because the current one isn&rsquo;t graded yet.
          </p>

          <h3 className="font-serif text-lg text-ink mt-6 mb-2">
            Response · not graded
          </h3>
          <Code>
{`{
  "status": "not_available",
  "notify_url": "https://polygraph.so/notify?for=npm/some-owner/some-package"
}`}
          </Code>
          <p className="text-sm">
            A miss bumps an anonymous demand counter so we can see which
            ungraded servers are most in demand. No request body is logged
            beyond the ref itself.
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
              <Inline>429</Inline> — rate limited (per-IP). Back off and retry
              after the <Inline>Retry-After</Inline> interval.
            </li>
            <li>
              <Inline>500</Inline> — lookup failed server-side. Safe to retry.
            </li>
          </ul>
        </Section>

        <Section num="04" label="List graded servers" id="list">
          <Method verb="GET" path="/api/cli/list" />
          <p>
            Returns every server with a published polygraph grade, sorted by
            grade (A first), then alphabetically. No pagination in v0 — the
            graded set is small and the payload is well under a megabyte. We'll
            add pagination here if it grows past that.
          </p>

          <h3 className="font-serif text-lg text-ink mt-6 mb-2">
            Response shape
          </h3>
          <Code>
{`{
  "servers": [
    {
      "server_ref": "npm/@modelcontextprotocol/server-filesystem",
      "polygraph": "A"
    },
    {
      "server_ref": "npm/@upstash/context7-mcp",
      "polygraph": "D"
    }
  ],
  "total": 6
}`}
          </Code>
          <p className="text-sm">
            <Inline>polygraph</Inline> is one of <Inline>"A"</Inline>,{" "}
            <Inline>"B"</Inline>, <Inline>"D"</Inline>, <Inline>"F"</Inline>{" "}
            (there is no C — see the{" "}
            <a
              href="/methodology"
              className="text-ink hover:text-oxblood transition-colors border-b hairline border-dotted"
            >
              rubric
            </a>
            ). Only graded servers appear; check a specific ungraded server
            with <Inline>/api/cli/check</Inline>.
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

        <Section num="07" label="Embeddable badge" id="badge">
          <p>
            A live grade badge any server can embed — in a README, on npm, or on a
            docs site. Three artifacts, all keyed by the same server ref, all
            served from the canonical grade so they update themselves when a grade
            changes.
          </p>
          <Method verb="GET" path="/api/badge?server=<ref>" />
          <p>
            A small inline SVG pill (<Inline>image/svg+xml</Inline>) —{" "}
            <Inline>polygraph · A</Inline>, colored by grade. An ungraded server
            renders a muted <Inline>unrated</Inline> pill rather than an error, so
            it&rsquo;s safe to embed before a grade exists.
          </p>
          <Method verb="GET" path="/api/badge/card?server=<ref>" />
          <p>
            A larger card image (<Inline>image/png</Inline>) with the grade, the
            three category slots, and the methodology version.
          </p>
          <Method verb="GET" path="/mcp/<ref>" />
          <p>
            The human-readable grade report the badge and card link to — category
            breakdown, fingerprint, and the command to reproduce the grade. It
            also hosts ready-to-copy embed snippets.
          </p>
          <h3 className="font-serif text-lg text-ink mt-6 mb-2">Markdown</h3>
          <Code>
{`[![polygraph](https://polygraph.so/api/badge?server=npm/@modelcontextprotocol/server-filesystem)](https://polygraph.so/mcp/npm/@modelcontextprotocol/server-filesystem)`}
          </Code>
          <p className="text-sm">
            <span className="text-ink-faint">Note · </span>the ref is passed
            unencoded in the query string (<Inline>/</Inline> and{" "}
            <Inline>@</Inline> are legal there). Images are cached at the CDN; a
            regrade propagates within the hour.
          </p>
        </Section>

        <Section num="08" label="See also" id="see-also">
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
