/**
 * /ecosystems/[slug]/activate — the PUBLIC activation page for one ecosystem:
 * the link sent to a prospective client. Pitches what monitored means, shows
 * the ecosystem's USD-pegged price in $POLYGRAPH, and takes the payment right
 * there: swap anything into $POLYGRAPH (embedded LI.FI widget), then stream it
 * to the polygraph treasury month by month via Sablier.
 *
 * No account needed — payment is wallet-based and the server verifies the
 * stream onchain, so a client can pay before they ever sign in. An unpaid
 * ecosystem's private console (/manage/[slug]) redirects here; a signed-in
 * member who pays is bounced straight back to the console.
 *
 * Always noindex: it names a per-ecosystem price, and it's a link to send,
 * not a page to rank.
 */

import { notFound } from "next/navigation";
import { getSession } from "@/lib/session";
import { getEcosystemRole } from "@/lib/ecosystemAccess";
import { getEcosystemBySlug } from "@/lib/ecosystemData";
import { getPaymentGate } from "@/lib/ecosystemPayments";
import { DEFAULT_MONTHLY_PRICE_USD } from "@/lib/paymentConfig";
import { ActivateFlow } from "./_components/ActivateFlow";

export const dynamic = "force-dynamic";

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const ecosystem = await getEcosystemBySlug(slug);
  return {
    title: `Activate monitoring · ${ecosystem?.name ?? slug} · polygraph`,
    robots: { index: false, follow: false },
  };
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
    title: "Add tools as you grow",
    body:
      "Add new MCP servers and skills to the tracked set anytime; each addition is graded immediately and joins the monitoring rotation from that day's run.",
  },
  {
    n: "05",
    title: "Your alert strategy, your console",
    body:
      "The private management console: curate entries, configure what alerts fire and who receives them, and see remediation guidance per entry.",
  },
  {
    n: "06",
    title: "A public index, on the homepage",
    body:
      "Your ecosystem gets a curated public page listing its tools with their live grades, for anyone to check — and monitored ecosystems are featured on the polygraph.so homepage.",
  },
];

export default async function ActivatePage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const ecosystem = await getEcosystemBySlug(slug);
  if (!ecosystem) notFound();

  const gate = await getPaymentGate(ecosystem);

  // A signed-in member lands back in the console after paying; a client with
  // no account gets an inline success state instead.
  const session = await getSession();
  const access = session ? await getEcosystemRole(session, slug) : null;
  const consoleHref = access ? `/manage/${slug}` : null;

  const usdMonthly = ecosystem.monthly_price_usd ?? DEFAULT_MONTHLY_PRICE_USD;

  return (
    <main className="px-6 sm:px-10 py-12 max-w-4xl mx-auto">
      <header className="mb-12">
        <p className="section-label mb-4">Activate monitoring</p>
        <h1 className="font-serif text-3xl md:text-4xl text-ink tracking-tight leading-[1.1]">
          {gate.status === "active"
            ? `${ecosystem.name} is monitored.`
            : `${ecosystem.name} is set up — monitoring isn’t running yet.`}
        </h1>
        {gate.status === "active" ? (
          <p className="mt-4 text-ink-muted text-[15px] leading-relaxed max-w-2xl">
            Continuous monitoring is active
            {gate.payment ? (
              <> until <span className="text-ink">{gate.payment.end_at.slice(0, 10)}</span></>
            ) : null}
            . Members manage entries and alerts from the{" "}
            <a href={`/manage/${slug}`} className="underline decoration-dotted hover:text-oxblood">
              console
            </a>
            ; if your team needs access, email{" "}
            <a href="mailto:hello@polygraph.so" className="underline decoration-dotted hover:text-oxblood">
              hello@polygraph.so
            </a>
            .
          </p>
        ) : (
          <>
            <p className="mt-4 text-ink-muted text-[15px] leading-relaxed max-w-2xl">
              Continuous monitoring is what keeps an index honest: the same open test, re-run on a
              clock, with alerts when something moves. It&rsquo;s a monthly subscription:{" "}
              <span className="text-ink">${usdMonthly.toLocaleString("en-US")}/month in $POLYGRAPH</span>,
              streamed to the polygraph treasury (
              <span className="font-mono text-[13px]">polygraph.base.eth</span>) for as long as you
              stay. Cancel the stream anytime — the unstreamed remainder returns to the payer and
              monitoring stops. No account needed to pay.
            </p>
            <p className="mt-3 font-mono text-[12px] text-ink-faint">
              Why the token?{" "}
              <a
                href="/blog/weekly-buyback"
                className="text-ink-muted underline decoration-dotted underline-offset-2 hover:text-oxblood transition-colors"
              >
                Monitoring is paid in the token — the revenue note ↗
              </a>
            </p>
          </>
        )}
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
      {gate.status !== "active" ? <ActivateFlow slug={slug} consoleHref={consoleHref} /> : null}
    </main>
  );
}
