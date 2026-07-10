/**
 * /manage — the ecosystems this signed-in user can manage. App admins see every
 * ecosystem; everyone else sees the ones they've been invited to (after any pending
 * email invites are claimed). Proxy guarantees a session before this route.
 */

import Link from "next/link";
import { redirect } from "next/navigation";
import { getSession } from "@/lib/session";
import { listEcosystemsForUser } from "@/lib/ecosystemAccess";
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

export default async function ManageLandingPage() {
  const session = await getSession();
  if (!session) redirect("/login?next=/manage");

  const managed = await listEcosystemsForUser(session);
  const rows = await Promise.all(
    managed.map(async (m) => ({
      ...m,
      paid: (await getPaymentGate(m.ecosystem)).status === "active",
    })),
  );

  return (
    <main className="px-6 sm:px-10 py-12 max-w-3xl">
      <header className="mb-8">
        <p className="section-label mb-3">Ecosystem management</p>
        <h1 className="font-serif text-3xl md:text-4xl text-ink tracking-tight">Your ecosystems</h1>
        <p className="mt-3 text-ink-muted text-[15px] leading-relaxed max-w-xl">
          Add MCP servers and skills to be graded, see what would raise each grade, and curate what
          appears on the ecosystem&rsquo;s public page.
        </p>
      </header>

      {managed.length === 0 ? (
        <div className="border border-rule rounded-[4px] px-6 py-10 text-center">
          <p className="text-ink-muted text-[15px]">
            You&rsquo;re not part of any ecosystem yet.
          </p>
          <p className="mt-2 text-ink-faint text-[13px]">
            Ecosystems are provisioned by polygraph. Email{" "}
            <a href="mailto:hello@polygraph.so" className="underline decoration-dotted hover:text-oxblood">
              hello@polygraph.so
            </a>{" "}
            to set one up, or ask an admin to invite you.
          </p>
        </div>
      ) : (
        <ul className="divide-y divide-rule border-y border-rule">
          {rows.map(({ ecosystem, role, paid }) => (
            <li key={ecosystem.id}>
              <Link
                href={`/manage/${ecosystem.slug}`}
                className="flex items-center justify-between gap-4 py-4 group"
              >
                <div className="min-w-0">
                  <div className="font-serif text-lg text-ink group-hover:text-oxblood transition-colors">
                    {ecosystem.name}
                  </div>
                  <div className="font-mono text-[11px] text-ink-faint">/{ecosystem.slug}</div>
                </div>
                <div className="flex shrink-0 items-center gap-2">
                  {!paid ? (
                    <span className="font-mono text-[10px] uppercase tracking-[0.14em] text-oxblood border border-oxblood/40 rounded-full px-2.5 py-1">
                      activation required
                    </span>
                  ) : null}
                  <span className="font-mono text-[10px] uppercase tracking-[0.14em] text-ink-muted border border-rule rounded-full px-2.5 py-1">
                    {ROLE_LABEL[role] ?? role}
                  </span>
                </div>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </main>
  );
}
