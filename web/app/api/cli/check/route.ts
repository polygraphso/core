/**
 * POST /api/cli/check — grade lookup.
 *
 * Anonymous; service-role DB access on the server side only. The CLI sends
 * a registry-prefixed server_ref; we return its published polygraph grade
 * from hosted_runs (the same source the website reads), or — when there's
 * no published grade — bump the demand counter and return a notify URL.
 *
 * Grade-only: adoption tier / the `servers` catalog are not part of this
 * surface anymore. A server either has a published grade or it doesn't.
 */

import { getSupabaseAdmin } from "@/lib/supabase";
import { ServerRefParseError, parseServerRef, serverKey } from "@/lib/identity";
import { enforceRateLimit } from "@/lib/rateLimit";
import { resolveLatestVersion } from "@/lib/registryVersion";
import {
  fetchPublishedGrade,
  type LitmusGrade,
  type PolygraphDetail,
} from "@/lib/hostedGrades";

interface CheckRequest {
  server_ref?: unknown;
}

interface GradedResponse {
  status: "graded";
  polygraph: LitmusGrade;
  /** `polygraph_detail.resolved_version` is the GRADED version. */
  polygraph_detail: PolygraphDetail;
  notify_url: string;
  /** The version in play — the installed/pinned version, else the registry's
   *  current latest. null when unresolved (github, registry failure). */
  current_version: string | null;
  /** true if the graded version is the current version; false if a different
   *  (older) graded version is being shown as a freshness fallback; null when
   *  the current version couldn't be resolved. */
  version_match: boolean | null;
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
  // Higher ceiling than the email routes: legitimate CLI usage checks many refs.
  const limited = await enforceRateLimit(request, "cli-check", { max: 60, windowSeconds: 60 });
  if (limited) return limited;

  let body: CheckRequest;
  try {
    body = (await request.json()) as CheckRequest;
  } catch {
    return Response.json({ error: "Invalid JSON body." }, { status: 400 });
  }

  if (typeof body.server_ref !== "string" || body.server_ref.length === 0) {
    return Response.json({ error: "server_ref is required." }, { status: 400 });
  }
  if (body.server_ref.length > 512) {
    return Response.json({ error: "server_ref is too long." }, { status: 400 });
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

  // Versionless canonical key — keys the server identity and the demand counter.
  // A pinned @version narrows the grade lookup to that exact version; a bare ref
  // returns the latest graded version (the resolved version is in polygraph_detail).
  const refKey = serverKey(parsed);
  const supabase = getSupabaseAdmin();
  if (!supabase) {
    console.error("[cli/check] Supabase is not configured");
    return Response.json({ error: "Lookup failed." }, { status: 500 });
  }

  // Effective version = the version in play: a pinned ref is exact; a bare ref
  // resolves the registry's current latest (the version a consumer would install
  // today). null when unresolved (github, registry hiccup) → server falls back.
  const effectiveVersion = parsed.version ?? (await resolveLatestVersion(parsed));

  // Look up the grade for that exact version first.
  let published = effectiveVersion
    ? await fetchPublishedGrade(supabase, refKey, effectiveVersion)
    : null;
  let versionMatch: boolean | null = published ? true : null;

  // Freshness fallback: the version in play isn't graded yet → show the latest
  // graded version (any), flagged so the caller sees it's a different version
  // rather than a silent stale grade.
  if (!published) {
    const fallback = await fetchPublishedGrade(supabase, refKey, null);
    if (fallback) {
      published = fallback;
      versionMatch =
        effectiveVersion != null && fallback.detail.resolved_version != null
          ? fallback.detail.resolved_version === effectiveVersion
          : null;
    }
  }

  if (!published) {
    // No grade for any version — bump demand, return the notify outlet.
    const { error: bumpErr } = await supabase.rpc("bump_untracked_demand", {
      p_server_ref: refKey,
    });
    if (bumpErr) {
      // Don't 500 the CLI on a counter failure — the user still needs the
      // notify URL. Log and continue.
      console.error("[cli/check] bump_untracked_demand failed:", bumpErr.message);
    }
    const miss: NotAvailableResponse = {
      status: "not_available",
      notify_url: notifyUrl(refKey),
    };
    return Response.json(miss);
  }

  const graded: GradedResponse = {
    status: "graded",
    polygraph: published.grade,
    polygraph_detail: published.detail,
    notify_url: notifyUrl(refKey),
    current_version: effectiveVersion ?? null,
    version_match: versionMatch,
  };
  return Response.json(graded);
}
