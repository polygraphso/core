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
import { getPaymentGate } from "@/lib/ecosystemPayments";
import { loadGradedEntries, listMembers } from "@/lib/ecosystemData";
import { buildEntryVMs } from "@/lib/ecosystemViewModel";
import { loadEcosystemAdvisories } from "@/lib/cveData";
import { buildCveGroups } from "@/lib/cveViewModel";
import { loadAlertSettings, listAlertRecipients } from "@/lib/ecosystemAlerts";
import { DEFAULT_ALERT_SETTINGS } from "@/lib/ecosystemAlertTypes";
import { ConsoleTabs, type ConsoleTab } from "./_components/ConsoleTabs";
import { EntriesManager } from "./_components/EntriesManager";
import { CvesManager } from "./_components/CvesManager";
import { AlertSettingsForm } from "./_components/AlertSettingsForm";
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

  // Monitoring is paid: without a live POLYGRAPH stream (or a comp), the whole
  // console defers to the (public) activation page. App admins bypass the gate —
  // the operator sets ecosystems up before a client ever pays.
  const gate = await getPaymentGate(ecosystem);
  const unpaid = gate.status !== "active";
  if (unpaid && role !== "app-admin") redirect(`/ecosystems/${slug}/activate`);

  const [graded, members, advisories, alertSettings, recipients] = await Promise.all([
    loadGradedEntries(ecosystem.id),
    manage ? listMembers(ecosystem.id) : Promise.resolve([]),
    loadEcosystemAdvisories(ecosystem.id),
    manage ? loadAlertSettings(ecosystem.id) : Promise.resolve(DEFAULT_ALERT_SETTINGS),
    manage ? listAlertRecipients(ecosystem.id) : Promise.resolve([]),
  ]);
  const entries = buildEntryVMs(graded);
  const cveGroups = buildCveGroups(advisories);

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
              target="_blank"
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
        {unpaid ? (
          <p className="mt-3 font-mono text-[12px] text-oxblood">
            monitoring inactive — members are redirected to the{" "}
            <a
              href={`/ecosystems/${slug}/activate`}
              target="_blank"
              className="underline decoration-dotted"
            >
              activation page
            </a>
            ; set a price or comp it in{" "}
            <a href="/admin/ecosystems" className="underline decoration-dotted">
              admin
            </a>
          </p>
        ) : null}
      </header>

      <ConsoleTabs
        tabs={[
          {
            id: "entries",
            label: "MCPs & Skills",
            panel: <EntriesManager slug={ecosystem.slug} entries={entries} />,
          },
          {
            id: "cves",
            label: "CVEs",
            panel: <CvesManager groups={cveGroups} />,
          },
          ...(manage
            ? ([
                {
                  id: "alerts",
                  label: "Alerts",
                  panel: (
                    <AlertSettingsForm
                      slug={ecosystem.slug}
                      settings={alertSettings}
                      recipients={recipients}
                    />
                  ),
                },
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
