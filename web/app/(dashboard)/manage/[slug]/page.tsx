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

  // Monitoring is paid. An unpaid ecosystem's console stays visible but LOCKED
  // for members and ecosystem admins: entries are browseable, everything that
  // mutates or belongs to the paid layer (adding, curation, CVEs, alerts) is
  // disabled behind the activation link. The manage APIs 402 regardless — the
  // UI reflects the gate, the server enforces it. App admins bypass entirely:
  // the operator sets ecosystems up before a client ever pays.
  const gate = await getPaymentGate(ecosystem);
  const unpaid = gate.status !== "active";
  const locked = unpaid && role !== "app-admin";

  const [graded, members, advisories, alertSettings, recipients] = await Promise.all([
    loadGradedEntries(ecosystem.id),
    manage && !locked ? listMembers(ecosystem.id) : Promise.resolve([]),
    locked ? Promise.resolve([]) : loadEcosystemAdvisories(ecosystem.id),
    manage && !locked ? loadAlertSettings(ecosystem.id) : Promise.resolve(DEFAULT_ALERT_SETTINGS),
    manage && !locked ? listAlertRecipients(ecosystem.id) : Promise.resolve([]),
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
        {unpaid && role === "app-admin" ? (
          <p className="mt-3 font-mono text-[12px] text-oxblood">
            monitoring inactive — members see a locked console; set a price or comp it in{" "}
            <a href="/admin/ecosystems" className="underline decoration-dotted">
              admin
            </a>
          </p>
        ) : null}
      </header>

      {/* The locked-console banner: browse, but the paid layer waits on activation. */}
      {locked ? (
        <div className="mb-8 border border-oxblood/40 rounded-[4px] px-5 py-4 flex flex-wrap items-center justify-between gap-x-6 gap-y-3">
          <p className="text-[14px] leading-relaxed text-ink max-w-xl">
            Monitoring isn&rsquo;t active for this ecosystem. Entries are visible below, but
            adding, curation, CVE tracking, and alerts unlock when it&rsquo;s activated.
          </p>
          <a
            href={`/ecosystems/${slug}/activate`}
            className="inline-flex items-center gap-2 rounded-[3px] bg-ink px-5 py-2.5 font-mono text-[13px] tracking-wide text-parchment transition-colors hover:bg-oxblood"
          >
            Activate monitoring →
          </a>
        </div>
      ) : null}

      <ConsoleTabs
        tabs={[
          {
            id: "entries",
            label: "MCPs & Skills",
            panel: <EntriesManager slug={ecosystem.slug} entries={entries} locked={locked} />,
          },
          {
            id: "cves",
            label: "CVEs",
            panel: locked ? (
              <div className="py-6">
                <p className="text-ink-muted text-[14px] leading-relaxed max-w-xl">
                  CVE tracking is part of the paid layer: known vulnerabilities (GHSA/OSV)
                  affecting the packages behind these entries, refreshed daily and delivered as a
                  weekly digest.{" "}
                  <a
                    href={`/ecosystems/${slug}/activate`}
                    className="text-ink underline decoration-dotted hover:text-oxblood"
                  >
                    Activate monitoring
                  </a>{" "}
                  to turn it on.
                </p>
              </div>
            ) : (
              <CvesManager groups={cveGroups} />
            ),
          },
          ...(manage && !locked
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
