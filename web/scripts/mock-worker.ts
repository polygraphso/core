/**
 * Mock infra worker — exercises the hosted_runs contract end-to-end
 * before the real run-execution infra lands.
 *
 * Claims ONE queued run using the exact claim semantics the real worker
 * must use (single atomic claim; here via compare-and-set on status),
 * waits a few seconds to simulate the harness, and writes plausible
 * litmus results: remote_url targets get the honest B-cap shape,
 * registry_ref targets get a full-sandbox A.
 *
 * Usage (needs the service-role env, same as the web app):
 *   cd web && SUPABASE_URL=… SUPABASE_SERVICE_ROLE_KEY=… \
 *     npx tsx scripts/mock-worker.ts
 *
 * Pass --fail to simulate an execution failure instead, and --grade F
 * (or A/B/D) to force a specific grade.
 *
 * This script is also the executable spec for Ruben's worker: if the
 * real worker writes the same columns this writes, the web app needs
 * zero changes when it swaps in.
 */

import { createClient } from "@supabase/supabase-js";
import { createHash, randomUUID } from "node:crypto";

const url = process.env.SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!url || !key) {
  console.error("Set SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY.");
  process.exit(1);
}

const supabase = createClient(url, key, {
  auth: { persistSession: false, autoRefreshToken: false },
});

const argv = process.argv.slice(2);
const simulateFailure = argv.includes("--fail");
const forcedGrade = (() => {
  const i = argv.indexOf("--grade");
  if (i === -1) return null;
  const g = argv[i + 1]?.toUpperCase();
  return g === "A" || g === "B" || g === "D" || g === "F" ? g : null;
})();

async function main() {
  // Claim: oldest queued run. The real worker should use
  // `FOR UPDATE SKIP LOCKED` (see the migration header); for a mock with
  // a single instance, compare-and-set on status is equivalent enough.
  const { data: candidate, error: findError } = await supabase
    .from("hosted_runs")
    .select("id, target, target_kind")
    .eq("status", "queued")
    .order("paid_at", { ascending: true })
    .limit(1)
    .maybeSingle();

  if (findError) throw new Error(`queue scan failed: ${findError.message}`);
  if (!candidate) {
    console.log("No queued runs. (Submit + pay one first — mock mode works.)");
    return;
  }

  const { data: claimed, error: claimError } = await supabase
    .from("hosted_runs")
    .update({ status: "running", run_started_at: new Date().toISOString() })
    .eq("id", candidate.id)
    .eq("status", "queued")
    .select("id, target, target_kind")
    .maybeSingle();

  if (claimError) throw new Error(`claim failed: ${claimError.message}`);
  if (!claimed) {
    console.log("Run was claimed by someone else between scan and claim.");
    return;
  }

  console.log(`claimed ${claimed.id} → ${claimed.target} (${claimed.target_kind})`);
  console.log("simulating litmus run (8s)…");
  await new Promise((r) => setTimeout(r, 8_000));

  if (simulateFailure) {
    const { error } = await supabase
      .from("hosted_runs")
      .update({
        status: "failed",
        failure_reason: "mock worker: simulated harness failure (--fail)",
        completed_at: new Date().toISOString(),
      })
      .eq("id", claimed.id);
    if (error) throw new Error(`failure write failed: ${error.message}`);
    console.log("wrote status=failed");
    return;
  }

  const isRemote = claimed.target_kind === "remote_url";
  const grade = forcedGrade ?? (isRemote ? "B" : "A");
  const c02 = isRemote
    ? "skipped"
    : grade === "D"
      ? "fail"
      : "pass";
  const c01 = grade === "F" ? "fail" : "pass";
  const c03 = "pass";

  const fingerprint =
    "0x" +
    createHash("sha256").update(`mock:${claimed.target}`).digest("hex");

  const rationale =
    grade === "F"
      ? "Mock: instruction mimicry detected in a tool description — injection is disqualifying, grade floors at F."
      : grade === "D"
        ? "Mock: unexpected egress during a no-expected-egress run — caps at D."
        : isRemote
          ? "Mock: injection and canary checks pass; egress unverifiable on a remote target, capped at B by design."
          : "Mock: all three categories pass inside the sandbox.";

  const { error } = await supabase
    .from("hosted_runs")
    .update({
      status: "complete",
      grade,
      c01,
      c02,
      c03,
      tool_defs_fingerprint: fingerprint,
      methodology_version: "litmus-v2",
      rationale,
      evidence: {
        mock: true,
        run_id: randomUUID(),
        note: "Synthetic evidence from scripts/mock-worker.ts — replace with real bundles when the infra worker lands.",
      },
      ran_at: new Date().toISOString(),
      completed_at: new Date().toISOString(),
    })
    .eq("id", claimed.id);

  if (error) throw new Error(`result write failed: ${error.message}`);
  console.log(`wrote status=complete grade=${grade} fingerprint=${fingerprint.slice(0, 10)}…`);
}

main().catch((err) => {
  console.error(err instanceof Error ? err.message : err);
  process.exit(1);
});
