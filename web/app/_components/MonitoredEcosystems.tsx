import Link from "next/link";
import { listEcosystems } from "@/lib/ecosystemData";
import { getPaymentGate } from "@/lib/ecosystemPayments";
import { isLegacyEcosystemSlug } from "@/lib/ecosystemTypes";

/**
 * The monitored-clients strip: every public ecosystem whose monitoring is
 * active (a live POLYGRAPH stream, or comped), each linking to its public
 * index. Client engagements are disclosure-based, so naming them is the
 * point — this is the register of who pays for continuous re-grading, read
 * from the same payment gate the console enforces. Renders nothing while
 * there are no active clients (no empty section on a young page).
 */
export async function MonitoredEcosystems() {
  const all = await listEcosystems();
  const candidates = all.filter((e) => e.is_public && e.is_listed);
  const gates = await Promise.all(candidates.map((e) => getPaymentGate(e)));
  const monitored = candidates.filter((_, i) => gates[i]!.status === "active");
  if (monitored.length === 0) return null;

  return (
    <section aria-label="Monitored ecosystems" className="mx-auto max-w-6xl px-6">
      <div className="border-y hairline py-5 flex flex-wrap items-baseline gap-x-6 gap-y-3">
        <p className="font-mono text-[11px] uppercase tracking-[0.18em] text-ink-faint">
          Monitored ecosystems
        </p>
        <ul className="flex flex-wrap items-baseline gap-x-5 gap-y-2">
          {monitored.map((e) => (
            <li key={e.id}>
              <Link
                href={isLegacyEcosystemSlug(e.slug) ? `/${e.slug}` : `/ecosystems/${e.slug}`}
                className="font-serif text-lg text-ink border-b hairline border-dotted pb-0.5 hover:text-oxblood transition-colors"
              >
                {e.name}
              </Link>
            </li>
          ))}
        </ul>
        <p className="font-mono text-[11px] text-ink-faint ml-auto">
          continuously re-graded ·{" "}
          <Link href="/ecosystems" className="underline decoration-dotted hover:text-oxblood">
            become one
          </Link>
        </p>
      </div>
    </section>
  );
}
