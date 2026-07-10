import "server-only";

/**
 * Per-ecosystem authorization. proxy.ts only knows "is this a signed-in user"
 * and "is this a global app admin"; the finer question — is THIS user an admin or
 * member of THIS ecosystem — is answered here and enforced in every /manage page
 * and /api/manage route.
 *
 * Global app admins (session.isAdmin, from the JWT) are superusers over every
 * ecosystem: they resolve to role 'app-admin' without a member row. Everyone else
 * needs an active ecosystem_members row. Pending email invites are claimed lazily
 * (resolve_ecosystem_invites) so someone invited after they already signed up is
 * bound to their account the first time they open the dashboard.
 */

import { getSupabaseAdmin } from "@/lib/supabase";
import type { PolygraphSession } from "@/lib/session";
import {
  getEcosystemBySlug,
  type EcosystemRow,
  type EcosystemMemberRole,
} from "@/lib/ecosystemData";

/** Effective role. 'app-admin' > 'admin' > 'member'. */
export type EcosystemRole = "app-admin" | "admin" | "member";

export interface EcosystemAccess {
  ecosystem: EcosystemRow;
  role: EcosystemRole;
}

/** True for the roles allowed to manage members + settings. */
export function canManageEcosystem(role: EcosystemRole): boolean {
  return role === "app-admin" || role === "admin";
}

/**
 * Bind any pending (user_id null) invites for this account's email to the user.
 * Idempotent; safe to call on every dashboard load. No-op when unconfigured.
 */
export async function claimInvites(session: PolygraphSession): Promise<void> {
  const db = getSupabaseAdmin();
  if (!db || !session.email) return;
  await db.rpc("resolve_ecosystem_invites", {
    p_user: session.userId,
    p_email: session.email,
  });
}

async function activeMemberRole(
  ecosystemId: string,
  userId: string,
): Promise<EcosystemMemberRole | null> {
  const db = getSupabaseAdmin();
  if (!db) return null;
  const { data } = await db
    .from("ecosystem_members")
    .select("role")
    .eq("ecosystem_id", ecosystemId)
    .eq("user_id", userId)
    .eq("status", "active")
    .maybeSingle();
  return (data as { role: EcosystemMemberRole } | null)?.role ?? null;
}

/**
 * The caller's effective role on the ecosystem named by `slug`, or null when they
 * have no access (route → 403 / redirect). App admins short-circuit to 'app-admin'.
 * A non-member with a matching pending invite is claimed and re-checked once.
 */
export async function getEcosystemRole(
  session: PolygraphSession | null,
  slug: string,
): Promise<EcosystemAccess | null> {
  if (!session) return null;
  const ecosystem = await getEcosystemBySlug(slug);
  if (!ecosystem) return null;

  if (session.isAdmin) return { ecosystem, role: "app-admin" };

  let role = await activeMemberRole(ecosystem.id, session.userId);
  if (!role) {
    // Maybe invited by email before/after signup but never bound — claim + retry.
    await claimInvites(session);
    role = await activeMemberRole(ecosystem.id, session.userId);
  }
  if (!role) return null;
  return { ecosystem, role };
}

/**
 * The ecosystems this account may manage, with the effective role on each. App
 * admins get every ecosystem; everyone else gets the ones they actively belong to
 * (after claiming any pending invites). Powers the /manage landing.
 */
export async function listEcosystemsForUser(
  session: PolygraphSession,
): Promise<EcosystemAccess[]> {
  const db = getSupabaseAdmin();
  if (!db) return [];

  if (session.isAdmin) {
    const { data } = await db
      .from("ecosystems")
      .select("id, slug, name, blurb, page_config, is_public, is_listed, noindex, monthly_price_usd, created_by, created_at")
      .order("created_at", { ascending: true });
    return ((data as EcosystemRow[] | null) ?? []).map((ecosystem) => ({
      ecosystem,
      role: "app-admin" as const,
    }));
  }

  await claimInvites(session);
  const { data } = await db
    .from("ecosystem_members")
    .select("role, ecosystems(id, slug, name, blurb, page_config, is_public, is_listed, noindex, monthly_price_usd, created_by, created_at)")
    .eq("user_id", session.userId)
    .eq("status", "active");

  const rows = (data as Array<{ role: EcosystemMemberRole; ecosystems: EcosystemRow | null }> | null) ?? [];
  return rows
    .filter((r): r is { role: EcosystemMemberRole; ecosystems: EcosystemRow } => Boolean(r.ecosystems))
    .map((r) => ({ ecosystem: r.ecosystems, role: r.role }));
}
