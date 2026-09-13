import Link from "next/link";

/**
 * "How to fix" CTA shown on a non-A skill or server report. Links to the
 * remediation page for the target. `target` is the canonical key — a skill ref
 * (`github/owner/repo#sub`) or a server key (`npm/...`, `https://...`); it's
 * passed through `?for=` so the remediation page knows what's being fixed.
 * `kind` tells /fix which grade store to read (the report already knows its
 * context), sparing it a ref-shape guess. encodeURIComponent keeps a skill
 * ref's `#` intact as a query value.
 */
export function FixCta({ target, kind }: { target: string; kind: "mcp" | "skill" }) {
  return (
    <div className="mt-10 border-t hairline pt-6">
      <Link
        href={`/fix?for=${encodeURIComponent(target)}&kind=${kind}`}
        className="inline-flex items-center gap-2 bg-ink text-parchment px-5 py-3 font-mono text-sm tracking-wide hover:bg-oxblood transition-colors"
      >
        How to fix this →
      </Link>
      <p className="mt-3 font-sans text-[13px] text-ink-faint leading-relaxed max-w-xl">
        Guided remediation — the specific changes that clear this grade.
        {kind === "mcp" ? (
          <>
            {" "}
            Shipped a fix? Re-run the open harness locally —{" "}
            <Link
              href="/builders#install"
              className="text-ink-muted border-b hairline border-dotted hover:text-ink transition-colors"
            >
              builders
            </Link>
            .
          </>
        ) : null}
      </p>
    </div>
  );
}
