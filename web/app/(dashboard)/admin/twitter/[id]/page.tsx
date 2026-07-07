import Link from "next/link";
import { notFound } from "next/navigation";
import { getSupabaseAdmin } from "@/lib/supabase";
import type { TwitterThreadRow } from "@/lib/twitterThreads";
import { ThreadEditor } from "../_components/ThreadEditor";

export const dynamic = "force-dynamic";

export default async function AdminTwitterThreadPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;

  const db = getSupabaseAdmin();
  if (!db) return <main className="px-8 py-12 font-mono text-sm">Database not configured.</main>;

  const { data } = await db.from("twitter_threads").select("*").eq("id", id).maybeSingle();
  if (!data) notFound();
  const thread = data as TwitterThreadRow;

  return (
    <main className="px-8 py-12 max-w-3xl">
      <Link
        href="/admin/twitter"
        className="font-mono text-[11px] text-ink/50 hover:text-oxblood"
      >
        ‹ All threads
      </Link>
      <ThreadEditor thread={thread} />
    </main>
  );
}
