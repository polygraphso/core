import "server-only";
import { ServerRefParseError, parseServerRef, serverKey } from "@/lib/identity";
import { resolveLatestVersion } from "@/lib/registryVersion";
import { recordAgentCall } from "@/lib/agentIdentity";
import { fetchPublishedGrade, type LitmusGrade, type PolygraphDetail } from "@/lib/hostedGrades";
import type { LookupContext, LookupError } from "./types";

export interface CheckGraded {
  status: "graded";
  polygraph: LitmusGrade;
  /** `polygraph_detail.resolved_version` is the GRADED version. */
  polygraph_detail: PolygraphDetail;
  notify_url: string;
  /** The version in play — the installed/pinned version, else the registry's
   *  current latest. null when unresolved (github, registry failure). */
  current_version: string | null;
  /** true if the graded version is the current version; false if a different
   *  (older) graded version is shown as a freshness fallback; null when the
   *  current version couldn't be resolved. */
  version_match: boolean | null;
}

export interface CheckNotAvailable {
  status: "not_available";
  notify_url: string;
  message: string;
  self_grade: string;
}

export type CheckResult = CheckGraded | CheckNotAvailable | LookupError;

const NOTIFY_BASE = "https://polygraph.so/notify";

function notifyUrl(serverRef: string): string {
  // `/` and `@` are legal in query components (RFC 3986 §3.4) and the brief
  // mandates the unencoded form for readability. encodeURIComponent would
  // mangle them into %2F / %40.
  return `${NOTIFY_BASE}?for=${serverRef}`;
}

function selfGradeCommand(refKey: string): string {
  return `npx -y -p @polygraphso/litmus polygraphso-litmus litmus ${refKey}`;
}

/**
 * Grade lookup. Shared by POST /api/cli/check and the hosted MCP check_server
 * tool. Validates the ref, resolves the version in play, returns the published
 * grade (with a freshness fallback to the latest graded version) or a
 * not_available result, and bumps the usage/demand counters best-effort.
 */
export async function runCheck(serverRef: string, ctx: LookupContext): Promise<CheckResult> {
  if (serverRef.length === 0) {
    return { status: "error", code: 400, error: "server_ref is required." };
  }
  if (serverRef.length > 512) {
    return { status: "error", code: 400, error: "server_ref is too long." };
  }

  let parsed;
  try {
    parsed = parseServerRef(serverRef);
  } catch (err) {
    if (err instanceof ServerRefParseError) {
      return { status: "error", code: 400, error: err.message };
    }
    throw err;
  }

  // Versionless canonical key — keys the server identity and the demand counter.
  // A pinned @version narrows the grade lookup to that exact version; a bare ref
  // returns the latest graded version (the resolved version is in polygraph_detail).
  const refKey = serverKey(parsed);
  const { supabase } = ctx;

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

  // Usage counters: per-server hit/miss (bump_lookup) and per-agent activity
  // (record_agent_call). Both best-effort — never fail the lookup on a counter
  // error — and independent, so run them concurrently.
  await Promise.all([
    supabase
      .rpc("bump_lookup", { p_server_ref: refKey, p_hit: published !== null })
      .then(({ error }) => {
        if (error) console.error("[cli/check] bump_lookup failed:", error.message);
      }),
    recordAgentCall(supabase, ctx.identity, "check", published !== null),
  ]);

  if (!published) {
    // No grade for any version — bump demand, return the notify outlet.
    const { error: bumpErr } = await supabase.rpc("bump_untracked_demand", {
      p_server_ref: refKey,
    });
    if (bumpErr) {
      console.error("[cli/check] bump_untracked_demand failed:", bumpErr.message);
    }
    return {
      status: "not_available",
      notify_url: notifyUrl(refKey),
      message:
        `No published polygraph for ${refKey} yet — treat it as unevaluated ` +
        `(neither safe nor unsafe). To get it graded, call request_grade to add ` +
        `it to the public queue (free), or grade it yourself now with the ` +
        `self_grade command.`,
      self_grade: selfGradeCommand(refKey),
    };
  }

  return {
    status: "graded",
    polygraph: published.grade,
    polygraph_detail: published.detail,
    notify_url: notifyUrl(refKey),
    current_version: effectiveVersion ?? null,
    version_match: versionMatch,
  };
}
