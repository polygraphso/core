/**
 * /request/priority/[id] — the grading-fee checkout for one request. Public:
 * knowing the request uuid is the capability (it's shown only to the
 * requester; paying someone else's request just gifts them the fee). The
 * request must exist and still be open; anything else redirects back to
 * /request. The fee buys the run, never the grade. (The route keeps the
 * "priority" name from when this was an optional fast lane on a free queue —
 * links to it are already in inboxes.)
 */

import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { getSupabaseAdmin } from "@/lib/supabase";
import { PRIORITY_GRADE_PRICE_USD } from "@/lib/paymentConfig";
import { PriorityCheckout } from "./_components/PriorityCheckout";
import { GradingProgress } from "./_components/GradingProgress";

export const metadata: Metadata = {
  title: "Grading fee",
  robots: { index: false },
};

export default async function PriorityPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;

  const db = getSupabaseAdmin();
  if (!db) redirect("/request");

  const { data: req } = await db
    .from("grade_requests")
    .select("id, target, status, priority_paid_at, priority_deadline_at")
    .eq("id", id)
    .maybeSingle();

  if (!req) redirect("/request");

  const alreadyPaid = Boolean(req.priority_paid_at);
  const resolved = req.status === "completed" || req.status === "declined";

  return (
    <div className="mx-auto max-w-3xl">
      <header className="mb-10">
        <p className="section-label mb-4">Grading fee</p>
        <h1 className="font-serif text-4xl md:text-5xl text-ink tracking-tight leading-[1.05]">
          Grade it now.
        </h1>
        <p className="mt-5 font-serif italic text-ink-muted text-lg md:text-xl leading-snug">
          {req.target as string}
        </p>
        <p className="mt-4 text-ink-muted leading-relaxed max-w-xl">
          {`Pay the $${PRIORITY_GRADE_PRICE_USD} fee in $POLYGRAPH and the grade runs on the spot, usually in a minute or two. The fee buys the run, never the grade: the battery, thresholds, and publication path are the same for everyone, and every grade stays reproducible.`}
        </p>
      </header>

      {alreadyPaid ? (
        // Already paid — show the live grading state (running / graded / failed).
        <GradingProgress requestId={id} />
      ) : resolved ? (
        <div className="border-l-2 pl-4" style={{ borderColor: "var(--color-oxblood)" }}>
          <p className="text-[15px] leading-relaxed text-ink">
            This request is already {req.status as string}. Nothing to pay for &mdash; check{" "}
            <a href="/mcp-index" className="underline decoration-dotted hover:text-oxblood">
              the index
            </a>{" "}
            for its grade.
          </p>
        </div>
      ) : (
        <PriorityCheckout requestId={id} />
      )}
    </div>
  );
}
