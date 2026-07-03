import "server-only";

/**
 * Shared decode + grade-fetch for the embeddable artifacts (the inline badge,
 * the card image, and the /mcp page). One place so all three agree on how a
 * server ref is parsed and which grade is shown.
 *
 * v1 is versionless: a pinned `@version` in the ref is canonicalized away and
 * the LATEST published grade is shown — matching `fetchPublishedGrade`, which
 * only returns `published_at IS NOT NULL` rows (so graded-but-unminted reads as
 * ungraded, same as /api/cli/check).
 */

import { ServerRefParseError, parseServerRef, serverKey } from "@/lib/identity";
import { getSupabaseAdmin } from "@/lib/supabase";
import {
  fetchPublishedGrade,
  fetchPublishedGradeRemote,
  type LitmusGrade,
  type PolygraphDetail,
} from "@/lib/hostedGrades";
import { isRemoteKey, refToPath } from "@/lib/serverRef";

// The pure path helpers live in the client-safe `serverRef` module; re-exported
// here so existing server-side importers keep their `@/lib/badgeData` import.
export { isRemoteKey, refToPath };

/**
 * Parse a server ref to its canonical key, or null if missing/too long/unparseable.
 * A registry ref → `{registry}/{owner}/{name}`. A remote https MCP endpoint → the
 * URL itself (trailing slash stripped), accepted either as a full URL (the badge
 * `?server=` value) or its path-safe form `https/host/path` (the `/mcp` catch-all).
 */
export function decodeRef(raw: string | null | undefined): string | null {
  if (!raw || raw.length === 0 || raw.length > 512) return null;
  const urlish = /^https?:\/\//.test(raw)
    ? raw
    : /^https?\//.test(raw)
      ? raw.replace(/^(https?)\//, "$1://")
      : null;
  if (urlish) {
    try {
      const u = new URL(urlish);
      if (u.protocol !== "https:" && u.protocol !== "http:") return null;
      const path = u.pathname === "/" ? "" : u.pathname.replace(/\/+$/, "");
      return `${u.protocol}//${u.host}${path}`;
    } catch {
      return null;
    }
  }
  try {
    return serverKey(parseServerRef(raw));
  } catch (err) {
    if (err instanceof ServerRefParseError) return null;
    throw err;
  }
}

/**
 * Latest published grade for a canonical key, or null. Branches registry vs
 * remote-endpoint. Also null when Supabase is unconfigured (local dev with no
 * env) — so every artifact degrades to its "unrated" state instead of throwing.
 */
export async function loadGrade(
  key: string,
): Promise<{ grade: LitmusGrade; detail: PolygraphDetail } | null> {
  const db = getSupabaseAdmin();
  if (!db) return null;
  return isRemoteKey(key) ? fetchPublishedGradeRemote(db, key) : fetchPublishedGrade(db, key);
}

/** A category counts as a passing tick only on an exact "pass" (skip/fail → not). */
export function categoryTick(status: string | null): boolean {
  return status === "pass";
}
