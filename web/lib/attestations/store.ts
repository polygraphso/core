import type { SupabaseClient } from "@supabase/supabase-js";

export interface AttestationRow {
  id: number;
  hosted_run_id: string;
  server: string;
  version: string;
  grade: string;
  schema_uid: string;
  attestation_uid: string | null;
  tx_hash: string | null;
  chain_id: number;
  attester_address: string | null;
  evidence_hash: string;
  status: "pending" | "confirmed" | "failed";
  error: string | null;
  created_at: string;
  confirmed_at: string | null;
}

export interface AdminRow {
  hosted_run_id: string;
  server: string;
  version: string;
  grade: string;
  status: "none" | "pending" | "confirmed" | "failed";
  attestation_uid: string | null;
  error: string | null;
}

interface RunLite {
  id: number | string;
  target: string;
  grade: string | null;
  evidence: { resolvedVersion?: string | null } | null;
}

/** Pure join: pair each published run with its most-recent attestation row.
 *  `atts` MUST be ordered created_at DESC (first seen per run wins). */
export function joinRunsWithAttestations(
  runs: RunLite[],
  atts: Array<
    Pick<AttestationRow, "hosted_run_id" | "attestation_uid" | "error"> & {
      status: string;
    }
  >,
): AdminRow[] {
  const latest = new Map<string, (typeof atts)[number]>();
  for (const a of atts) {
    const k = String(a.hosted_run_id);
    if (!latest.has(k)) latest.set(k, a);
  }
  return runs.map((r) => {
    const a = latest.get(String(r.id));
    return {
      hosted_run_id: String(r.id),
      server: r.target,
      version: r.evidence?.resolvedVersion ?? "",
      grade: r.grade ?? "?",
      status: (a?.status ?? "none") as AdminRow["status"],
      attestation_uid: a?.attestation_uid ?? null,
      error: a?.error ?? null,
    };
  });
}

const TABLE = "grade_attestations";

/** Existing CONFIRMED attestation for a run, if any (idempotency guard). */
export async function findConfirmed(
  db: SupabaseClient,
  hostedRunId: string,
): Promise<AttestationRow | null> {
  const { data, error } = await db
    .from(TABLE)
    .select("*")
    .eq("hosted_run_id", hostedRunId)
    .eq("status", "confirmed")
    .limit(1)
    .maybeSingle();
  if (error) console.warn("[attestations] findConfirmed soft-failed:", error.message);
  return (data as AttestationRow | null) ?? null;
}

/** Most-recent confirmed attestation for a (server, version) pair. */
export async function findLatestConfirmedByServerVersion(
  db: SupabaseClient,
  server: string,
  version: string,
): Promise<AttestationRow | null> {
  const { data, error } = await db
    .from(TABLE)
    .select("*")
    .eq("server", server)
    .eq("version", version)
    .eq("status", "confirmed")
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (error) {
    console.warn("[attestations] findLatestConfirmedByServerVersion soft-failed:", error.message);
  }
  return (data as AttestationRow | null) ?? null;
}

export interface InsertPendingInput {
  hosted_run_id: string;
  server: string;
  version: string;
  grade: string;
  schema_uid: string;
  chain_id: number;
  evidence_hash: string;
}

/** Insert a pending row before sending the tx; returns its id. */
export async function insertPending(
  db: SupabaseClient,
  input: InsertPendingInput,
): Promise<number> {
  const { data, error } = await db
    .from(TABLE)
    .insert({ ...input, status: "pending" })
    .select("id")
    .single();
  if (error) throw new Error(`insertPending failed: ${error.message}`);
  return (data as { id: number }).id;
}

export async function markConfirmed(
  db: SupabaseClient,
  id: number,
  fields: { attestation_uid: string; tx_hash: string; attester_address: string },
): Promise<void> {
  const { error } = await db
    .from(TABLE)
    .update({ ...fields, status: "confirmed", confirmed_at: new Date().toISOString() })
    .eq("id", id);
  if (error) throw new Error(`markConfirmed failed: ${error.message}`);
}

export async function markFailed(db: SupabaseClient, id: number, message: string): Promise<void> {
  await db.from(TABLE).update({ status: "failed", error: message.slice(0, 1000) }).eq("id", id);
}

/** Published grades joined with their latest attestation status (admin list). */
export async function listPublishedWithStatus(db: SupabaseClient): Promise<AdminRow[]> {
  const { data: runs, error: runsErr } = await db
    .from("hosted_runs")
    .select("id, target, grade, evidence, published_at")
    .eq("status", "complete")
    .not("published_at", "is", null)
    .order("published_at", { ascending: false });
  if (runsErr) console.warn("[attestations] listPublishedWithStatus runs soft-failed:", runsErr.message);
  const { data: atts, error: attsErr } = await db
    .from(TABLE)
    .select("hosted_run_id, status, attestation_uid, error, created_at")
    .order("created_at", { ascending: false });
  if (attsErr) console.warn("[attestations] listPublishedWithStatus atts soft-failed:", attsErr.message);
  return joinRunsWithAttestations(
    (runs as RunLite[]) ?? [],
    (atts as AttestationRow[]) ?? [],
  );
}
