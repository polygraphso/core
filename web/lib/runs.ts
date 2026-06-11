/**
 * Hosted litmus runs — shared config, types, and shaping.
 *
 * The hosted_runs table is the web ↔ infra contract; see
 * packages/core/supabase/migrations/20260611200000_hosted_runs.sql and
 * hosted-service-brief.md (strategy folder). Web owns: create → verify
 * payment → queue. The infra worker owns: claim → run litmus-v1 → write
 * results.
 *
 * Independence rule, enforced by what's NOT here: there is no API to
 * change a grade, suppress a result, or refund a failing run. Payment
 * buys the run, never the grade.
 */

import { createClient } from "@supabase/supabase-js";

export const USDC_BASE_CONTRACT =
  "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913";
export const DEFAULT_BASE_RPC = "https://mainnet.base.org";
export const MIN_CONFIRMATIONS = 3;

export type PaymentMode = "onchain" | "mock" | "disabled";

export function paymentConfig(): {
  mode: PaymentMode;
  treasury: string | null;
  priceUnits: bigint | null; // USDC 6-decimal units
  priceDisplay: string | null; // "49 USDC"
  rpcUrl: string;
} {
  const rawMode = process.env.PAYMENT_MODE;
  const treasury = process.env.TREASURY_ADDRESS ?? null;
  const priceWhole = process.env.RUN_PRICE_USDC ?? null;

  const priceUnits =
    priceWhole && /^\d+$/.test(priceWhole)
      ? BigInt(priceWhole) * BigInt(1_000_000)
      : null;

  // onchain mode is only valid when fully configured; anything else
  // degrades to disabled rather than half-working.
  let mode: PaymentMode = "disabled";
  if (rawMode === "mock") mode = "mock";
  if (rawMode === "onchain" && treasury && priceUnits !== null)
    mode = "onchain";

  return {
    mode,
    treasury,
    priceUnits,
    priceDisplay: priceWhole ? `${priceWhole} USDC` : null,
    rpcUrl: process.env.BASE_RPC_URL ?? DEFAULT_BASE_RPC,
  };
}

export function getRunsSupabase() {
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) {
    throw new Error(
      "SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY must be set on the server.",
    );
  }
  return createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

export type RunStatus =
  | "created"
  | "paid"
  | "queued"
  | "running"
  | "complete"
  | "failed";

export interface HostedRunRow {
  id: string;
  target: string;
  target_kind: "registry_ref" | "remote_url";
  status: RunStatus;
  created_at: string;
  paid_at: string | null;
  payment_tx: string | null;
  grade: "A" | "B" | "D" | "F" | null;
  c01: string | null;
  c02: string | null;
  c03: string | null;
  tool_defs_fingerprint: string | null;
  methodology_version: string | null;
  rationale: string | null;
  failure_reason: string | null;
  ran_at: string | null;
  completed_at: string | null;
}

/** Public report shape — never includes email/user_id. payment_tx is
 *  included deliberately: the payment disclosure is part of the report. */
export function publicRun(row: HostedRunRow) {
  return {
    id: row.id,
    target: row.target,
    target_kind: row.target_kind,
    status: row.status,
    created_at: row.created_at,
    paid_at: row.paid_at,
    payment_tx: row.payment_tx,
    grade: row.grade,
    c01: row.c01,
    c02: row.c02,
    c03: row.c03,
    tool_defs_fingerprint: row.tool_defs_fingerprint,
    methodology_version: row.methodology_version,
    rationale: row.rationale,
    failure_reason: row.failure_reason,
    ran_at: row.ran_at,
    completed_at: row.completed_at,
  };
}

export const RUN_SELECT_COLUMNS =
  "id, target, target_kind, status, created_at, paid_at, payment_tx, grade, c01, c02, c03, tool_defs_fingerprint, methodology_version, rationale, failure_reason, ran_at, completed_at";
