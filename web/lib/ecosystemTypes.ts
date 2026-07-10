/**
 * Ecosystem row + shape types, in a client-safe module (NO `server-only`) so pure
 * helpers (lib/ecosystemTarget) and client components can import them without
 * pulling the service-role data layer into a bundle. The runtime reads live in
 * lib/ecosystemData (server-only); this file is types only.
 *
 * web/ is a standalone Vercel deploy target, so these mirror
 * packages/core/src/types.ts (the schema's source of truth) rather than import it.
 */

/**
 * The six ecosystems that predate the DB and keep a bespoke top-level page
 * (/base, /bankr, …). After Phase B they also live in the DB, so the generic
 * /ecosystems/[slug] page redirects these to their canonical top-level URL to
 * avoid duplicate content. New (self-serve) ecosystems render at /ecosystems/[slug].
 */
export const LEGACY_ECOSYSTEM_SLUGS = [
  "base",
  "bankr",
  "virtuals",
  "uniswap",
  "clawhub",
  "skills-sh",
] as const;

export function isLegacyEcosystemSlug(slug: string): boolean {
  return (LEGACY_ECOSYSTEM_SLUGS as readonly string[]).includes(slug);
}

export type EcosystemMemberRole = "admin" | "member";
export type EcosystemMemberStatus = "invited" | "active";
export type EcosystemEntryKind = "registry_ref" | "remote_url" | "skill";

/** Effective role on an ecosystem. 'app-admin' > 'admin' > 'member'. */
export type EcosystemRole = "app-admin" | "admin" | "member";

export interface EcosystemPageConfig {
  cohortOrder?: string[];
  cohortLabel?: Record<string, string>;
  methodologyLabel?: string;
  cta?: { heading: string; body: string; mailtoSubject: string };
  methodologyNote?: string;
  footer?: string;
}

export interface EcosystemEntryMetadata {
  name?: string;
  project?: string;
  handle?: string;
  category?: string;
  party?: "first" | "third";
  ownMcp?: boolean;
  mcpRef?: string | null;
  pending?: "free-key" | "api-key" | "clone-build" | null;
  note?: string;
  section?: string;
}

export interface EcosystemRow {
  id: string;
  slug: string;
  name: string;
  blurb: string | null;
  page_config: EcosystemPageConfig;
  is_public: boolean;
  is_listed: boolean;
  noindex: boolean;
  /** Monitoring price override in USD/month. null = app default; 0 = comped. */
  monthly_price_usd: number | null;
  created_by: string | null;
  created_at: string;
}

export interface EcosystemMemberRow {
  id: string;
  ecosystem_id: string;
  email: string;
  user_id: string | null;
  role: EcosystemMemberRole;
  status: EcosystemMemberStatus;
  invited_by: string | null;
  invited_at: string;
  joined_at: string | null;
}

export interface EcosystemEntryRow {
  id: string;
  ecosystem_id: string;
  target: string | null;
  target_kind: EcosystemEntryKind;
  cohort: string | null;
  visible: boolean;
  featured: boolean;
  position: number;
  metadata: EcosystemEntryMetadata;
  last_grade_run_id: string | null;
  last_grade_status: string | null;
  added_by: string | null;
  added_at: string;
}

// ── View models (serializable; passed from RSC → client components) ──────────

import type { FixItem } from "@/lib/remediation";

/** One category verdict for the compact dashboard/public check strip. */
export interface EcosystemEntryCheck {
  code: string; // C-01..C-04 or S-01/S-03/S-04
  status: string | null; // raw bundle status ("pass"|"fail"|"skipped — …"|null)
}

/**
 * The client-facing shape of one graded entry: the row plus its joined grade,
 * per-category checks, remediation fixes, and the canonical report path. Built
 * server-side (lib/ecosystemViewModel) so the dashboard's client components and
 * the public page render without touching the DB or the grade loaders.
 */
export interface EcosystemEntryVM {
  id: string;
  target: string | null;
  targetKind: EcosystemEntryKind;
  name: string;
  cohort: string | null;
  visible: boolean;
  featured: boolean;
  grade: string | null;
  checks: EcosystemEntryCheck[];
  completedAt: string | null;
  /** /mcp/<…> or /skill/<…> report path; null when ungradeable/unresolvable. */
  reportPath: string | null;
  /** Concrete changes that would raise the grade (empty for A / ungraded). */
  fixes: FixItem[];
  /** In-flight grade job status (last_grade_status), for the "grading…" state. */
  gradeStatus: string | null;
}
