import Link from "next/link";

/**
 * "How to fix" CTA shown on a non-A skill or server report. Links to the
 * (coming-soon, later paywalled) remediation page for the target. `target` is
 * the canonical key — a skill ref (`github/owner/repo#sub`) or a server key
 * (`npm/...`, `https://...`); it's passed through `?for=` so the remediation
 * page knows what's being fixed. encodeURIComponent keeps a skill ref's `#`
 * intact as a query value.
 */
export function FixCta({ target }: { target: string }) {
  return (
    <div className="mt-10 border-t hairline pt-6">
      <Link
        href={`/fix?for=${encodeURIComponent(target)}`}
        className="inline-flex items-center gap-2 bg-ink text-parchment px-5 py-3 font-mono text-sm tracking-wide hover:bg-oxblood transition-colors"
      >
        How to fix this →
      </Link>
      <p className="mt-3 font-sans text-[13px] text-ink-faint leading-relaxed max-w-xl">
        Guided remediation — the specific changes that clear this grade.
      </p>
    </div>
  );
}
