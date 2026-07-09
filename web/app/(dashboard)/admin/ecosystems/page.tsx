/**
 * /admin/ecosystems — provision ecosystems (app-admin only; gated by proxy.ts).
 * Lists every ecosystem with a jump into its management console, and a form to
 * create a new one and seed its first admin.
 */

import Link from "next/link";
import { listEcosystems } from "@/lib/ecosystemData";
import { CreateEcosystemForm } from "./_components/CreateEcosystemForm";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "Ecosystems · admin · polygraph",
  robots: { index: false },
};

export default async function AdminEcosystemsPage() {
  const ecosystems = await listEcosystems();

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
            {ecosystems.map((e) => (
              <li key={e.id} className="flex items-center justify-between gap-4 py-3">
                <div className="min-w-0">
                  <div className="text-ink font-medium">{e.name}</div>
                  <div className="font-mono text-[11px] text-ink-faint">
                    /{e.slug}
                    {!e.is_public ? " · private" : ""}
                    {!e.is_listed ? " · unlisted" : ""}
                  </div>
                </div>
                <div className="shrink-0 flex items-center gap-3 font-mono text-[10px] uppercase tracking-[0.14em]">
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
