type Props = {
  className?: string;
  ariaLabel?: string;
};

// A polygraph oscillograph trace, drawn with a single SVG path.
// Composed of three regions: calm baseline → spike cluster → calm baseline.
// Animates a draw-on via the .trace-line class in globals.css.
export function PolygraphTrace({
  className,
  ariaLabel = "Polygraph trace",
}: Props) {
  // path: 1200 wide, 120 tall, centered on y=60
  const d =
    "M0,60 L80,60 L120,58 L160,62 L200,60 " +
    "L240,60 L260,38 L275,82 L290,30 L305,90 L320,28 L335,86 L350,52 L365,68 L380,46 L395,74 L410,60 " +
    "L450,60 L490,60 L520,58 L560,62 " +
    "L600,60 L620,42 L640,78 L660,30 L680,90 L700,34 L720,84 L740,40 L760,76 L780,46 L800,72 L820,60 " +
    "L860,60 L900,60 L940,58 L980,62 " +
    "L1020,60 L1060,52 L1100,68 L1140,58 L1180,62 L1200,60";

  return (
    <svg
      className={className}
      viewBox="0 0 1200 120"
      preserveAspectRatio="none"
      role="img"
      aria-label={ariaLabel}
    >
      {/* faint baseline grid — like graph paper */}
      <line
        x1="0"
        y1="60"
        x2="1200"
        y2="60"
        stroke="var(--color-rule)"
        strokeWidth="0.5"
        strokeDasharray="2 4"
      />
      <path
        className="trace-line"
        d={d}
        fill="none"
        stroke="var(--color-oxblood)"
        strokeWidth="1.4"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}
