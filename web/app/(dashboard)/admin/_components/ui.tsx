import type { ReactNode } from "react";
import type { DayBucket, Bucket } from "@/lib/adminAggregate";

export function Panel({
  label,
  title,
  note,
  children,
}: {
  label: string;
  title: string;
  note?: string;
  children: ReactNode;
}) {
  return (
    <section className="border border-rule rounded-sm bg-parchment-50 p-5">
      <p className="section-label mb-1">{label}</p>
      <h2 className="font-serif text-lg text-ink mb-1">{title}</h2>
      {note && <p className="text-xs text-ink-faint mb-4">{note}</p>}
      <div className={note ? "" : "mt-4"}>{children}</div>
    </section>
  );
}

export function KpiCard({
  label,
  value,
  sub,
  format = (n) => n.toLocaleString(),
}: {
  label: string;
  value: number;
  sub?: string;
  /** Format the headline value (e.g. formatUsd for revenue). Defaults to locale integer. */
  format?: (n: number) => string;
}) {
  return (
    <div className="border border-rule rounded-sm bg-parchment-50 p-4">
      <p className="section-label mb-2">{label}</p>
      <p className="font-serif text-3xl text-ink tabular">{format(value)}</p>
      {sub && <p className="text-xs text-ink-muted mt-1 tabular">{sub}</p>}
    </div>
  );
}

/** Inline SVG bar chart for a day-bucketed series. */
export function MiniBars({
  data,
  format = (n) => String(n),
}: {
  data: DayBucket[];
  /** Format the per-bar tooltip value. Defaults to the raw number. */
  format?: (n: number) => string;
}) {
  const max = Math.max(1, ...data.map((d) => d.count));
  const W = 520;
  const H = 96;
  const gap = 2;
  const bw = (W - gap * (data.length - 1)) / data.length;
  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="w-full h-24" role="img" aria-label="Daily counts">
      {data.map((d, i) => {
        const h = (d.count / max) * (H - 16);
        return (
          <rect
            key={d.date}
            x={i * (bw + gap)}
            y={H - h}
            width={bw}
            height={h}
            fill="var(--color-oxblood)"
            opacity={d.count === 0 ? 0.12 : 0.85}
          >
            <title>{`${d.date}: ${format(d.count)}`}</title>
          </rect>
        );
      })}
    </svg>
  );
}

/** Horizontal ranked bars for leaderboards / breakdowns. */
export function BarList({
  data,
  empty = "No data yet.",
  format = (n) => String(n),
}: {
  data: Bucket[];
  empty?: string;
  /** Format the right-aligned value (e.g. formatUsd for revenue). Defaults to the raw number. */
  format?: (n: number) => string;
}) {
  if (data.length === 0) return <p className="text-sm text-ink-faint">{empty}</p>;
  const max = Math.max(1, ...data.map((d) => d.count));
  return (
    <ul className="space-y-1.5">
      {data.map((d) => (
        <li key={d.key} className="flex items-center gap-3">
          <span className="w-44 truncate font-mono text-xs text-ink" title={d.key}>
            {d.key}
          </span>
          <span className="flex-1 h-3 bg-parchment-200 rounded-sm overflow-hidden">
            <span
              className="block h-full bg-oxblood"
              style={{ width: `${(d.count / max) * 100}%` }}
            />
          </span>
          <span className="min-w-8 shrink-0 text-right font-mono text-xs text-ink-muted tabular">
            {format(d.count)}
          </span>
        </li>
      ))}
    </ul>
  );
}

export function EmptyNote({ children }: { children: ReactNode }) {
  return <p className="text-sm text-ink-faint">{children}</p>;
}

/** Compact list of recent rows: primary (mono) + optional secondary, with right-aligned meta. */
export function RecentList({
  rows,
  empty = "Nothing yet.",
}: {
  rows: { primary: string; secondary?: string | null; meta: string; href?: string }[];
  empty?: string;
}) {
  if (rows.length === 0) return <EmptyNote>{empty}</EmptyNote>;
  return (
    <ul className="divide-y divide-rule border-y border-rule">
      {rows.map((r, i) => (
        <li key={i} className="flex items-baseline gap-3 py-1.5">
          {r.href ? (
            <a
              href={r.href}
              className="min-w-0 flex-1 truncate font-mono text-xs text-ink hover:text-oxblood transition-colors"
              title={r.primary}
            >
              {r.primary}
            </a>
          ) : (
            <span className="min-w-0 flex-1 truncate font-mono text-xs text-ink" title={r.primary}>
              {r.primary}
            </span>
          )}
          {r.secondary && <span className="shrink-0 text-xs text-ink-faint">{r.secondary}</span>}
          <span className="shrink-0 font-mono text-xs text-ink-muted tabular">{r.meta}</span>
        </li>
      ))}
    </ul>
  );
}
