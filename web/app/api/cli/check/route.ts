/**
 * POST /api/cli/check — CLI lookup endpoint.
 *
 * Anonymous; service-role DB access on the server side only. The CLI sends
 * a registry-prefixed server_ref; we look up the tracked server, return its
 * adoption tier (and a notify URL), or — on a miss — bump the
 * untracked_demand counter and return the notify URL.
 *
 * Contract: POST /api/cli/check in core-contracts.md.
 */

import { getSupabaseAdmin } from "@/lib/supabase";
import {
  ServerRefParseError,
  parseServerRef,
  serverKey,
  type AdoptionTier,
} from "@/lib/identity";
import {
  fetchPublishedGrade,
  type LitmusGrade,
  type PolygraphDetail,
} from "@/lib/hostedGrades";

interface CheckRequest {
  server_ref?: unknown;
}

interface TrackedResponse {
  status: "tracked";
  adoption_tier: AdoptionTier | null;
  polygraph: LitmusGrade | null;
  polygraph_detail: PolygraphDetail | null;
  notify_url: string;
}

interface NotAvailableResponse {
  status: "not_available";
  notify_url: string;
}

const NOTIFY_BASE = "https://polygraph.so/notify";

function notifyUrl(serverRef: string): string {
  // `/` and `@` are legal in query components (RFC 3986 §3.4) and the brief
  // mandates the unencoded form for readability. encodeURIComponent would
  // mangle them into %2F / %40.
  return `${NOTIFY_BASE}?for=${serverRef}`;
}

export async function POST(request: Request) {
  let body: CheckRequest;
  try {
    body = (await request.json()) as CheckRequest;
  } catch {
    return Response.json(
      { error: "Invalid JSON body." },
      { status: 400 },
    );
  }

  if (typeof body.server_ref !== "string" || body.server_ref.length === 0) {
    return Response.json(
      { error: "server_ref is required." },
      { status: 400 },
    );
  }
  if (body.server_ref.length > 512) {
    return Response.json(
      { error: "server_ref is too long." },
      { status: 400 },
    );
  }

  let parsed;
  try {
    parsed = parseServerRef(body.server_ref);
  } catch (err) {
    if (err instanceof ServerRefParseError) {
      return Response.json({ error: err.message }, { status: 400 });
    }
    throw err;
  }

  // Canonical key used for both server lookup and the untracked_demand
  // counter — versionless so two CLI calls for v1.0.0 and v1.0.1 of the
  // same package both register against the same ref.
  const refKey = serverKey(parsed);
  const supabase = getSupabaseAdmin();
  if (!supabase) {
    console.error("[cli/check] Supabase is not configured");
    return Response.json({ error: "Lookup failed." }, { status: 500 });
  }

  // Server lookup. `nulls not distinct` on the unique constraint means
  // unscoped npm rows (owner is NULL) are addressable via `owner.is.null`,
  // not `owner.eq.`.
  let query = supabase
    .from("servers")
    .select("id, latest_version_id")
    .eq("registry", parsed.registry)
    .eq("name", parsed.name);
  query = parsed.owner === null ? query.is("owner", null) : query.eq("owner", parsed.owner);

  const { data: server, error: serverErr } = await query.maybeSingle();
  if (serverErr) {
    console.error("[cli/check] server lookup failed:", serverErr.message);
    return Response.json({ error: "Lookup failed." }, { status: 500 });
  }

  if (!server) {
    // Untracked — bump the counter and return the notify URL.
    const { error: bumpErr } = await supabase.rpc("bump_untracked_demand", {
      p_server_ref: refKey,
    });
    if (bumpErr) {
      // Don't 500 the CLI on a counter failure — the user still needs the
      // notify URL. Log and continue.
      console.error("[cli/check] bump_untracked_demand failed:", bumpErr.message);
    }
    const body: NotAvailableResponse = {
      status: "not_available",
      notify_url: notifyUrl(refKey),
    };
    return Response.json(body);
  }

  // Tracked. Pull the latest adoption_scores row (one per scoring run; the
  // most recent computed_at wins).
  let tier: AdoptionTier | null = null;
  if (server.latest_version_id) {
    const { data: score, error: scoreErr } = await supabase
      .from("adoption_scores")
      .select("tier")
      .eq("version_id", server.latest_version_id)
      .order("computed_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    if (scoreErr) {
      console.error("[cli/check] adoption_scores lookup failed:", scoreErr.message);
      return Response.json({ error: "Lookup failed." }, { status: 500 });
    }
    if (score && (score.tier === "top10" || score.tier === "top25" || score.tier === "top50" || score.tier === "top100")) {
      tier = score.tier as AdoptionTier;
    }
  }

  // Latest published grade from hosted_runs (same source the website
  // reads). Null until a registry run for this ref is published.
  const published = await fetchPublishedGrade(supabase, refKey);

  const body2: TrackedResponse = {
    status: "tracked",
    adoption_tier: tier,
    polygraph: published?.grade ?? null,
    polygraph_detail: published?.detail ?? null,
    notify_url: notifyUrl(refKey),
  };
  return Response.json(body2);
}
