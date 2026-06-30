import { getSupabaseAdmin } from "@/lib/supabase";
import { getChainConfig } from "@/lib/attestations/chains";
import { listLatestRunsWithStatus } from "@/lib/attestations/store";
import { AttestationsTable } from "./AttestationsTable";

export const dynamic = "force-dynamic";

export default async function AdminAttestationsPage() {
  const db = getSupabaseAdmin();
  if (!db) return <main className="p-8 font-mono text-sm">Database not configured.</main>;

  const cfg = getChainConfig();
  const rows = await listLatestRunsWithStatus(db);

  return (
    <main className="mx-auto max-w-5xl px-6 py-12">
      <h1 className="font-serif text-3xl mb-1">Grade attestations</h1>
      <p className="font-mono text-[11px] text-ink/60 mb-1">
        Network: {cfg.chain} (chainId {cfg.chainId}) · latest run per target — re-grade, publish a draft, then attest.
      </p>
      <p className="font-mono text-[11px] text-ink/45 mb-8">
        Re-grades run on the hosted runner (not Vercel) and poll here until done — skills ~3s, servers ~30–60s. Safe to leave; the result lands even if you close the tab.
      </p>
      <AttestationsTable rows={rows} chain={cfg} />
    </main>
  );
}
