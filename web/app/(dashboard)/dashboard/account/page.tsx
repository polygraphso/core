/**
 * /dashboard/account — the membership hub. Shows who you're signed in as,
 * your plan (with the upgrade/cancel flow), and a danger zone to delete the
 * account. Session-gated by the proxy. The plan-management UI is the same
 * UpgradeFlow the old /dashboard/upgrade rendered (that route now redirects
 * here).
 */

import type { Metadata } from "next";
import { getSession } from "@/lib/session";
import { getUserPlan } from "@/lib/userPlans";
import { PLAN_QUOTAS } from "@/lib/paymentConfig";
import { SignOutButton } from "../_components/SignOutButton";
import { UpgradeFlow } from "./_components/UpgradeFlow";
import { DeleteAccount } from "./_components/DeleteAccount";

export const metadata: Metadata = {
  title: "Account",
  robots: { index: false },
};

export default async function AccountPage() {
  const session = await getSession();
  if (!session) return null; // proxy redirects before this renders

  const planState = await getUserPlan(session.userId);
  const hasActivePlan = planState.plan !== "free";

  return (
    <main className="px-6 sm:px-10 py-12">
      <header className="mb-8 flex flex-wrap items-start justify-between gap-x-6 gap-y-3">
        <div>
          <p className="section-label mb-2">Account</p>
          <h1 className="font-serif text-3xl md:text-4xl text-ink tracking-tight">
            {session.email}
          </h1>
          <p className="mt-2 font-mono text-[12px] text-ink-muted">
            {planState.plan === "free" ? "Free" : planState.plan} plan ·{" "}
            {session.isAdmin ? "uncapped" : `${PLAN_QUOTAS[planState.plan]} monitors`}
            {hasActivePlan && planState.endAt ? (
              <>
                {" "}
                · renews by{" "}
                {new Date(planState.endAt).toLocaleDateString("en-US", {
                  month: "short",
                  day: "numeric",
                })}
              </>
            ) : null}
          </p>
        </div>
        <SignOutButton />
      </header>

      {/* Membership */}
      <section className="mb-14">
        <div className="mb-5">
          <h2 className="font-serif text-xl text-ink">Membership</h2>
          <p className="mt-1 text-[15px] leading-relaxed text-ink-muted max-w-xl">
            The free tier watches one target. A plan lifts that cap; everything a monitor does
            (re-grades on new versions, email alerts, thresholds) stays the same. Plans buy
            coverage, never grades: nobody can pay for a grade.
          </p>
        </div>
        {session.isAdmin ? (
          <p className="border border-rule rounded-[4px] px-5 py-4 font-mono text-[12px] text-ink-muted">
            You&rsquo;re an app admin, so your monitor quota is uncapped. Plans don&rsquo;t apply.
          </p>
        ) : (
          <UpgradeFlow
            userId={session.userId}
            currentPlan={planState.plan}
            active={
              planState.payment
                ? { streamId: planState.payment.stream_id, lockup: planState.payment.sablier_contract }
                : null
            }
          />
        )}
      </section>

      {/* Danger zone */}
      <section>
        <h2 className="font-serif text-xl text-ink mb-1">Delete account</h2>
        <p className="mb-4 text-[15px] leading-relaxed text-ink-muted max-w-xl">
          Permanently removes your account and everything tied to it: your monitors, alert
          history, plan records, and ecosystem memberships. This cannot be undone.
        </p>
        <DeleteAccount email={session.email} hasActivePlan={hasActivePlan} />
      </section>
    </main>
  );
}
