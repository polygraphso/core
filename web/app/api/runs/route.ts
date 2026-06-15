/**
 * POST /api/runs — create a hosted litmus run request.
 *
 * Body: { target: string, email: string }
 *   target = registry ref (npm/… | pypi/… | github/…) or https:// MCP URL
 *
 * Returns { ok, run: {...public shape}, payment: { mode, treasury?,
 * price_units?, price_display? } }. The run starts in status 'created';
 * payment (POST /api/runs/:id/pay) moves it to 'queued'.
 *
 * Contract: hosted-service-brief.md. Light accounts land later; today the
 * requester is always identified by email.
 */

import { NextResponse } from "next/server";
import { ServerRefParseError, parseServerRef, serverKey } from "@/lib/identity";
import {
  getRunsSupabase,
  paymentConfig,
  publicRun,
  RUN_SELECT_COLUMNS,
  type HostedRunRow,
} from "@/lib/runs";

const EMAIL_MAX_LEN = 254;
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;
const TARGET_MAX_LEN = 512;

function parseTarget(
  raw: string,
): { target: string; kind: "registry_ref" | "remote_url" } | { error: string } {
  if (raw.startsWith("https://")) {
    try {
      const url = new URL(raw);
      if (url.protocol !== "https:") throw new Error("not https");
      return { target: url.toString(), kind: "remote_url" };
    } catch {
      return { error: "Enter a valid https:// MCP URL." };
    }
  }
  try {
    return { target: serverKey(parseServerRef(raw)), kind: "registry_ref" };
  } catch (err) {
    if (err instanceof ServerRefParseError) {
      return {
        error:
          "Enter a registry ref (npm/…, pypi/…, github/owner/repo) or an https:// MCP URL.",
      };
    }
    throw err;
  }
}

export async function POST(request: Request) {
  let payload: unknown;
  try {
    payload = await request.json();
  } catch {
    return NextResponse.json(
      { ok: false, message: "Invalid JSON body." },
      { status: 400 },
    );
  }

  const { target, email } = (payload ?? {}) as {
    target?: unknown;
    email?: unknown;
  };

  if (typeof target !== "string" || target.trim().length === 0) {
    return NextResponse.json(
      { ok: false, message: "target is required." },
      { status: 400 },
    );
  }
  if (target.length > TARGET_MAX_LEN) {
    return NextResponse.json(
      { ok: false, message: `target is too long (${TARGET_MAX_LEN} max).` },
      { status: 400 },
    );
  }

  const parsed = parseTarget(target.trim());
  if ("error" in parsed) {
    return NextResponse.json(
      { ok: false, message: parsed.error },
      { status: 400 },
    );
  }

  const normalizedEmail =
    typeof email === "string" ? email.trim().toLowerCase() : "";
  if (
    normalizedEmail.length === 0 ||
    normalizedEmail.length > EMAIL_MAX_LEN ||
    !EMAIL_RE.test(normalizedEmail)
  ) {
    return NextResponse.json(
      { ok: false, message: "Enter a valid email address." },
      { status: 400 },
    );
  }

  const pay = paymentConfig();

  try {
    const supabase = getRunsSupabase();
    const { data, error } = await supabase
      .from("hosted_runs")
      .insert({
        target: parsed.target,
        target_kind: parsed.kind,
        email: normalizedEmail,
        price_usdc: pay.priceUnits !== null ? pay.priceUnits.toString() : null,
      })
      .select(RUN_SELECT_COLUMNS)
      .single();

    if (error || !data) {
      console.error("[runs] insert failed:", error?.message);
      return NextResponse.json(
        {
          ok: false,
          message:
            "Couldn't create the run. Try again or email hello@polygraph.so.",
        },
        { status: 500 },
      );
    }

    return NextResponse.json({
      ok: true,
      run: publicRun(data as HostedRunRow),
      payment: {
        mode: pay.mode,
        treasury: pay.mode === "onchain" ? pay.treasury : null,
        price_units: pay.priceUnits?.toString() ?? null,
        price_display: pay.priceDisplay,
      },
    });
  } catch (err) {
    console.error(
      "[runs] supabase init failed:",
      err instanceof Error ? err.message : String(err),
    );
    return NextResponse.json(
      {
        ok: false,
        message:
          "Couldn't create the run. Try again or email hello@polygraph.so.",
      },
      { status: 500 },
    );
  }
}
