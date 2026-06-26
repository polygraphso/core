/**
 * /mcp/<registry>/<owner>/<name> — the per-server grade report and the home for
 * the embeddable badge/card snippets. The inline badge and the card both link
 * here, so it's the verifiable destination behind every embed: grade, the three
 * onchain category slots, methodology, and how to reproduce the result.
 *
 * Versionless: the catch-all ref is canonicalized to its server key and the
 * latest published grade is shown (see lib/badgeData). An ungraded server gets a
 * "request a grade" funnel rather than a dead page.
 */

import { cache } from "react";
import type { Metadata } from "next";
import Link from "next/link";
import { decodeRef, loadGrade, refToPath, isRemoteKey } from "@/lib/badgeData";
import { GRADE_HEX } from "@/lib/gradeColors";
import type { LitmusGrade, PolygraphDetail } from "@/lib/hostedGrades";
import { getSupabaseAdmin } from "@/lib/supabase";
import { fetchAdoptionForServer, type ServerAdoption } from "@/lib/rankings";
import { EmbedSnippets } from "./_components/EmbedSnippets";
import { FixCta } from "@/app/_components/FixCta";

const ORIGIN = "https://polygraph.so";

// generateMetadata and the page both need the grade; cache() collapses them to
// one query per request.
const getGrade = cache(loadGrade);

// The server's adoption score (reach), shown alongside the grade. Cached per
// request; degrades to null when Supabase is unconfigured or the server is untracked.
const getAdoption = cache(async (key: string): Promise<ServerAdoption | null> => {
  const db = getSupabaseAdmin();
  return db ? fetchAdoptionForServer(db, key) : null;
});

// Cache the rendered report for 10 min per ref; a regrade surfaces within the
// window. The badge/card images carry the heavier, shorter cache.
export const revalidate = 600;

type Params = Promise<{ ref?: string[] }>;

/** Catch-all segments → canonical server key, or null if unparseable. */
function keyFromParams(parts: string[] | undefined): string | null {
  if (!parts || parts.length === 0) return null;
  // Next hands catch-all segments percent-encoded to the page render (so a
  // scope `@scope` arrives as `%40scope`). Decode each segment back to its
  // literal form — a no-op when already decoded — so the key matches the DB
  // target (`npm/@scope/name`) and the on-page URLs read cleanly.
  let raw: string;
  try {
    raw = parts.map((s) => decodeURIComponent(s)).join("/");
  } catch {
    return null; // malformed percent-encoding in the path
  }
  return decodeRef(raw);
}

function shortFingerprint(fp: string | null): string | null {
  if (!fp) return null;
  if (fp.length <= 16) return fp;
  return `${fp.slice(0, 8)}…${fp.slice(-5)}`;
}

/** Category status → color: pass green, skip/none neutral, fail/partial oxblood. */
function statusColor(status: string | null): string {
  if (status === "pass") return GRADE_HEX.A;
  if (!status || status.startsWith("skip")) return "var(--color-ink-faint)";
  return "var(--color-oxblood)";
}

export async function generateMetadata({ params }: { params: Params }): Promise<Metadata> {
  const { ref } = await params;
  const key = keyFromParams(ref);
  if (!key) {
    return { title: "MCP server grade", robots: { index: false, follow: true } };
  }
  const path = refToPath(key);
  const canonical = `/mcp/${path}`;
  const cardUrl = `/api/badge/card?server=${path}`;
  const result = await getGrade(key);
  if (result) {
    const title = `polygraph: ${key} — grade ${result.grade}`;
    return {
      title,
      description: `${key} scored ${result.grade} on the polygraph behavioral litmus (${result.detail.methodology_version}). A reproducible, evidence-backed grade.`,
      alternates: { canonical },
      openGraph: { title, url: canonical, images: [cardUrl] },
      twitter: { card: "summary_large_image", images: [cardUrl] },
      // Registry grades are version-pinned and indexable; a remote endpoint is
      // mutable/unversioned, so its report stays out of the index.
      robots: { index: !isRemoteKey(key), follow: true },
    };
  }
  const title = `polygraph: ${key} — not yet graded`;
  return {
    title,
    description: `${key} hasn't been graded by polygraph yet. Request a behavioral litmus grade.`,
    alternates: { canonical },
    openGraph: { title, url: canonical, images: [cardUrl] },
    robots: { index: false, follow: true },
  };
}

export default async function McpServerPage({ params }: { params: Params }) {
  const { ref } = await params;
  const key = keyFromParams(ref);

  return (
    <main className="flex-1">
      <section className="mx-auto max-w-3xl px-6 pt-20 pb-24 md:pt-24 md:pb-32">
        <div className="border-t hairline pt-6 mb-10">
          <div className="flex items-baseline gap-4">
            <span className="section-label tabular">§ MCP</span>
            <span className="section-label">/</span>
            <span className="section-label">Behavioral grade</span>
          </div>
        </div>

        {!key ? <Fallback /> : <Report serverKey={key} />}
      </section>
    </main>
  );
}

async function Report({ serverKey }: { serverKey: string }) {
  // Adoption ranking is registry-only; a remote endpoint has no adoption row.
  const [result, adoption] = await Promise.all([
    getGrade(serverKey),
    isRemoteKey(serverKey) ? Promise.resolve(null) : getAdoption(serverKey),
  ]);
  const path = refToPath(serverKey);
  const badgeUrl = `${ORIGIN}/api/badge?server=${path}`;
  const cardUrl = `${ORIGIN}/api/badge/card?server=${path}`;
  const pageUrl = `${ORIGIN}/mcp/${path}`;

  return result ? (
    <Graded
      serverKey={serverKey}
      grade={result.grade}
      detail={result.detail}
      adoption={adoption}
      badgeUrl={badgeUrl}
      cardUrl={cardUrl}
      pageUrl={pageUrl}
    />
  ) : (
    <Ungraded
      serverKey={serverKey}
      adoption={adoption}
      badgeUrl={badgeUrl}
      cardUrl={cardUrl}
      pageUrl={pageUrl}
    />
  );
}

/** Small reach line — adoption score (0–100) + the download/stars proxy. Reach, not safety. */
function AdoptionLine({ adoption }: { adoption: ServerAdoption | null }) {
  if (!adoption) return null;
  const dated = adoption.computedAt ? adoption.computedAt.slice(0, 10) : null;
  const signal = adoption.adoptionSignal && adoption.adoptionSignal !== "—" ? adoption.adoptionSignal : null;
  return (
    <p
      className="mt-6 font-mono text-[11.5px] text-ink-faint leading-relaxed"
      title="Adoption (0–100): downloads + stars + dependents + release velocity — reach, not safety"
    >
      <span className="uppercase tracking-[0.14em]">Adoption</span>{" "}
      <span className="text-ink">{Math.round(adoption.adoptionScore)}</span>
      <span>/100</span>
      {signal ? (
        <>
          {" · "}
          <span className="text-ink-muted">{signal}</span>
        </>
      ) : null}
      {dated ? <> · as of {dated}</> : null}
    </p>
  );
}

/** Explains the adoption score and lists the raw signals that fed it. */
function AdoptionSignals({ adoption }: { adoption: ServerAdoption | null }) {
  if (!adoption || adoption.metrics.length === 0) return null;
  return (
    <div className="mt-12 border-t hairline pt-6">
      <h2 className="font-serif text-lg text-ink mb-2">Adoption signals</h2>
      <p className="font-sans text-[13px] text-ink-muted leading-relaxed max-w-xl mb-4">
        The <span className="text-ink">{Math.round(adoption.adoptionScore)} / 100</span> adoption
        score blends the raw signals below — downloads, stars, dependents and release velocity —
        normalized across every tracked server. It measures{" "}
        <span className="text-ink">reach, not safety</span>; the litmus grade is the safety
        verdict. See the{" "}
        <Link
          href="/methodology"
          className="text-ink border-b hairline border-dotted hover:text-oxblood transition-colors"
        >
          methodology
        </Link>
        .
      </p>
      <dl className="border-t hairline">
        {adoption.metrics.map((m) => (
          <div
            key={m.label}
            className="flex items-baseline justify-between gap-4 border-b hairline py-2"
          >
            <dt className="font-mono text-[12px] text-ink-muted">{m.label}</dt>
            <dd className="font-mono text-[12px] text-ink tabular text-right">{m.value}</dd>
          </div>
        ))}
      </dl>
    </div>
  );
}

const CATEGORY_LABELS: Array<{ code: "C-01" | "C-02" | "C-03" | "C-04"; name: string }> = [
  { code: "C-01", name: "Tool-output injection" },
  { code: "C-02", name: "Permission / egress overreach" },
  { code: "C-03", name: "Sensitive-data handling" },
  { code: "C-04", name: "Adversarial-input handling" },
];

function statusFor(detail: PolygraphDetail, code: "C-01" | "C-02" | "C-03" | "C-04"): string | null {
  if (code === "C-01") return detail.c01;
  if (code === "C-02") return detail.c02;
  if (code === "C-03") return detail.c03;
  return detail.c04;
}

function Graded({
  serverKey,
  grade,
  detail,
  adoption,
  badgeUrl,
  cardUrl,
  pageUrl,
}: {
  serverKey: string;
  grade: LitmusGrade;
  detail: PolygraphDetail;
  adoption: ServerAdoption | null;
  badgeUrl: string;
  cardUrl: string;
  pageUrl: string;
}) {
  const fp = shortFingerprint(detail.tool_defs_fingerprint);
  const dated = detail.computed_at?.slice(0, 10) ?? null;

  return (
    <>
      <div className="flex items-start gap-6">
        <span
          className="font-serif text-7xl md:text-8xl leading-none shrink-0"
          style={{ color: GRADE_HEX[grade] }}
          aria-label={`Grade ${grade}`}
        >
          {grade}
        </span>
        <div className="min-w-0">
          <h1 className="font-mono text-lg md:text-xl text-ink break-words leading-snug">
            {serverKey}
          </h1>
          <p className="mt-2 font-mono text-[11.5px] text-ink-faint leading-relaxed">
            {detail.resolved_version ? (
              <>
                graded version{" "}
                <span className="text-ink-muted">{detail.resolved_version}</span> ·{" "}
              </>
            ) : null}
            <Link
              href="/methodology"
              className="text-ink-muted border-b hairline border-dotted hover:text-oxblood transition-colors"
            >
              {detail.methodology_version}
            </Link>
            {dated ? <> · {dated}</> : null}
          </p>
        </div>
      </div>

      <AdoptionLine adoption={adoption} />

      {/* category breakdown */}
      <dl className="mt-10 border-t hairline">
        {CATEGORY_LABELS.map(({ code, name }) => {
          const status = statusFor(detail, code);
          return (
            <div
              key={code}
              className="flex items-baseline justify-between gap-4 border-b hairline py-3"
            >
              <dt className="font-mono text-[12px] text-ink-muted">
                <span className="text-ink-faint">{code}</span> {name}
              </dt>
              <dd className="font-mono text-[12px] text-right" style={{ color: statusColor(status) }}>
                {status ?? "—"}
              </dd>
            </div>
          );
        })}
      </dl>

      {fp ? (
        <p className="mt-3 font-mono text-[11px] text-ink-faint">
          tool-defs fingerprint · <span className="text-ink-muted">{fp}</span>
        </p>
      ) : null}

      {detail.rationale ? (
        <p className="mt-8 font-sans text-[13.5px] text-ink-muted leading-relaxed max-w-xl">
          <span className="font-mono text-[11px] uppercase tracking-[0.14em] text-ink">
            Why {grade}:
          </span>{" "}
          {detail.rationale}
        </p>
      ) : null}

      {/* how to fix — only when there's something to fix (non-A) */}
      {grade !== "A" ? <FixCta target={serverKey} kind="mcp" /> : null}

      <AdoptionSignals adoption={adoption} />

      {/* reproduce — trust rests on re-runnability, not on a claim */}
      <div className="mt-12 border-t hairline pt-6">
        <h2 className="font-serif text-lg text-ink mb-2">Reproduce this grade</h2>
        <p className="font-sans text-[13px] text-ink-muted leading-relaxed max-w-xl">
          The harness is open and deterministic. Re-run it against the same server and
          compare the grade and fingerprint — a false grade is{" "}
          <Link
            href="/methodology#reproducibility"
            className="text-ink border-b hairline border-dotted hover:text-oxblood transition-colors"
          >
            falsifiable, not merely disputable
          </Link>
          .
        </p>
        <pre className="mt-3 overflow-x-auto rounded-sm border hairline bg-parchment-50 px-4 py-3 font-mono text-[12.5px] text-ink">
          <code>npx -p @polygraphso/litmus polygraphso-litmus {serverKey}</code>
        </pre>
      </div>

      {/* embed */}
      <div className="mt-12 border-t hairline pt-6">
        <h2 className="font-serif text-lg text-ink mb-1">Embed this badge</h2>
        <p className="font-sans text-[13px] text-ink-muted leading-relaxed max-w-xl mb-5">
          Drop it in a README, docs site, or package page. It always shows the current
          published grade and links back here.
        </p>
        <div className="mb-5">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={badgeUrl} alt={`polygraph grade ${grade}`} height={20} />
        </div>
        <EmbedSnippets badgeUrl={badgeUrl} cardUrl={cardUrl} pageUrl={pageUrl} />
      </div>
    </>
  );
}

function Ungraded({
  serverKey,
  adoption,
  badgeUrl,
  cardUrl,
  pageUrl,
}: {
  serverKey: string;
  adoption: ServerAdoption | null;
  badgeUrl: string;
  cardUrl: string;
  pageUrl: string;
}) {
  return (
    <>
      <h1 className="font-serif text-3xl md:text-4xl tracking-tight text-ink leading-[1.1] max-w-2xl">
        <span className="font-mono text-[0.7em] text-ink bg-parchment-200 px-1.5 py-0.5 align-baseline">
          {serverKey}
        </span>{" "}
        hasn&rsquo;t been graded yet.
      </h1>

      <p className="mt-6 max-w-xl text-ink-muted leading-relaxed">
        No published polygraph for this server. Unevaluated is neither safe nor unsafe —
        it just means the litmus battery hasn&rsquo;t been run against it.
      </p>

      <AdoptionLine adoption={adoption} />

      <div className="mt-8 flex flex-wrap gap-3">
        <Link
          href={`/notify?for=${serverKey}`}
          className="inline-flex items-center gap-2 bg-ink text-parchment px-5 py-3 font-mono text-sm tracking-wide hover:bg-oxblood transition-colors"
        >
          Notify me when it&rsquo;s graded
        </Link>
        <Link
          href="/request"
          className="inline-flex items-center gap-2 border hairline px-5 py-3 font-mono text-sm tracking-wide text-ink-muted hover:text-ink transition-colors"
        >
          Request a grade now
        </Link>
      </div>

      <AdoptionSignals adoption={adoption} />

      <div className="mt-12 border-t hairline pt-6">
        <h2 className="font-serif text-lg text-ink mb-1">Embed the badge anyway</h2>
        <p className="font-sans text-[13px] text-ink-muted leading-relaxed max-w-xl mb-5">
          It reads <span className="font-mono">unrated</span>{" "}
          today and updates itself to the grade the moment one publishes — no edit needed.
        </p>
        <div className="mb-5">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={badgeUrl} alt="polygraph grade unrated" height={20} />
        </div>
        <EmbedSnippets badgeUrl={badgeUrl} cardUrl={cardUrl} pageUrl={pageUrl} />
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
        Address a server by its registry-prefixed ref in the path, for example:
      </p>
      <pre className="mt-6 border hairline bg-parchment-50 px-4 py-4 font-mono text-sm text-ink overflow-x-auto">
        <code>/mcp/npm/@modelcontextprotocol/server-filesystem</code>
      </pre>
      <p className="mt-6 max-w-xl text-ink-muted leading-relaxed">
        See the{" "}
        <Link
          href="/docs/api#server-ref"
          className="text-ink border-b hairline border-dotted hover:text-oxblood transition-colors"
        >
          server-ref format
        </Link>{" "}
        for the three registry variants.
      </p>
    </>
  );
}
