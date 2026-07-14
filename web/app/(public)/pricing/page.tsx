import type { Metadata } from "next";
import Link from "next/link";
import {
  DEFAULT_MONTHLY_PRICE_USD,
  PLAN_PRICES_USD,
  PLAN_QUOTAS,
  PRIORITY_GRADE_PRICE_USD,
} from "@/lib/paymentConfig";

// Static, server-rendered, no wallet JS: this page only describes and links
// out to the checkouts (which carry the wallet island). Keep it that way — no
// AppKit/wagmi imports here.
export const metadata: Metadata = {
  title: "Pricing",
  description:
    "The self-check, report pages, badges, and the open harness are free forever. Pay only for coverage, turnaround, and continuous monitoring. Nobody can pay for a grade.",
  alternates: { canonical: "/pricing" },
};

interface Tier {
  name: string;
  price: string;
  cadence?: string;
  blurb: string;
  points: string[];
  cta: { label: string; href: string } | null;
  foot?: string;
}

const TIERS: Tier[] = [
  {
    name: "Free",
    price: "$0",
    blurb: "The trust asset. Never gated.",
    points: [
      "The open litmus harness (self-check any server or skill)",
      "Every published grade, report page, and reproducibility guide",
      "Embeddable grade badges and cards",
      "One version-regrade monitor with email alerts",
      "The CLI and the lookup MCP tools",
    ],
    cta: { label: "Browse the index →", href: "/mcp-index" },
  },
  {
    name: "Priority grading",
    price: `$${PRIORITY_GRADE_PRICE_USD}`,
    cadence: "one-time, per server",
    blurb: "Skip the queue. Graded within 48 hours.",
    points: [
      "A queued request moved onto a 48h SLA",
      "The same battery, thresholds, and publication path as the free queue",
      "Paid in $POLYGRAPH on Base",
    ],
    cta: { label: "Request a grade →", href: "/request" },
    foot: "Buys turnaround, never the grade. Remote-only servers still cap at B.",
  },
  {
    name: "Pro monitors",
    price: `$${PLAN_PRICES_USD.indie} to $${PLAN_PRICES_USD.team}`,
    cadence: "per month",
    blurb: "Watch more than one thing.",
    points: [
      `Indie $${PLAN_PRICES_USD.indie}/mo: ${PLAN_QUOTAS.indie} monitors`,
      `Team $${PLAN_PRICES_USD.team}/mo: ${PLAN_QUOTAS.team} monitors`,
      "Per-target grade thresholds and email alerts",
      "Paid as a cancelable monthly $POLYGRAPH stream",
    ],
    cta: { label: "See plans →", href: "/dashboard/upgrade" },
  },
  {
    name: "Ecosystem monitoring",
    price: `from $${DEFAULT_MONTHLY_PRICE_USD}`,
    cadence: "per month",
    blurb: "A continuous trust index for a whole network.",
    points: [
      "Every MCP server and skill your users touch, re-graded on a cadence",
      "Fingerprint-drift alerts (the rug-pull signal)",
      "A public, branded ecosystem index page",
      "Weekly CVE digest and an escalation channel",
    ],
    cta: { label: "Ecosystems →", href: "/ecosystems" },
  },
  {
    name: "Enterprise",
    price: "Let's talk",
    blurb: "A keyed grade feed for vendor-risk and gateways.",
    points: [
      "Bulk grade lookups and fingerprint history",
      "SLA-backed access and webhooks",
      "Private grading of internal MCP servers",
    ],
    cta: { label: "hello@polygraph.so →", href: "mailto:hello@polygraph.so" },
  },
];

export default function PricingPage() {
  return (
    <div className="mx-auto max-w-4xl">
      <header className="mb-12 max-w-2xl">
        <p className="section-label mb-4">Pricing</p>
        <h1 className="font-serif text-4xl md:text-5xl text-ink tracking-tight leading-[1.05]">
          Pay for coverage, not verdicts.
        </h1>
        <p className="mt-5 font-serif italic text-ink-muted text-lg md:text-xl leading-snug">
          The self-check, the report pages, the badges, and the open harness are free forever.
          What you pay for is scale: watching more, turning it around faster, and keeping a whole
          network graded over time.
        </p>
        <p className="mt-4 text-ink-muted leading-relaxed">
          Money buys speed, coverage, and tooling. It never buys a grade, or a better one. Every
          grade is reproducible by re-running the open harness, so a paid result is falsifiable.{" "}
          <span className="text-ink">Nobody can pay for a grade.</span>
        </p>
      </header>

      <div className="grid gap-px bg-rule border hairline rounded-[4px] overflow-hidden sm:grid-cols-2">
        {TIERS.map((tier) => (
          <div key={tier.name} className="bg-parchment-50 p-6 flex flex-col">
            <div className="flex items-baseline justify-between gap-3 mb-1">
              <h2 className="font-mono text-[11px] uppercase tracking-[0.16em] text-ink-faint">
                {tier.name}
              </h2>
            </div>
            <div className="mb-3">
              <span className="font-serif text-3xl text-ink">{tier.price}</span>
              {tier.cadence ? (
                <span className="ml-2 font-mono text-[11px] text-ink-muted">{tier.cadence}</span>
              ) : null}
            </div>
            <p className="text-[15px] text-ink leading-snug mb-4">{tier.blurb}</p>
            <ul className="space-y-1.5 mb-5 flex-1">
              {tier.points.map((p) => (
                <li key={p} className="text-[13px] text-ink-muted leading-relaxed flex gap-2">
                  <span className="text-ink-faint select-none">·</span>
                  <span>{p}</span>
                </li>
              ))}
            </ul>
            {tier.foot ? (
              <p className="font-mono text-[10.5px] text-ink-faint leading-relaxed mb-4">
                {tier.foot}
              </p>
            ) : null}
            {tier.cta ? (
              <Link
                href={tier.cta.href}
                className="mt-auto inline-flex items-center gap-2 font-mono text-[12px] uppercase tracking-[0.12em] text-ink hover:text-oxblood transition-colors"
              >
                {tier.cta.label}
              </Link>
            ) : null}
          </div>
        ))}
      </div>

      <p className="mt-10 font-mono text-[11px] text-ink-faint leading-relaxed max-w-2xl">
        Self-serve payments settle in $POLYGRAPH on Base. Enterprise engagements are invoiced.
        Prices for the paid MCP-security market sit under the incumbents: vendor-risk platforms
        charge from $79 per vendor per month for shallower, non-reproducible signals.
      </p>
    </div>
  );
}
