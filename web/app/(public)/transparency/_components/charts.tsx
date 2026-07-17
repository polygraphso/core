/**
 * Small presentational primitives for the transparency page — no chart library,
 * just flex/CSS. Server components (pure markup, no hooks). Given numbers, draw.
 */

import type { DayBucket } from "@/lib/adminAggregate";
import { formatPct, type DistributionKey, type DistributionSlice } from "@/lib/transparency";

const SLICE_COLOR: Record<DistributionKey, string> = {
  team: "bg-oxblood",
  treasury: "bg-terracotta",
  circulating: "bg-parchment-300",
};

/** A single stacked bar of the supply distribution. */
export function DistributionBar({ slices }: { slices: DistributionSlice[] }) {
  return (
    <div className="flex h-3.5 w-full overflow-hidden rounded-[3px] border hairline bg-parchment">
      {slices.map((s) => (
        <div
          key={s.key}
          className={SLICE_COLOR[s.key]}
          style={{ width: `${Math.max(0, s.pct * 100)}%` }}
          title={`${s.label} · ${formatPct(s.pct)}`}
        />
      ))}
    </div>
  );
}

/** The distribution legend swatch (matches DistributionBar colors). */
export function Swatch({ slice }: { slice: DistributionKey }) {
  return <span className={`inline-block h-2.5 w-2.5 rounded-[2px] ${SLICE_COLOR[slice]}`} />;
}

/** Booked-per-day bars over the window. Dollars live in `count`. */
export function MiniBars({
  data,
  format,
}: {
  data: DayBucket[];
  format: (n: number) => string;
}) {
  const max = Math.max(1, ...data.map((d) => d.count));
  return (
    <div className="flex h-14 items-end gap-[2px]">
      {data.map((d) => (
        <div
          key={d.date}
          className="flex-1 rounded-[1px] bg-oxblood-soft"
          style={{ height: `${Math.max(2, (d.count / max) * 100)}%` }}
          title={`${d.date} · ${format(d.count)}`}
        />
      ))}
    </div>
  );
}

/** A 0..1 progress fill (vesting unlock). */
export function ProgressBar({ pct }: { pct: number }) {
  const w = Math.min(100, Math.max(0, pct * 100));
  return (
    <div className="h-2 w-full overflow-hidden rounded-full bg-parchment-300">
      <div className="h-full rounded-full bg-oxblood" style={{ width: `${w}%` }} />
    </div>
  );
}
