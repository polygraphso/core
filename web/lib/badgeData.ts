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
  type LitmusGrade,
  type PolygraphDetail,
} from "@/lib/hostedGrades";

/**
 * Parse a registry-prefixed ref to its canonical versionless key
 * (`{registry}/{owner}/{name}`), or null if it's missing/too long/unparseable.
 * Mirrors `resolveServerRef()` in app/notify/page.tsx.
 */
export function decodeRef(raw: string | null | undefined): string | null {
  if (!raw || raw.length === 0 || raw.length > 512) return null;
  try {
    return serverKey(parseServerRef(raw));
  } catch (err) {
    if (err instanceof ServerRefParseError) return null;
    throw err;
  }
}

/**
 * Latest published grade for a canonical key, or null. Also null when Supabase
 * is unconfigured (local dev with no env) — so every artifact degrades to its
 * "unrated" state instead of throwing.
 */
export async function loadGrade(
  key: string,
): Promise<{ grade: LitmusGrade; detail: PolygraphDetail } | null> {
  const db = getSupabaseAdmin();
  if (!db) return null;
  return fetchPublishedGrade(db, key);
}

/** A category counts as a passing tick only on an exact "pass" (skip/fail → not). */
export function categoryTick(status: string | null): boolean {
  return status === "pass";
}
