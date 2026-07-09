/**
 * /manage/[slug] — the management console for one ecosystem.
 *
 * Members add/curate entries; admins additionally manage members and settings.
 * Everything is gated by getEcosystemRole (app-admin > admin > member); a caller
 * with no access is bounced to /manage. Entries are joined to their live grades and
 * turned into view models (with remediation fixes) server-side, then handed to the
 * client components for interaction.
 */

import { redirect } from "next/navigation";
import { getSession } from "@/lib/session";
import { getEcosystemRole, canManageEcosystem } from "@/lib/ecosystemAccess";
import { loadGradedEntries, listMembers } from "@/lib/ecosystemData";
import { buildEntryVMs } from "@/lib/ecosystemViewModel";
import { ConsoleTabs, type ConsoleTab } from "./_components/ConsoleTabs";
import { EntriesManager } from "./_components/EntriesManager";
import { MembersManager } from "./_components/MembersManager";
import { SettingsForm } from "./_components/SettingsForm";

export const dynamic = "force-dynamic";

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  return { title: `Manage ${slug} · polygraph`, robots: { index: false } };
}

export default async function ManageConsolePage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const session = await getSession();
  if (!session) redirect(`/login?next=/manage/${slug}`);

  const access = await getEcosystemRole(session, slug);
  if (!access) redirect("/manage");
  const { ecosystem, role } = access;
  const manage = canManageEcosystem(role);

  const [graded, members] = await Promise.all([
    loadGradedEntries(ecosystem.id),
    manage ? listMembers(ecosystem.id) : Promise.resolve([]),
  ]);
  const entries = buildEntryVMs(graded);

  return (
    <main className="px-6 sm:px-10 py-12 max-w-4xl">
      <header className="mb-8">
        <a href="/manage" className="section-label mb-3 inline-block hover:text-oxblood transition-colors">
          ← Ecosystems
        </a>
        <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-2">
          <h1 className="font-serif text-3xl md:text-4xl text-ink tracking-tight">{ecosystem.name}</h1>
          <div className="flex items-center gap-3 font-mono text-[11px] text-ink-faint">
            <a
              href={`/ecosystems/${ecosystem.slug}`}
              className="uppercase tracking-[0.14em] hover:text-oxblood transition-colors"
            >
              Public page ↗
            </a>
            <span className="border border-rule rounded-full px-2.5 py-1 uppercase tracking-[0.14em] text-ink-muted">
              {role === "app-admin" ? "app admin" : role}
            </span>
          </div>
        </div>
        {ecosystem.blurb ? (
          <p className="mt-3 text-ink-muted text-[15px] leading-relaxed max-w-2xl">{ecosystem.blurb}</p>
        ) : null}
      </header>

      <ConsoleTabs
        tabs={[
          {
            id: "entries",
            label: "MCPs & Skills",
            panel: <EntriesManager slug={ecosystem.slug} entries={entries} />,
          },
          ...(manage
            ? ([
                {
                  id: "members",
                  label: "Members",
                  panel: <MembersManager slug={ecosystem.slug} members={members} />,
                },
                {
                  id: "settings",
                  label: "Settings",
                  panel: <SettingsForm slug={ecosystem.slug} ecosystem={ecosystem} />,
                },
              ] as ConsoleTab[])
            : []),
        ]}
      />
    </main>
  );
}
