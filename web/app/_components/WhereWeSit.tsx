import { SectionHeader } from "./SectionHeader";

const rows = [
  {
    q: "Is this artifact well-made?",
    src: "Public registries · OpenSSF · GitHub",
    status: "existing",
    statusKind: "neutral" as const,
  },
  {
    q: "Does it behave well under pressure?",
    src: "Our sandbox",
    status: "litmus-v14 — live",
    statusKind: "primary" as const,
  },
  {
    q: "Does it stay behaving well in production?",
    src: "Runtime telemetry",
    status: "next",
    statusKind: "muted" as const,
  },
];

export function WhereWeSit() {
  return (
    <section className="mx-auto max-w-6xl px-6 py-20 md:py-28">
      <SectionHeader
        number="§ 04"
        label="Where we sit"
        title="Three orthogonal axes. Never averaged."
      >
        &ldquo;Popular but dangerous&rdquo; is a specific, valuable signal. We
        keep the axes apart so the signal stays sharp.
      </SectionHeader>

      <figure className="border hairline bg-parchment-50">
        <figcaption className="flex items-center justify-between px-4 py-2.5 border-b hairline font-mono text-[10.5px] uppercase tracking-[0.18em] text-ink-faint">
          <span>Table 1 — Trust framework, by question</span>
          <span className="hidden sm:inline">3 axes</span>
        </figcaption>
        <table className="w-full text-left">
          <thead>
            <tr className="border-b hairline text-[10.5px] uppercase tracking-[0.18em] font-mono text-ink-faint">
              <th className="px-4 py-3 font-normal w-12 tabular">#</th>
              <th className="px-4 py-3 font-normal">Question</th>
              <th className="px-4 py-3 font-normal hidden md:table-cell">Source</th>
              <th className="px-4 py-3 font-normal text-right">Status</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r, i) => (
              <tr
                key={r.q}
                className={
                  i < rows.length - 1
                    ? "border-b hairline align-top"
                    : "align-top"
                }
              >
                <td className="px-4 py-5 font-mono text-xs text-ink-faint tabular">
                  0{i + 1}
                </td>
                <td className="px-4 py-5">
                  <p className="font-serif text-lg md:text-xl text-ink leading-snug">
                    {r.q}
                  </p>
                  <p className="md:hidden mt-1 font-mono text-[11px] text-ink-faint uppercase tracking-[0.12em]">
                    {r.src}
                  </p>
                </td>
                <td className="px-4 py-5 hidden md:table-cell font-mono text-[12px] text-ink-muted">
                  {r.src}
                </td>
                <td className="px-4 py-5 text-right">
                  <StatusPill kind={r.statusKind}>{r.status}</StatusPill>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </figure>

      <p className="mt-4 font-mono text-[10.5px] text-ink-faint uppercase tracking-[0.18em]">
        We run axis 02 — the polygraph. We point at axes 01 and 03 — never average them in.
      </p>
    </section>
  );
}

function StatusPill({
  kind,
  children,
}: {
  kind: "neutral" | "primary" | "muted";
  children: React.ReactNode;
}) {
  const cls =
    kind === "primary"
      ? "border-ink text-ink"
      : kind === "muted"
        ? "border-rule text-ink-faint"
        : "border-rule text-ink-muted";
  return (
    <span
      className={`inline-flex items-center gap-1.5 border ${cls} px-2 py-1 font-mono text-[10.5px] uppercase tracking-[0.16em]`}
    >
      {kind === "primary" && (
        <span
          aria-hidden
          className="inline-block w-1.5 h-1.5 bg-oxblood pulse-soft"
        />
      )}
      {children}
    </span>
  );
}
