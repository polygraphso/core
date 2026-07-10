import "server-only";

/**
 * DB read layer for the ecosystem management dashboard and the DB-backed public
 * pages. Ecosystems, their members, and their entries live in three tables
 * (migration 20260713120000_ecosystems); this module reads them with the
 * service-role client and joins each entry to its LIVE grade from hosted_runs —
 * the same grade-only read the array-backed loaders use (latestForTarget /
 * loadSkillGrade). A grade is never stored on an entry; it is always joined.
 *
 * web/ is a standalone Vercel deploy target, so the row types are declared here
 * (mirroring packages/core/src/types.ts, the schema's source of truth) rather
 * than imported from @polygraph/core.
 */

import { getSupabaseAdmin } from "@/lib/supabase";
import {
  latestForTarget,
  type LitmusGrade,
  type PolygraphDetail,
} from "@/lib/hostedGrades";
import { loadSkillGrade, type SkillDetail, type SkillLitmusGrade } from "@/lib/skillGrades";
import type {
  EcosystemRow,
  EcosystemMemberRow,
  EcosystemEntryRow,
} from "@/lib/ecosystemTypes";

// Row + shape types live in the client-safe lib/ecosystemTypes; re-exported here
// so server callers can keep importing them from the data layer.
export type {
  EcosystemMemberRole,
  EcosystemMemberStatus,
  EcosystemEntryKind,
  EcosystemRole,
  EcosystemPageConfig,
  EcosystemEntryMetadata,
  EcosystemRow,
  EcosystemMemberRow,
  EcosystemEntryRow,
} from "@/lib/ecosystemTypes";

const ECOSYSTEM_COLUMNS =
  "id, slug, name, blurb, page_config, is_public, is_listed, noindex, monthly_price_usd, created_by, created_at";
const ENTRY_COLUMNS =
  "id, ecosystem_id, target, target_kind, cohort, visible, featured, position, metadata, last_grade_run_id, last_grade_status, added_by, added_at";
const MEMBER_COLUMNS =
  "id, ecosystem_id, email, user_id, role, status, invited_by, invited_at, joined_at";

// ── Reads ────────────────────────────────────────────────────────────────────

export async function getEcosystemBySlug(slug: string): Promise<EcosystemRow | null> {
  const db = getSupabaseAdmin();
  if (!db) return null;
  const { data } = await db
    .from("ecosystems")
    .select(ECOSYSTEM_COLUMNS)
    .eq("slug", slug)
    .maybeSingle();
  return (data as EcosystemRow | null) ?? null;
}

export async function getEcosystemById(id: string): Promise<EcosystemRow | null> {
  const db = getSupabaseAdmin();
  if (!db) return null;
  const { data } = await db
    .from("ecosystems")
    .select(ECOSYSTEM_COLUMNS)
    .eq("id", id)
    .maybeSingle();
  return (data as EcosystemRow | null) ?? null;
}

/** All ecosystems, newest first. `listedOnly` limits to the /ecosystems hub set. */
export async function listEcosystems(opts: { listedOnly?: boolean } = {}): Promise<EcosystemRow[]> {
  const db = getSupabaseAdmin();
  if (!db) return [];
  let q = db.from("ecosystems").select(ECOSYSTEM_COLUMNS);
  if (opts.listedOnly) q = q.eq("is_listed", true).eq("is_public", true);
  const { data } = await q.order("created_at", { ascending: true });
  return (data as EcosystemRow[] | null) ?? [];
}

/**
 * Entries for an ecosystem BY SLUG, or null when the ecosystem row does not exist
 * yet (i.e. unseeded). The legacy loaders use `null` as the signal to fall back to
 * their hardcoded array; a seeded ecosystem returns its rows even if empty (the DB
 * is then authoritative, so a member who removed every entry sees an empty page).
 */
export async function loadEntriesForEcosystem(slug: string): Promise<EcosystemEntryRow[] | null> {
  const ecosystem = await getEcosystemBySlug(slug);
  if (!ecosystem) return null;
  return listEntries(ecosystem.id);
}

export async function listEntries(ecosystemId: string): Promise<EcosystemEntryRow[]> {
  const db = getSupabaseAdmin();
  if (!db) return [];
  const { data } = await db
    .from("ecosystem_entries")
    .select(ENTRY_COLUMNS)
    .eq("ecosystem_id", ecosystemId)
    .order("position", { ascending: true })
    .order("added_at", { ascending: true });
  return (data as EcosystemEntryRow[] | null) ?? [];
}

export async function listMembers(ecosystemId: string): Promise<EcosystemMemberRow[]> {
  const db = getSupabaseAdmin();
  if (!db) return [];
  const { data } = await db
    .from("ecosystem_members")
    .select(MEMBER_COLUMNS)
    .eq("ecosystem_id", ecosystemId)
    .order("invited_at", { ascending: true });
  return (data as EcosystemMemberRow[] | null) ?? [];
}

// ── Graded entries (entry joined to its live grade) ──────────────────────────

/**
 * An entry with its live grade. Exactly one of `mcpDetail` / `skillDetail` is set
 * once graded (by `target_kind`); both null while ungraded. `grade` is the letter
 * (A–F for MCP, A/B/D/F for skills). The dashboard turns the detail into fixes
 * (remediation.ts); the public page reads the per-category checks from it.
 */
export interface GradedEcosystemEntry {
  entry: EcosystemEntryRow;
  grade: LitmusGrade | SkillLitmusGrade | null;
  mcpDetail: PolygraphDetail | null;
  skillDetail: SkillDetail | null;
  completedAt: string | null;
}

async function gradeForEntry(entry: EcosystemEntryRow): Promise<GradedEcosystemEntry> {
  const db = getSupabaseAdmin();
  const base: GradedEcosystemEntry = {
    entry,
    grade: null,
    mcpDetail: null,
    skillDetail: null,
    completedAt: null,
  };
  if (!db || !entry.target) return base;

  if (entry.target_kind === "skill") {
    const g = await loadSkillGrade(db, entry.target);
    if (!g) return base;
    return { ...base, grade: g.grade, skillDetail: g.detail, completedAt: g.detail.computed_at };
  }

  const g = await latestForTarget(db, entry.target);
  if (!g) return base;
  return { ...base, grade: g.grade, mcpDetail: g.detail, completedAt: g.completedAt };
}

/**
 * Load every entry (optionally only visible ones) joined to its live grade. The
 * per-entry grade lookups are independent, so they run concurrently — the same
 * fan-out loadBaseIndex does, keeping a ~50-member ecosystem to one round-trip
 * wide rather than a serial chain.
 */
export async function loadGradedEntries(
  ecosystemId: string,
  opts: { visibleOnly?: boolean } = {},
): Promise<GradedEcosystemEntry[]> {
  const entries = await listEntries(ecosystemId);
  const scoped = opts.visibleOnly ? entries.filter((e) => e.visible) : entries;
  return Promise.all(scoped.map(gradeForEntry));
}
