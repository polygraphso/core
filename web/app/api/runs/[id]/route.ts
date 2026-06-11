/**
 * GET /api/runs/:id — public status/report for a hosted run.
 *
 * The shape is the report: status while in flight, full result (grade,
 * per-check outcomes, fingerprint, rationale) once complete. Includes the
 * payment instructions block while the run is unpaid so the /run/[id]
 * page can render the checkout step from this one endpoint.
 *
 * No email/user_id ever leaves this route; payment_tx does — the payment
 * disclosure is part of the report by design.
 */

import { NextResponse } from "next/server";
import {
  getRunsSupabase,
  paymentConfig,
  publicRun,
  RUN_SELECT_COLUMNS,
  type HostedRunRow,
} from "@/lib/runs";

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  if (!UUID_RE.test(id)) {
    return NextResponse.json(
      { ok: false, message: "Invalid run id." },
      { status: 400 },
    );
  }

  try {
    const supabase = getRunsSupabase();
    const { data, error } = await supabase
      .from("hosted_runs")
      .select(RUN_SELECT_COLUMNS)
      .eq("id", id)
      .maybeSingle();

    if (error) {
      console.error("[runs] lookup failed:", error.message);
      return NextResponse.json(
        { ok: false, message: "Lookup failed. Try again." },
        { status: 500 },
      );
    }
    if (!data) {
      return NextResponse.json(
        { ok: false, message: "Run not found." },
        { status: 404 },
      );
    }

    const row = data as HostedRunRow;
    const pay = paymentConfig();

    return NextResponse.json({
      ok: true,
      run: publicRun(row),
      payment:
        row.status === "created"
          ? {
              mode: pay.mode,
              treasury: pay.mode === "onchain" ? pay.treasury : null,
              price_units: pay.priceUnits?.toString() ?? null,
              price_display: pay.priceDisplay,
            }
          : null,
    });
  } catch (err) {
    console.error(
      "[runs] supabase init failed:",
      err instanceof Error ? err.message : String(err),
    );
    return NextResponse.json(
      { ok: false, message: "Lookup failed. Try again." },
      { status: 500 },
    );
  }
}
