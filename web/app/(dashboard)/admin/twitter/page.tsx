import Link from "next/link";
import { getSupabaseAdmin } from "@/lib/supabase";
import type { TwitterAccount, TwitterThreadRow } from "@/lib/twitterThreads";
import { NewThreadButton } from "./_components/NewThreadButton";
import { CopyThreadButton } from "./_components/CopyThreadButton";

export const dynamic = "force-dynamic";

const STATUS_STYLE: Record<TwitterThreadRow["status"], string> = {
  draft: "text-ink/50 border-rule",
  scheduled: "text-ink border-ink/40",
  posted: "text-oxblood border-oxblood/40",
};

const ACCOUNT_STYLE: Record<TwitterAccount, string> = {
  product: "text-ink border-ink/40",
  personal: "text-ink/50 border-rule",
};

const ACCOUNT_LABEL: Record<TwitterAccount, string> = {
  product: "@polygraphso",
  personal: "personal",
};

const ACCOUNT_FILTERS: { value: TwitterAccount | null; label: string }[] = [
  { value: null, label: "All" },
  { value: "product", label: "@polygraphso" },
  { value: "personal", label: "Personal" },
];

/** ISO → "2026-07-06 09:00" (UTC), or "—". */
function fmt(iso: string | null): string {
  if (!iso) return "—";
  const m = iso.match(/^(\d{4}-\d{2}-\d{2})T(\d{2}:\d{2})/);
  return m ? `${m[1]} ${m[2]}` : iso.slice(0, 16);
}

export default async function AdminTwitterPage({
  searchParams,
}: {
  searchParams: Promise<{ account?: string }>;
}) {
  const db = getSupabaseAdmin();
  if (!db) return <main className="px-8 py-12 font-mono text-sm">Database not configured.</main>;

  const params = await searchParams;
  const account: TwitterAccount | null =
    params.account === "product" || params.account === "personal" ? params.account : null;

  let query = db
    .from("twitter_threads")
    .select("*")
    .order("scheduled_at", { ascending: true, nullsFirst: false })
    .order("updated_at", { ascending: false });
  if (account) query = query.eq("account", account);

  const { data, error } = await query;

  const rows = (data ?? []) as TwitterThreadRow[];

  return (
    <main className="px-8 py-12">
      <div className="flex items-start justify-between gap-4 mb-8">
        <div>
          <p className="section-label mb-1">Internal</p>
          <h1 className="font-serif text-3xl mb-1">Twitter threads</h1>
          <p className="font-mono text-[11px] text-ink/60">
            Launch &amp; announcement threads — {rows.length} thread
            {rows.length === 1 ? "" : "s"}. Edited here; the DB is the source of truth.
          </p>
        </div>
        <NewThreadButton />
      </div>

      <div className="flex items-center gap-2 mb-4">
        {ACCOUNT_FILTERS.map((f) => {
          const active = f.value === account;
          return (
            <Link
              key={f.label}
              href={f.value ? `/admin/twitter?account=${f.value}` : "/admin/twitter"}
              className={`font-mono text-[11px] border px-2 py-1 ${
                active ? "bg-ink/5 border-ink/40 text-ink" : "text-ink/50 hover:bg-ink/5"
              }`}
            >
              {f.label}
            </Link>
          );
        })}
      </div>

      {error && (
        <p className="font-mono text-[12px] text-oxblood mb-4">Failed to load: {error.message}</p>
      )}

      {rows.length === 0 ? (
        <p className="font-mono text-[12px] text-ink/50">No threads yet. Create one to start.</p>
      ) : (
        <table className="w-full text-sm border-collapse">
          <thead>
            <tr className="text-left border-b hairline font-mono text-[11px] uppercase tracking-wide">
              <th className="py-2 pr-3">Title</th>
              <th className="py-2 pr-3">Account</th>
              <th className="py-2 pr-3">Status</th>
              <th className="py-2 pr-3">Scheduled</th>
              <th className="py-2 pr-3 text-right">Tweets</th>
              <th className="py-2 pr-3">Updated</th>
              <th className="py-2 pr-3 text-right">Copy</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.id} className="border-b hairline align-middle hover:bg-ink/[0.02]">
                <td className="py-2 pr-3">
                  <Link
                    href={`/admin/twitter/${r.id}`}
                    className="block underline decoration-dotted hover:text-oxblood"
                  >
                    {r.title}
                  </Link>
                  <span className="font-mono text-[11px] text-ink/40">{r.slug}</span>
                </td>
                <td className="py-2 pr-3">
                  <span
                    className={`inline-block border px-2 py-0.5 rounded-sm font-mono text-[10px] tracking-wide ${ACCOUNT_STYLE[r.account]}`}
                  >
                    {ACCOUNT_LABEL[r.account]}
                  </span>
                </td>
                <td className="py-2 pr-3">
                  <span
                    className={`inline-block border px-2 py-0.5 rounded-sm font-mono text-[10px] uppercase tracking-wide ${STATUS_STYLE[r.status]}`}
                  >
                    {r.status}
                  </span>
                </td>
                <td className="py-2 pr-3 font-mono text-[11px] text-ink/70 whitespace-nowrap">
                  {fmt(r.scheduled_at)}
                </td>
                <td className="py-2 pr-3 text-right font-mono text-[12px] tabular">
                  {r.tweets?.length ?? 0}
                </td>
                <td className="py-2 pr-3 font-mono text-[11px] text-ink/50 whitespace-nowrap">
                  {fmt(r.updated_at)}
                </td>
                <td className="py-2 pr-3 text-right">
                  <CopyThreadButton tweets={(r.tweets ?? []).map((t) => t.text)} />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </main>
  );
}
