/**
 * /admin/ecosystems — provision ecosystems (app-admin only; gated by proxy.ts).
 * Lists every ecosystem with a jump into its management console, and a form to
 * create a new one and seed its first admin.
 */

import Link from "next/link";
import { listEcosystems } from "@/lib/ecosystemData";
import { getPaymentGate } from "@/lib/ecosystemPayments";
import { CreateEcosystemForm } from "./_components/CreateEcosystemForm";
import { PriceForm } from "./_components/PriceForm";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "Ecosystems · admin · polygraph",
  robots: { index: false },
};

export default async function AdminEcosystemsPage() {
  const ecosystems = await listEcosystems();
  const rows = await Promise.all(
    ecosystems.map(async (e) => ({ ecosystem: e, gate: await getPaymentGate(e) })),
  );

  return (
    <main className="px-6 sm:px-10 py-12 max-w-3xl">
      <header className="mb-8">
        <p className="section-label mb-3">Admin · ecosystems</p>
        <h1 className="font-serif text-3xl md:text-4xl text-ink tracking-tight">Ecosystems</h1>
        <p className="mt-3 text-ink-muted text-[15px] leading-relaxed max-w-xl">
          Provision an ecosystem for a partner and seed its first admin. They then invite their own
          members and curate their public page.
        </p>
      </header>

      <section className="mb-12">
        <p className="section-label mb-4">New ecosystem</p>
        <CreateEcosystemForm />
      </section>

      <section>
        <p className="section-label mb-4">All ecosystems · {ecosystems.length}</p>
        {ecosystems.length === 0 ? (
          <p className="text-ink-muted text-[14px]">None yet.</p>
        ) : (
          <ul className="divide-y divide-rule border-y border-rule">
            {rows.map(({ ecosystem: e, gate }) => (
              <li key={e.id} className="flex flex-wrap items-center justify-between gap-x-4 gap-y-2 py-3">
                <div className="min-w-0">
                  <div className="text-ink font-medium">{e.name}</div>
                  <div className="font-mono text-[11px] text-ink-faint">
                    /{e.slug}
                    {!e.is_public ? " · private" : ""}
                    {!e.is_listed ? " · unlisted" : ""}
                  </div>
                </div>
                <div className="shrink-0 flex flex-wrap items-center gap-3 font-mono text-[10px] uppercase tracking-[0.14em]">
                  <PriceForm ecosystemId={e.id} initial={e.monthly_price_usd} />
                  {gate.exempt ? (
                    <span className="text-ink-faint border border-rule rounded-full px-2.5 py-1">comped</span>
                  ) : gate.status === "active" ? (
                    <span
                      className="text-ink-muted border border-rule rounded-full px-2.5 py-1"
                      title={gate.payment ? `stream until ${gate.payment.end_at.slice(0, 10)}` : undefined}
                    >
                      active{gate.payment ? ` · ${gate.payment.end_at.slice(0, 10)}` : ""}
                    </span>
                  ) : (
                    <span className="text-oxblood border border-oxblood/40 rounded-full px-2.5 py-1">unpaid</span>
                  )}
                  <Link href={`/manage/${e.slug}`} className="text-ink-muted hover:text-oxblood transition-colors">
                    manage
                  </Link>
                  <a href={`/ecosystems/${e.slug}`} className="text-ink-faint hover:text-oxblood transition-colors">
                    public ↗
                  </a>
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>
    </main>
  );
}
