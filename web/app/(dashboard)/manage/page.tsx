/**
 * /manage — the ecosystems this signed-in user can manage. App admins see every
 * ecosystem; everyone else sees the ones they've been invited to (after any pending
 * email invites are claimed). Proxy guarantees a session before this route.
 *
 * Laid out as a full-width register: an overview strip, a columned table
 * (status · role · targets · members) and a legend rail — the "2a" ledger design.
 */

import type { ReactNode } from "react";
import Link from "next/link";
import { redirect } from "next/navigation";
import { getSession } from "@/lib/session";
import { listEcosystemsForUser } from "@/lib/ecosystemAccess";
import { countEntriesByEcosystem, countMembersByEcosystem } from "@/lib/ecosystemData";
import { getPaymentGate } from "@/lib/ecosystemPayments";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "Manage ecosystems · polygraph",
  robots: { index: false },
};

const ROLE_LABEL: Record<string, string> = {
  "app-admin": "app admin",
  admin: "admin",
  member: "member",
};

// Column template shared by the register header and its rows.
const REGISTER_COLS =
  "lg:grid lg:grid-cols-[minmax(140px,1fr)_160px_84px_56px_56px_76px] lg:gap-x-3 lg:items-center";

const MICRO_LABEL = "font-mono text-[10px] uppercase tracking-[0.18em] text-ink-faint";

export default async function ManageLandingPage() {
  const session = await getSession();
  if (!session) redirect("/login?next=/manage");

  const managed = await listEcosystemsForUser(session);
  const ids = managed.map((m) => m.ecosystem.id);
  const [gates, entryCounts, memberCounts] = await Promise.all([
    Promise.all(managed.map((m) => getPaymentGate(m.ecosystem))),
    countEntriesByEcosystem(ids),
    countMembersByEcosystem(ids),
  ]);

  const rows = managed.map((m, i) => ({
    ecosystem: m.ecosystem,
    role: m.role,
    paid: gates[i].status === "active",
    targets: entryCounts[m.ecosystem.id] ?? 0,
    members: memberCounts[m.ecosystem.id] ?? 0,
  }));

  const total = rows.length;
  const awaiting = rows.filter((r) => !r.paid).length;
  const live = total - awaiting;
  const totalTargets = rows.reduce((sum, r) => sum + r.targets, 0);

  return (
    <main className="px-6 sm:px-10 py-12">
      <header className="mb-7 flex flex-wrap items-end justify-between gap-x-6 gap-y-3">
        <div>
          <p className="section-label mb-2">Ecosystem management</p>
          <h1 className="font-serif text-3xl md:text-4xl text-ink tracking-tight">Your ecosystems</h1>
        </div>
        <a
          href="mailto:hello@polygraph.so?subject=Ecosystem%20request"
          className="font-mono text-[11px] uppercase tracking-[0.1em] text-ink-muted border-b border-dotted border-rule pb-0.5 hover:text-oxblood transition-colors"
        >
          Request an ecosystem →
        </a>
      </header>

      {total === 0 ? (
        <div className="border border-rule rounded-[4px] px-6 py-10 text-center max-w-xl">
          <p className="text-ink-muted text-[15px]">You&rsquo;re not part of any ecosystem yet.</p>
          <p className="mt-2 text-ink-faint text-[13px]">
            Ecosystems are provisioned by polygraph. Email{" "}
            <a
              href="mailto:hello@polygraph.so"
              className="underline decoration-dotted hover:text-oxblood"
            >
              hello@polygraph.so
            </a>{" "}
            to set one up, or ask an admin to invite you.
          </p>
        </div>
      ) : (
        <>
          <p className={`${MICRO_LABEL} mb-2.5`}>Overview</p>
          <div className="mb-8 grid grid-cols-2 sm:grid-cols-4 gap-px overflow-hidden rounded-[4px] border border-rule bg-rule">
            <Stat label="Ecosystems" value={total} caption="you manage" />
            <Stat label="Awaiting activation" value={awaiting} caption="not yet live" accent />
            <Stat label="Live" value={live} caption="public pages" />
            <Stat label="Targets" value={totalTargets} caption="across all" />
          </div>

          <div className="flex flex-col gap-8 xl:flex-row xl:items-start xl:gap-8">
            <section className="min-w-0 flex-1">
              <div className="mb-0.5 flex items-baseline justify-between gap-4">
                <p className={MICRO_LABEL}>Managed ecosystems</p>
                <span className="font-mono text-[10px] uppercase tracking-[0.12em] text-ink-faint tabular">
                  {total} total
                </span>
              </div>

              {/* Column header — the register reads as a table from lg up; below that
                  each row reflows to a stacked card, so the header hides. */}
              <div className={`hidden ${REGISTER_COLS} border-b border-rule py-2`}>
                <HeadCell>Ecosystem</HeadCell>
                <HeadCell>Status</HeadCell>
                <HeadCell>Role</HeadCell>
                <HeadCell align="right">Targets</HeadCell>
                <HeadCell align="right">Members</HeadCell>
                <span />
              </div>

              {rows.map(({ ecosystem, role, paid, targets, members }) => (
                <div
                  key={ecosystem.id}
                  className={`flex flex-wrap items-center gap-x-4 gap-y-2 border-t border-rule-soft py-3.5 ${REGISTER_COLS} lg:gap-y-0`}
                >
                  <div className="min-w-0 basis-full lg:basis-auto">
                    <Link
                      href={`/manage/${ecosystem.slug}`}
                      className="block truncate font-serif text-[17px] leading-tight text-ink hover:text-oxblood transition-colors"
                    >
                      {ecosystem.name}
                    </Link>
                    <span className="font-mono text-[11px] text-ink-faint">/{ecosystem.slug}</span>
                  </div>

                  <span>
                    {paid ? (
                      <span className="inline-block font-mono text-[10px] uppercase tracking-[0.06em] text-grade-a border border-grade-a/40 rounded-full px-2 py-[3px] whitespace-nowrap">
                        live
                      </span>
                    ) : (
                      <span className="inline-block font-mono text-[10px] uppercase tracking-[0.06em] text-oxblood border border-oxblood/40 rounded-full px-2 py-[3px] whitespace-nowrap">
                        activation required
                      </span>
                    )}
                  </span>

                  <span className="font-mono text-[10px] uppercase tracking-[0.1em] text-ink-muted">
                    {ROLE_LABEL[role] ?? role}
                  </span>

                  <span className="font-mono text-[13px] text-ink tabular lg:text-right">
                    {targets}
                    <span className={`lg:hidden ${COUNT_SUFFIX}`}> targets</span>
                  </span>
                  <span className="font-mono text-[13px] text-ink tabular lg:text-right">
                    {members}
                    <span className={`lg:hidden ${COUNT_SUFFIX}`}> members</span>
                  </span>

                  <Link
                    href={`/manage/${ecosystem.slug}`}
                    className="font-mono text-[10px] uppercase tracking-[0.1em] text-ink-muted hover:text-oxblood transition-colors lg:text-right"
                  >
                    Manage →
                  </Link>
                </div>
              ))}
            </section>

            <aside className="flex w-full flex-col gap-6 xl:w-[300px] xl:flex-shrink-0">
              <div className="rounded-[4px] border border-rule p-4">
                <p className={`${MICRO_LABEL} mb-2.5`}>Provisioning</p>
                <p className="text-[13px] leading-relaxed text-ink-muted">
                  Ecosystems are provisioned by polygraph. Email{" "}
                  <a
                    href="mailto:hello@polygraph.so"
                    className="text-ink underline decoration-dotted decoration-rule underline-offset-2 hover:text-oxblood"
                  >
                    hello@polygraph.so
                  </a>{" "}
                  to set one up, or ask an admin to invite you.
                </p>
              </div>

              <div>
                <p className={`${MICRO_LABEL} mb-3`}>Reading this page</p>
                <div className="flex flex-col gap-3">
                  <LegendRow badge="activation required" tone="oxblood">
                    Billing not active — the public page stays hidden until activated.
                  </LegendRow>
                  <LegendRow badge="live" tone="grade-a">
                    Monitoring active — the public page is available.
                  </LegendRow>
                  <LegendRow badge="app admin" tone="neutral">
                    Full control of settings, members, entries and CVEs.
                  </LegendRow>
                </div>
              </div>

              <div>
                <p className={`${MICRO_LABEL} mb-2`}>Elsewhere</p>
                <a
                  href="/ecosystems"
                  className="block font-mono text-[11px] tracking-[0.06em] text-ink-muted py-1 hover:text-oxblood transition-colors"
                >
                  Public directory ↗
                </a>
                <a
                  href="/dashboard"
                  className="block font-mono text-[11px] tracking-[0.06em] text-ink-muted py-1 hover:text-oxblood transition-colors"
                >
                  Your monitors ↗
                </a>
              </div>
            </aside>
          </div>
        </>
      )}
    </main>
  );
}

const COUNT_SUFFIX = "text-ink-faint tracking-[0.06em]";

function Stat({
  label,
  value,
  caption,
  accent = false,
}: {
  label: string;
  value: number;
  caption: string;
  accent?: boolean;
}) {
  return (
    <div className="bg-parchment-50 px-4 py-3.5">
      <p className="mb-1.5 font-mono text-[10px] uppercase tracking-[0.16em] text-ink-faint">
        {label}
      </p>
      <p
        className={`font-serif text-[28px] leading-none tabular ${accent ? "text-oxblood" : "text-ink"}`}
      >
        {value}
      </p>
      <p className="mt-1.5 font-mono text-[10px] text-ink-faint">{caption}</p>
    </div>
  );
}

function HeadCell({
  children,
  align = "left",
}: {
  children: ReactNode;
  align?: "left" | "right";
}) {
  return (
    <span
      className={`font-mono text-[9px] uppercase tracking-[0.14em] text-ink-faint ${align === "right" ? "text-right" : ""}`}
    >
      {children}
    </span>
  );
}

function LegendRow({
  badge,
  tone,
  children,
}: {
  badge: string;
  tone: "oxblood" | "grade-a" | "neutral";
  children: ReactNode;
}) {
  const toneClass =
    tone === "oxblood"
      ? "text-oxblood border-oxblood/40"
      : tone === "grade-a"
        ? "text-grade-a border-grade-a/40"
        : "text-ink-muted border-rule";
  return (
    <div className="flex items-start gap-2.5">
      <span
        className={`shrink-0 font-mono text-[9px] uppercase tracking-[0.1em] border rounded-full px-2 py-[3px] whitespace-nowrap ${toneClass}`}
      >
        {badge}
      </span>
      <span className="text-[12px] leading-relaxed text-ink-muted">{children}</span>
    </div>
  );
}
