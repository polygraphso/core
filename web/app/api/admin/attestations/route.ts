import { getSupabaseAdmin } from "@/lib/supabase";
import { HOSTED_GRADE_COLUMNS, type HostedGradeRow } from "@/lib/hostedGrades";
import { buildFields } from "@/lib/attestations/encode";
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

  if (!process.env.ATTESTER_PRIVATE_KEY || !process.env.BASE_RPC_URL || !process.env.EAS_SCHEMA_UID) {
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
  const { data: row, error } = await db
    .from("hosted_runs")
    .select(`id, ${HOSTED_GRADE_COLUMNS}`)
    .eq("id", hostedRunId)
    .eq("status", "complete")
    .not("published_at", "is", null)
    .maybeSingle();
  if (error || !row) {
    return Response.json({ error: "Published grade not found" }, { status: 400 });
  }

  const fields = buildFields(row as HostedGradeRow);
  if (!fields) {
    return Response.json({ error: "Row has no valid grade" }, { status: 400 });
  }

  const pendingId = await insertPending(db, {
    hosted_run_id: hostedRunId,
    server: fields.server,
    version: fields.version,
    grade: fields.grade,
    schema_uid: process.env.EAS_SCHEMA_UID,
    chain_id: cfg.chainId,
    evidence_hash: fields.evidenceHash,
  });

  try {
    const { uid, txHash, attester } = await attestGrade(fields);
    await markConfirmed(db, pendingId, {
      attestation_uid: uid,
      tx_hash: txHash,
      attester_address: attester,
    });
    return Response.json({
      status: "confirmed",
      attestation_uid: uid,
      tx_hash: txHash,
      url: attestationUrl(cfg, uid),
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    await markFailed(db, pendingId, msg);
    return Response.json({ status: "failed", error: msg }, { status: 502 });
  }
}
