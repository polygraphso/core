import { monitoredSlugSet } from "@/lib/monitoredEcosystems";

/**
 * The "this network is a client" mark for an ecosystem's public page: shown
 * only while the payment gate is active, read live — so the badge can't outlive
 * the engagement. Disclosure-based independence makes wearing it the point.
 */
export async function MonitoredBadge({ slug, className }: { slug: string; className?: string }) {
  const monitored = await monitoredSlugSet();
  if (!monitored.has(slug)) return null;
  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full border border-oxblood/40 px-2.5 py-1 font-mono text-[10px] uppercase tracking-[0.14em] text-oxblood ${className ?? ""}`}
    >
      <span aria-hidden className="inline-block h-1.5 w-1.5 rounded-full bg-oxblood" />
      continuously monitored
    </span>
  );
}
