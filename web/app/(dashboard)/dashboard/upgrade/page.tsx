/**
 * /dashboard/upgrade — the plan checkout. Free watches one target; indie and
 * team lift the monitor quota, paid as a monthly $POLYGRAPH stream exactly
 * like ecosystem monitoring (the stream IS the subscription). Session-gated by
 * the proxy.
 */

import type { Metadata } from "next";
import { getSession } from "@/lib/session";
import { getUserPlan } from "@/lib/userPlans";
import { UpgradeFlow } from "./_components/UpgradeFlow";

export const metadata: Metadata = {
  title: "Upgrade",
  robots: { index: false },
};

export default async function UpgradePage() {
  const session = await getSession();
  if (!session) return null; // proxy redirects before this renders

  const planState = await getUserPlan(session.userId);

  return (
    <main className="px-6 sm:px-10 py-12 max-w-3xl">
      <header className="mb-7">
        <p className="section-label mb-2">Account</p>
        <h1 className="font-serif text-3xl md:text-4xl text-ink tracking-tight">
          More monitor slots
        </h1>
        <p className="mt-3 text-[15px] leading-relaxed text-ink-muted max-w-xl">
          The free tier watches one target. A plan lifts that cap; everything a monitor does —
          re-grades on new versions, email alerts, thresholds — stays the same. Plans buy
          coverage, never grades: nobody can pay for a grade.
        </p>
        {planState.plan !== "free" && planState.endAt ? (
          <p className="mt-2 font-mono text-[11px] text-ink-faint">
            You&rsquo;re on {planState.plan} until{" "}
            {new Date(planState.endAt).toLocaleDateString("en-US", {
              month: "long",
              day: "numeric",
            })}
            . Paying again extends from a new stream.
          </p>
        ) : null}
      </header>

      <UpgradeFlow
        userId={session.userId}
        currentPlan={planState.plan}
        active={
          planState.payment
            ? { streamId: planState.payment.stream_id, lockup: planState.payment.sablier_contract }
            : null
        }
      />
    </main>
  );
}
