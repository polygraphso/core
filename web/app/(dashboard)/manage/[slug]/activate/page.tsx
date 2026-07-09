/**
 * /manage/[slug]/activate — the activation ("lock") page an unpaid ecosystem's
 * console redirects to. Pitches what a monitored ecosystem gets, shows the
 * USD-pegged price in $POLYGRAPH, and walks the member through paying: swap
 * anything into $POLYGRAPH (embedded LI.FI widget), then stream it to the
 * polygraph treasury for 12 months via Sablier. The server verifies the stream
 * onchain; the console unlocks the moment it checks out.
 *
 * Any member of the ecosystem can view and pay. An already-active ecosystem is
 * bounced back to its console.
 */

import { redirect } from "next/navigation";
import { getSession } from "@/lib/session";
import { getEcosystemRole } from "@/lib/ecosystemAccess";
import { getPaymentGate } from "@/lib/ecosystemPayments";
import { DEFAULT_MONTHLY_PRICE_USD, TERM_MONTHS } from "@/lib/paymentConfig";
import { ActivateFlow } from "./_components/ActivateFlow";

export const dynamic = "force-dynamic";

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  return { title: `Activate monitoring · ${slug} · polygraph`, robots: { index: false } };
}

const BENEFITS = [
  {
    n: "01",
    title: "Re-grade, on a clock",
    body:
      "Every MCP server and skill your ecosystem tracks is re-run through the open litmus on a schedule — the same behavioral test behind every public grade, repeated so the grades stay measurements, not memories.",
  },
  {
    n: "02",
    title: "Drift and rug-pull detection",
    body:
      "A grade drop, a newly failing probe, or a changed tool surface (the sha256 fingerprint mismatch that is the signature of a rug pull) is caught by the next run — not by your users.",
  },
  {
    n: "03",
    title: "CVEs to fix, weekly",
    body:
      "Known vulnerabilities (GHSA/OSV) affecting the packages behind your entries, filtered to the severity floor you set, delivered as one weekly digest with the fix versions.",
  },
  {
    n: "04",
    title: "Your alert strategy, your console",
    body:
      "The private management console: curate entries, configure what alerts fire and who receives them, and see remediation guidance per entry — while the public index page stays live for your users.",
  },
];

export default async function ActivatePage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const session = await getSession();
  if (!session) redirect(`/login?next=/manage/${slug}/activate`);

  const access = await getEcosystemRole(session, slug);
  if (!access) redirect("/manage");
  const { ecosystem } = access;

  const gate = await getPaymentGate(ecosystem);
  if (gate.status === "active") redirect(`/manage/${slug}`);

  const usdMonthly = ecosystem.monthly_price_usd ?? DEFAULT_MONTHLY_PRICE_USD;
  const usdTotal = usdMonthly * TERM_MONTHS;

  return (
    <main className="px-6 sm:px-10 py-12 max-w-4xl">
      <header className="mb-12">
        <a
          href="/manage"
          className="section-label mb-3 inline-block hover:text-oxblood transition-colors"
        >
          ← Ecosystems
        </a>
        <p className="section-label mb-4">Activate monitoring</p>
        <h1 className="font-serif text-3xl md:text-4xl text-ink tracking-tight leading-[1.1]">
          {ecosystem.name} is set up — monitoring isn&rsquo;t running yet.
        </h1>
        <p className="mt-4 text-ink-muted text-[15px] leading-relaxed max-w-2xl">
          Continuous monitoring is what keeps an index honest: the same open test, re-run on a
          clock, with alerts when something moves. It starts when your ecosystem commits{" "}
          <span className="text-ink">${usdTotal.toLocaleString("en-US")} in $POLYGRAPH</span>,
          streamed to the polygraph treasury over {TERM_MONTHS} months. Cancel the stream anytime —
          the unstreamed remainder returns to the payer and monitoring stops.
        </p>
      </header>

      {/* What a monitored ecosystem gets. */}
      <section className="mb-14">
        <p className="section-label mb-4">What you get</p>
        <ol className="border-t hairline">
          {BENEFITS.map((b) => (
            <li key={b.n} className="grid md:grid-cols-12 gap-3 md:gap-10 border-b hairline py-6">
              <div className="md:col-span-3 flex md:flex-col items-baseline md:items-start justify-between md:justify-start gap-3">
                <span className="font-mono text-[11px] uppercase tracking-[0.18em] text-ink-faint tabular">
                  {b.n}
                </span>
                <h3 className="font-serif text-lg md:text-xl leading-tight text-ink">{b.title}</h3>
              </div>
              <div className="md:col-span-9 text-ink-muted text-[15px] leading-relaxed">{b.body}</div>
            </li>
          ))}
        </ol>
        <p className="mt-4 text-[13px] leading-relaxed text-ink-faint max-w-2xl">
          The engagement changes what we re-grade and how often — never the letter we publish. A
          monitored ecosystem&rsquo;s grades stay as reproducible, and as disprovable, as anyone
          else&rsquo;s.
        </p>
      </section>

      {/* The payment flow (client island: wallet + swap + stream). */}
      <ActivateFlow slug={slug} ecosystemName={ecosystem.name} usdMonthly={usdMonthly} />
    </main>
  );
}
