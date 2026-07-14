/**
 * /request/priority/[id] — the paid 48h lane checkout for one queued request.
 * Session-gated by the proxy (/request/:path*). The request must exist, belong
 * to this account, and still be open; anything else redirects back to /request
 * with a note. The fee buys turnaround, never the grade.
 */

import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { getSession } from "@/lib/session";
import { getSupabaseAdmin } from "@/lib/supabase";
import { PRIORITY_GRADE_PRICE_USD } from "@/lib/paymentConfig";
import { PriorityCheckout } from "./_components/PriorityCheckout";

export const metadata: Metadata = {
  title: "Priority grading",
  robots: { index: false },
};

export default async function PriorityPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const session = await getSession();
  if (!session) redirect(`/login?next=/request/priority/${id}`);

  const db = getSupabaseAdmin();
  if (!db) redirect("/request");

  const { data: req } = await db
    .from("grade_requests")
    .select("id, target, email, status, priority_paid_at, priority_deadline_at")
    .eq("id", id)
    .maybeSingle();

  // Unknown, or not this account's request → back to the queue.
  if (!req || (req.email as string).toLowerCase() !== session.email.toLowerCase()) {
    redirect("/request");
  }

  const alreadyPaid = Boolean(req.priority_paid_at);
  const resolved = req.status === "completed" || req.status === "declined";

  return (
    <div className="mx-auto max-w-3xl">
      <header className="mb-10">
        <p className="section-label mb-4">Priority grading · 48h</p>
        <h1 className="font-serif text-4xl md:text-5xl text-ink tracking-tight leading-[1.05]">
          Move it to the front.
        </h1>
        <p className="mt-5 font-serif italic text-ink-muted text-lg md:text-xl leading-snug">
          {req.target as string}
        </p>
        <p className="mt-4 text-ink-muted leading-relaxed max-w-xl">
          ${PRIORITY_GRADE_PRICE_USD} one-time, paid in $POLYGRAPH, and this request is graded within
          48 hours. Priority buys turnaround, never the grade &mdash; the battery, thresholds, and
          publication path are identical to the free queue, and every grade stays reproducible.
        </p>
      </header>

      {alreadyPaid ? (
        <div className="border-l-2 pl-4" style={{ borderColor: "var(--color-oxblood)" }}>
          <p className="text-[15px] leading-relaxed text-ink">
            This request is already on the 48-hour lane
            {req.priority_deadline_at ? (
              <>
                , graded by{" "}
                <span className="font-mono">
                  {new Date(req.priority_deadline_at as string).toLocaleString("en-US", {
                    month: "short",
                    day: "numeric",
                    hour: "numeric",
                    minute: "2-digit",
                  })}
                </span>
              </>
            ) : null}
            . We&rsquo;ll email you when the grade publishes.
          </p>
        </div>
      ) : resolved ? (
        <div className="border-l-2 pl-4" style={{ borderColor: "var(--color-oxblood)" }}>
          <p className="text-[15px] leading-relaxed text-ink">
            This request is already {req.status as string}. Nothing to expedite &mdash; check{" "}
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
