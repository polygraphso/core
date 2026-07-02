import { notFound } from "next/navigation";
import { getSupabaseAdmin } from "@/lib/supabase";
import { fetchPublishedGrade } from "@/lib/hostedGrades";
import { getChainConfig, attestationUrl, attesterName } from "@/lib/attestations/chains";
import { findLatestConfirmedByServerVersion } from "@/lib/attestations/store";

export const dynamic = "force-dynamic";

/** Decode a single path segment; fall back to the raw value on malformed input. */
function decodeSegment(s: string): string {
  try {
    return decodeURIComponent(s);
  } catch {
    return s;
  }
}

function fmtDate(iso: string | null): string {
  if (!iso) return "—";
  return new Date(iso).toLocaleDateString("en-US", {
    year: "numeric",
    month: "long",
    day: "numeric",
    timeZone: "UTC",
  });
}

export default async function GradePage({
  params,
  searchParams,
}: {
  params: Promise<{ slug: string[] }>;
  searchParams: Promise<{ v?: string }>;
}) {
  const { slug } = await params;
  const { v } = await searchParams;
  // Next does not URL-decode catch-all segments, so a scoped server key like
  // `npm/@scope/pkg` arrives as `npm/%40scope/pkg`. Decode each segment back to
  // the canonical server key the grade is stored under.
  const serverKey = slug.map(decodeSegment).join("/");

  const db = getSupabaseAdmin();
  if (!db) notFound();

  const result = await fetchPublishedGrade(db, serverKey, v ?? null);
  if (!result) notFound();
  const { grade, detail } = result;

  const cfg = getChainConfig();
  const att = await findLatestConfirmedByServerVersion(
    db,
    serverKey,
    detail.resolved_version ?? "",
    cfg.chainId,
  );

  const cats: Array<[string, string | null]> = [
    ["C-01", detail.c01],
    ["C-02", detail.c02],
    ["C-03", detail.c03],
    ["C-04", detail.c04],
  ];

  return (
    <div className="mx-auto max-w-3xl">
      <p className="section-label mb-4">Polygraph grade</p>
      <h1 className="font-mono text-2xl text-ink break-all mb-1">{serverKey}</h1>
      <p className="font-mono text-xs text-ink/60 mb-8">
        version {detail.resolved_version || "—"} · methodology {detail.methodology_version} ·
        graded {fmtDate(detail.computed_at)}
      </p>

      <div className="flex items-baseline gap-4 mb-10">
        <span className="font-serif text-6xl text-oxblood">{grade}</span>
        {detail.rationale && <p className="text-ink/80 text-sm">{detail.rationale}</p>}
      </div>

      <dl className="grid grid-cols-1 gap-2 mb-10 text-sm">
        {cats.map(([code, status]) => (
          <div key={code} className="flex justify-between border-b hairline py-2">
            <dt className="font-mono text-xs">{code}</dt>
            <dd className="text-ink/80">{status ?? "—"}</dd>
          </div>
        ))}
        <div className="flex justify-between border-b hairline py-2">
          <dt className="font-mono text-xs">tool-defs fingerprint</dt>
          <dd className="font-mono text-xs text-ink/80 break-all">
            {detail.tool_defs_fingerprint ?? "—"}
          </dd>
        </div>
      </dl>

      <section className="mt-10 pt-6 border-t hairline">
        <p className="section-label mb-3">On-chain attestation</p>
        {att?.attestation_uid ? (
          <div className="text-sm">
            <p className="mb-2">
              <a
                className="text-oxblood underline"
                href={attestationUrl(cfg, att.attestation_uid)}
                target="_blank"
                rel="noreferrer"
              >
                View on {cfg.chain} EAS explorer ↗
              </a>
            </p>
            <p className="font-mono text-[11px] text-ink/60 break-all">
              attester {attesterName(att.attester_address)}
            </p>
            <p className="font-mono text-[11px] text-ink/60 break-all">
              evidenceHash {att.evidence_hash}
            </p>
            <p className="text-[11px] text-ink/50 mt-3">
              evidenceHash is keccak256 of the canonical evidence bundle; anyone can
              recompute it to verify this grade was not altered.
            </p>
          </div>
        ) : (
          <p className="text-sm text-ink/60">Not yet attested on-chain.</p>
        )}
      </section>
    </div>
  );
}
