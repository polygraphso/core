import { getSupabaseAdmin } from "@/lib/supabase";
import { HOSTED_GRADE_COLUMNS, type HostedGradeRow } from "@/lib/hostedGrades";
import {
  buildServerFields,
  encodeServerFields,
  buildSkillFields,
  encodeSkillFields,
} from "@/lib/attestations/encode";
import { attestGrade } from "@/lib/attestations/eas";
import { getChainConfig, attestationUrl } from "@/lib/attestations/chains";
import {
  findConfirmed,
  insertPending,
  markConfirmed,
  markFailed,
} from "@/lib/attestations/store";

export async function POST(request: Request) {
  let body: { hosted_run_id?: unknown };
  try {
    body = (await request.json()) as { hosted_run_id?: unknown };
  } catch {
    return Response.json({ error: "Invalid JSON" }, { status: 400 });
  }
  const rawId = body.hosted_run_id;
  if (typeof rawId !== "string" && typeof rawId !== "number") {
    return Response.json({ error: "hosted_run_id is required" }, { status: 400 });
  }
  const hostedRunId = String(rawId);

  const db = getSupabaseAdmin();
  if (!db) return Response.json({ error: "Database not configured" }, { status: 500 });

  if (!process.env.ATTESTER_PRIVATE_KEY || !process.env.BASE_RPC_URL) {
    return Response.json({ error: "Attestation wallet not configured" }, { status: 503 });
  }
  const cfg = getChainConfig();

  // Idempotency: never double-attest a run that already has a confirmed record.
  const existing = await findConfirmed(db, hostedRunId);
  if (existing?.attestation_uid) {
    return Response.json(
      {
        status: "already",
        attestation_uid: existing.attestation_uid,
        url: attestationUrl(cfg, existing.attestation_uid),
      },
      { status: 409 },
    );
  }

  // Re-read the grade server-side; never trust client-supplied grade data.
  // registry_ref → the /grade evidence page; skill → the /skill page — both kinds
  // resolve the attestation's evidenceURI. (remote_url is not yet wired.)
  const { data: row, error } = await db
    .from("hosted_runs")
    .select(`id, ${HOSTED_GRADE_COLUMNS}`)
    .eq("id", hostedRunId)
    .in("target_kind", ["registry_ref", "skill"])
    .eq("status", "complete")
    .not("published_at", "is", null)
    .maybeSingle();
  if (error || !row) {
    return Response.json({ error: "Published grade not found" }, { status: 400 });
  }

  // Pick the schema by target kind: skills use the separate skill schema + UID.
  const r = row as HostedGradeRow;
  let data: string;
  let schemaUid: string | undefined;
  let server: string;
  let version: string;
  let grade: string;
  let evidence_hash: string;
  if (r.target_kind === "skill") {
    const f = buildSkillFields(r);
    if (!f) return Response.json({ error: "Row has no valid grade" }, { status: 400 });
    schemaUid = process.env.EAS_SKILL_SCHEMA_UID;
    data = encodeSkillFields(f);
    ({ skillRef: server, resolvedRef: version, overallGrade: grade, evidenceHash: evidence_hash } = f);
  } else {
    const f = buildServerFields(r);
    if (!f) return Response.json({ error: "Row has no valid grade" }, { status: 400 });
    schemaUid = process.env.EAS_SCHEMA_UID;
    data = encodeServerFields(f);
    ({ serverRef: server, resolvedVersion: version, overallGrade: grade, evidenceHash: evidence_hash } = f);
  }
  if (!schemaUid) {
    return Response.json({ error: "Schema not configured for this target kind" }, { status: 503 });
  }

  const pendingId = await insertPending(db, {
    hosted_run_id: hostedRunId,
    server,
    version,
    grade,
    schema_uid: schemaUid,
    chain_id: cfg.chainId,
    evidence_hash,
  });

  // Only the on-chain submission may mark the row failed. Once the tx lands we
  // must never label it failed — that would invite a duplicate attestation
  // (and wasted gas) on retry.
  let attested;
  try {
    attested = await attestGrade(data, schemaUid);
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    await markFailed(db, pendingId, msg);
    return Response.json({ status: "failed", error: msg }, { status: 502 });
  }

  const { uid, txHash, attester } = attested;
  try {
    await markConfirmed(db, pendingId, {
      attestation_uid: uid,
      tx_hash: txHash,
      attester_address: attester,
    });
  } catch (e) {
    // The attestation IS on-chain; only the DB record lagged. Surface the UID
    // loudly so it is not lost, and still return confirmed so the operator
    // does not re-submit. (The pending row can be reconciled manually.)
    console.error(
      `[attestations] on-chain attestation ${uid} (tx ${txHash}) succeeded but markConfirmed failed for row ${pendingId}:`,
      e instanceof Error ? e.message : String(e),
    );
  }
  return Response.json({
    status: "confirmed",
    attestation_uid: uid,
    tx_hash: txHash,
    url: attestationUrl(cfg, uid),
  });
}
