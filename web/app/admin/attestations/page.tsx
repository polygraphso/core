import { getSupabaseAdmin } from "@/lib/supabase";
import { getChainConfig, attestationUrl } from "@/lib/attestations/chains";
import { listPublishedWithStatus } from "@/lib/attestations/store";
import { skillRefToPath } from "@/lib/skillGrades";
import { AttestButton } from "./AttestButton";

export const dynamic = "force-dynamic";

/** Public report page for a graded target: /skill for skills, /mcp for servers. */
function reportHref(server: string, targetKind: string): string {
  return targetKind === "skill" ? `/skill/${skillRefToPath(server)}` : `/mcp/${server}`;
}

export default async function AdminAttestationsPage() {
  const db = getSupabaseAdmin();
  if (!db) return <main className="p-8 font-mono text-sm">Database not configured.</main>;

  const cfg = getChainConfig();
  const rows = await listPublishedWithStatus(db);

  return (
    <main className="mx-auto max-w-4xl px-6 py-12">
      <h1 className="font-serif text-3xl mb-1">Grade attestations</h1>
      <p className="font-mono text-[11px] text-ink/60 mb-8">
        Network: {cfg.chain} (chainId {cfg.chainId})
      </p>

      <table className="w-full text-sm border-collapse">
        <thead>
          <tr className="text-left border-b hairline font-mono text-[11px] uppercase tracking-wide">
            <th className="py-2 pr-3">Server</th>
            <th className="py-2 pr-3">Version</th>
            <th className="py-2 pr-3">Grade</th>
            <th className="py-2 pr-3">Status</th>
            <th className="py-2" />
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => (
            <tr key={r.hosted_run_id} className="border-b hairline align-middle">
              <td className="py-2 pr-3 font-mono text-[12px]">
                <a
                  className="underline decoration-dotted hover:text-oxblood"
                  href={reportHref(r.server, r.target_kind)}
                  target="_blank"
                  rel="noreferrer"
                >
                  {r.server}
                </a>
              </td>
              <td className="py-2 pr-3 font-mono text-[12px]">{r.version || "—"}</td>
              <td className="py-2 pr-3">{r.grade}</td>
              <td className="py-2 pr-3 text-[12px]">
                {r.status === "confirmed" && r.attestation_uid ? (
                  <a
                    className="text-oxblood underline"
                    href={attestationUrl(cfg, r.attestation_uid)}
                    target="_blank"
                    rel="noreferrer"
                  >
                    ✅ on-chain
                  </a>
                ) : r.status === "pending" ? (
                  "⏳ pending"
                ) : r.status === "failed" ? (
                  <span className="text-oxblood">failed: {r.error}</span>
                ) : (
                  "not attested"
                )}
              </td>
              <td className="py-2">
                {r.status !== "confirmed" && r.status !== "pending" && (
                  <AttestButton hostedRunId={r.hosted_run_id} />
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </main>
  );
}
