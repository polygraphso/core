import Link from "next/link";

/**
 * The "get monitored" CTA card — the conversion unit shared by the ecosystem
 * sales surfaces (/ecosystems, /base, /bankr). Ecosystem monitoring is sales-led,
 * so every deck closes on the same honest ask: an email to start, and a booking
 * link when one is set. Parameterized per surface; the caller wraps it in its own
 * SectionHeader so section numbering stays page-local.
 *
 * This is the page's conversion moment, so it is deliberately the heaviest block
 * on the surface: an inverted ink panel that stands apart from the parchment
 * argument cards above it. The mailto is the primary path; the address is also
 * shown in plain text as a copy-able fallback for anyone without a mail client.
 *
 * Honesty note: continuous monitoring is the OFFERING, wired up per network when
 * an ecosystem signs on — this copy describes the engagement, never claims
 * automation already running for everyone. See core/CLAUDE.md.
 */

// A booking link (Cal.com / Calendly) renders beside the mailto when set. Set
// the BOOKING_URL env var in the deployment environment to turn it on across
// every ecosystem surface — no code change needed. The mailto is always the
// primary path.
const BOOKING_URL: string | null = process.env.BOOKING_URL ?? null;

const CONTACT_EMAIL = "hello@polygraph.so";

// Quiet links sitting on the dark panel: parchment, warming to terracotta on hover.
const ON_INK_LINK =
  "inline-flex items-center gap-1.5 pb-0.5 font-mono text-[12px] uppercase tracking-[0.16em] text-parchment-300 border-b border-dotted border-[color:var(--color-ink-faint)] transition-colors hover:text-terracotta hover:border-terracotta";

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
  const mailto = `mailto:${CONTACT_EMAIL}?subject=${encodeURIComponent(mailtoSubject)}`;
  return (
    <div className="relative overflow-hidden rounded-[6px] bg-ink p-7 md:p-10">
      {/* Oxblood hairline along the top edge — a colored rule, preprint-style. */}
      <span
        aria-hidden
        className="absolute inset-x-0 top-0 h-px"
        style={{
          background:
            "linear-gradient(90deg, transparent, var(--color-oxblood-soft) 42%, var(--color-terracotta) 58%, transparent)",
        }}
      />
      <h2 className="font-serif text-2xl md:text-3xl text-parchment tracking-tight leading-[1.1]">
        {heading}
      </h2>
      <p className="mt-3 max-w-2xl text-parchment-300 leading-relaxed">{body}</p>

      <div className="mt-7 flex flex-wrap items-center gap-x-6 gap-y-4">
        <a
          href={mailto}
          className="inline-flex items-center gap-2 rounded-[3px] bg-parchment px-6 py-3.5 font-mono text-sm tracking-wide text-ink transition-colors hover:bg-oxblood hover:text-parchment"
        >
          Start monitoring <span aria-hidden>→</span>
        </a>
        {BOOKING_URL ? (
          <a href={BOOKING_URL} target="_blank" rel="noreferrer noopener" className={ON_INK_LINK}>
            Book a call <span aria-hidden>↗</span>
          </a>
        ) : null}
        {secondaryHref && secondaryLabel ? (
          <Link href={secondaryHref} className={ON_INK_LINK}>
            {secondaryLabel} <span aria-hidden>→</span>
          </Link>
        ) : null}
      </div>

      <p className="mt-6 font-mono text-[12px] text-parchment-300">
        Prefer to write us directly?{" "}
        <a
          href={mailto}
          className="text-parchment underline decoration-dotted underline-offset-2 transition-colors hover:text-terracotta"
        >
          {CONTACT_EMAIL}
        </a>
      </p>
    </div>
  );
}
