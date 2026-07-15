/**
 * The watch-summary strip at the top of /dashboard: the fleet's health as a
 * single spectrum bar, segmented in the grade colors and sized by how many
 * monitors sit at each grade, with the one signal monitoring exists to surface —
 * how many are at or below their own alert threshold — called out beneath it.
 *
 * Pure props (no server-only imports) so it renders inside the server page. All
 * counts are derived by the page from data it already loads; nothing is fetched
 * here.
 */

import { GRADE_HEX } from "@/lib/gradeColors";
import type { LitmusGrade } from "@/lib/hostedGrades";

interface Props {
  /** Active (non-paused) monitors summarised here. */
  watched: number;
  /** Grades present, in A→F order, each with its count. Zero-count grades omitted. */
  counts: { g: LitmusGrade; n: number }[];
  /** Active monitors with no grade yet. */
  ungraded: number;
  /** Active monitors whose current grade is at or below their alert threshold. */
  belowThreshold: number;
}

const UNGRADED_HEX = "var(--color-ink-faint)";

export function WatchSummary({ watched, counts, ungraded, belowThreshold }: Props) {
  const total = counts.reduce((s, c) => s + c.n, 0) + ungraded;

  const segments = [
    ...counts.map((c) => ({ key: c.g, label: c.g, n: c.n, color: GRADE_HEX[c.g] })),
    ...(ungraded > 0
      ? [{ key: "ungraded", label: "—", n: ungraded, color: UNGRADED_HEX }]
      : []),
  ];

  // A segment only carries its own text when it's wide enough not to clip; the
  // legend below is the reliable read for thin ones.
  const wideEnough = (n: number) => total > 0 && n / total >= 0.12;

  const distribution =
    segments.map((s) => `${s.n} ${s.key === "ungraded" ? "ungraded" : s.label}`).join(", ") ||
    "no monitors";

  return (
    <div className="mb-8">
      <div className="mb-2 flex items-baseline justify-between gap-4">
        <p className="font-mono text-[10px] uppercase tracking-[0.18em] text-ink-faint">
          Watch summary
        </p>
        <span className="font-mono text-[10px] uppercase tracking-[0.12em] text-ink-faint tabular">
          {watched} watched
        </span>
      </div>

      <div
        className="flex h-9 w-full overflow-hidden rounded-[3px] border border-rule"
        role="img"
        aria-label={`Grade distribution across ${watched} monitors: ${distribution}`}
      >
        {segments.map((s) => (
          <div
            key={s.key}
            className="flex items-center justify-center overflow-hidden"
            style={{ flexGrow: s.n, flexBasis: 0, backgroundColor: s.color }}
          >
            {wideEnough(s.n) ? (
              <span className="whitespace-nowrap font-mono text-[11px] text-parchment-50">
                {s.label} {s.n}
              </span>
            ) : null}
          </div>
        ))}
      </div>

      <div className="mt-2 flex items-center justify-between gap-4">
        <div className="flex flex-wrap items-center gap-x-3 gap-y-1 font-mono text-[10px] text-ink-faint tabular">
          {segments.map((s) => (
            <span key={s.key} className="inline-flex items-center gap-1.5">
              <span
                aria-hidden
                className="inline-block h-2 w-2 rounded-[1px]"
                style={{ backgroundColor: s.color }}
              />
              {s.key === "ungraded" ? "ungraded" : s.label} {s.n}
            </span>
          ))}
        </div>
        <span
          className={`shrink-0 font-mono text-[11px] ${
            belowThreshold > 0 ? "text-oxblood" : "text-ink-faint"
          }`}
        >
          {belowThreshold > 0
            ? `▲ ${belowThreshold} monitor${belowThreshold === 1 ? "" : "s"} below threshold`
            : "none below threshold"}
        </span>
      </div>
    </div>
  );
}
