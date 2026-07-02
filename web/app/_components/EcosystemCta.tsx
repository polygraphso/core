import Link from "next/link";

/**
 * The "get monitored" CTA card — the conversion unit shared by the ecosystem
 * sales surfaces (/ecosystems, /base, /bankr). Ecosystem monitoring is sales-led,
 * so every deck closes on the same honest ask: an email to start, and a booking
 * link when one is set. Parameterized per surface; the caller wraps it in its own
 * SectionHeader so section numbering stays page-local.
 *
 * Honesty note: continuous monitoring is the OFFERING, wired up per network when
 * an ecosystem signs on — this copy describes the engagement, never claims
 * automation already running for everyone. See core/CLAUDE.md.
 */

// A booking link (Cal.com / Calendly) renders beside the mailto when set. Left
// null until a scheduling URL exists — flip this one constant to turn it on
// across every ecosystem surface. The mailto is always the primary path.
const BOOKING_URL: string | null = null;

export function EcosystemCta({
  heading,
  body,
  mailtoSubject,
  secondaryHref,
  secondaryLabel,
}: {
  heading: string;
  body: string;
  mailtoSubject: string;
  secondaryHref?: string;
  secondaryLabel?: string;
}) {
  const mailto = `mailto:hello@polygraph.so?subject=${encodeURIComponent(mailtoSubject)}`;
  return (
    <div className="border hairline bg-parchment-50 p-6 md:p-8">
      <h2 className="font-serif text-2xl md:text-3xl text-ink tracking-tight">{heading}</h2>
      <p className="mt-3 max-w-2xl text-ink-muted leading-relaxed">{body}</p>
      <div className="mt-6 flex flex-wrap items-center gap-x-6 gap-y-4">
        <a
          href={mailto}
          className="inline-flex items-center gap-2 bg-ink text-parchment px-5 py-3 font-mono text-sm tracking-wide hover:bg-oxblood transition-colors"
        >
          Start monitoring <span aria-hidden>→</span>
        </a>
        {BOOKING_URL ? (
          <a
            href={BOOKING_URL}
            target="_blank"
            rel="noreferrer noopener"
            className="inline-flex items-center gap-1.5 pb-0.5 font-mono text-[12px] uppercase tracking-[0.16em] text-ink-muted border-b hairline border-dotted hover:text-oxblood transition-colors"
          >
            Book a call <span aria-hidden>↗</span>
          </a>
        ) : null}
        {secondaryHref && secondaryLabel ? (
          <Link
            href={secondaryHref}
            className="inline-flex items-center gap-1.5 pb-0.5 font-mono text-[12px] uppercase tracking-[0.16em] text-ink-muted border-b hairline border-dotted hover:text-oxblood transition-colors"
          >
            {secondaryLabel} <span aria-hidden>→</span>
          </Link>
        ) : null}
      </div>
    </div>
  );
}
