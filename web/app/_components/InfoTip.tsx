import type { ReactNode } from "react";

/**
 * CSS-only tooltip (no JS): a dotted-underlined trigger that reveals a dark
 * caption on hover, focus, or tap. `align` picks which edge it anchors to.
 * Pure presentational — safe in both server and client components. Shared by
 * the rankings table and the ecosystem index headers so their help copy lives
 * in one place.
 */
export function InfoTip({
  label,
  children,
  align = "left",
}: {
  label: ReactNode;
  children: ReactNode;
  align?: "left" | "right";
}) {
  return (
    <span className="group/tip relative inline-block">
      <span
        tabIndex={0}
        className="cursor-help border-b border-dotted border-ink-faint/60 outline-none"
      >
        {label}
      </span>
      <span
        role="tooltip"
        className={`pointer-events-none absolute top-full z-20 mt-2 hidden w-60 rounded-sm border border-ink/30 bg-ink px-3 py-2 text-left font-sans text-[11px] font-normal normal-case tracking-normal leading-snug text-parchment shadow-lg group-hover/tip:block group-focus-within/tip:block ${
          align === "right" ? "right-0" : "left-0"
        }`}
      >
        {children}
      </span>
    </span>
  );
}
