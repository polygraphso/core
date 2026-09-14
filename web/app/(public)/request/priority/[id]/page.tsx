/**
 * /request/priority/[id] — was the grading-fee checkout. Hosted grading is
 * discontinued: no new payments, no runner kickoff. Existing completed
 * requests still point at the published grade.
 */

import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { getSupabaseAdmin } from "@/lib/supabase";

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
    .select("id, target, status, priority_paid_at")
    .eq("id", id)
    .maybeSingle();

  if (!req) redirect("/request");

  const completed = req.status === "completed";

  return (
    <div className="mx-auto max-w-3xl">
      <header className="mb-10">
        <p className="section-label mb-4">Hosted grading · discontinued</p>
        <h1 className="font-serif text-4xl md:text-5xl text-ink tracking-tight leading-[1.05]">
          Hosted grading is discontinued.
        </h1>
        <p className="mt-5 font-serif italic text-ink-muted text-lg md:text-xl leading-snug">
          {req.target as string}
        </p>
      </header>

      {completed ? (
        <p className="text-[15px] leading-relaxed text-ink-muted max-w-xl">
          This request already has a published grade. Check{" "}
          <a href="/mcp-index" className="underline decoration-dotted hover:text-oxblood">
            the index
          </a>
          .
        </p>
      ) : (
        <p className="text-[15px] leading-relaxed text-ink-muted max-w-xl">
          We are no longer accepting payment or running hosted grades. Existing
          published grades stay on the site. To grade a server yourself, run the
          open harness — see{" "}
          <a href="/request" className="underline decoration-dotted hover:text-oxblood">
            the request page
          </a>
          .
        </p>
      )}
    </div>
  );
}
