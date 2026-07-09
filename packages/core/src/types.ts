/**
 * Row types for the foundational polygraph tables.
 *
 * Snake_case mirrors the Postgres columns and what `supabase-js` returns from
 * `.from(table).select()`. Downstream callers can convert to camelCase if they
 * prefer; the agreement at the contract layer is snake_case.
 *
 * Source of truth: packages/core/supabase/migrations/.
 */

export type Registry = "npm" | "pypi" | "github";

export type AdoptionTier = "top10" | "top25" | "top50" | "top100";

export type RunKind = "scoring" | "litmus";

export type RunStatus = "queued" | "running" | "completed" | "failed";

export interface ServerRow {
  id: string;
  registry: Registry;
  /** Null only for unscoped npm packages. */
  owner: string | null;
  name: string;
  first_seen: string;
  last_seen: string;
  latest_version_id: string | null;
}

export interface VersionRow {
  id: string;
  server_id: string;
  version: string;
  published_at: string | null;
  manifest_url: string | null;
  source_url: string | null;
  detected_at: string;
}

/**
 * Sources for cross-registry identity stitching. `npm`/`pypi`/`github` mirror
 * the primary registries already on `servers`; the others are additional
 * marketplaces / aggregators that use their own naming scheme.
 */
export type IdentitySource =
  | "npm"
  | "pypi"
  | "github"
  | "smithery"
  | "glama"
  | "mcp_registry";

export interface ServerIdentityRow {
  id: string;
  server_id: string;
  source: IdentitySource;
  identity: string;
  source_url: string | null;
  added_at: string;
}

/**
 * Directory providers feeding the thin discovery catalog (catalog_listings).
 * A subset of `IdentitySource` — only the aggregators we enumerate wholesale to
 * discover servers, not the primary package registries. Extensible: adding a
 * provider is a new string here plus a `ProviderAdapter` in scoring.
 */
export type CatalogProvider = "glama" | "smithery" | "mcp_registry";

/**
 * A canonical MCP server in the discovery catalog — one row per real server,
 * deduped across providers. Mirrors the `catalog_servers` table. This is the
 * coverage map (what exists / have we graded it), decoupled from the curated,
 * enriched `servers` table.
 */
export interface CatalogServerRow {
  id: string;
  /** Normalized repo URL, else '<provider>:<provider_uid>'. Unique. */
  canonical_key: string;
  name: string | null;
  repository_url: string | null;
  /**
   * Three-state, set by resolution (not the old coarse heuristic):
   * null = not yet attempted · true = resolved to a runnable target · false =
   * attempted, nothing runnable found.
   */
  gradeable: boolean | null;
  /** Runnable ref once resolved: 'npm/<pkg>' | 'pypi/<pkg>' | 'https://…'. */
  grading_target: string | null;
  grading_kind: CatalogGradingKind | null;
  resolution_status: CatalogResolutionStatus | null;
  resolution_checked_at: string | null;
  resolution_attempts: number;
  first_seen_at: string;
  last_seen_at: string;
}

/** How a resolved server is launched/reached by the harness. */
export type CatalogGradingKind = "npm" | "pypi" | "url";

/**
 * Outcome of a resolution attempt. null = never attempted · 'resolved' = a
 * grading_target was found · 'unresolved' = checked, nothing runnable ·
 * 'error' = the check itself failed (retried next run).
 */
export type CatalogResolutionStatus = "resolved" | "unresolved" | "error";

/**
 * One per-provider listing of a catalog server. Mirrors the `catalog_listings`
 * table. Many listings → one `catalog_servers` row (same MCP on Glama and
 * Smithery). Keyed on `(provider, provider_uid)`.
 */
export interface CatalogListingRow {
  id: string;
  catalog_server_id: string;
  provider: CatalogProvider;
  provider_uid: string;
  namespace: string | null;
  slug: string | null;
  name: string | null;
  url: string | null;
  attributes: string[];
  /** Provider creation time; page-granular for Glama (see migration). */
  provider_created_at: string | null;
  first_synced_at: string;
  last_synced_at: string;
}

/**
 * Component breakdown captured alongside the score. Each property is optional;
 * shape evolves as adapters land. Numbers are pre-normalization signal values
 * so debugging stays grounded ("npm dropped from 1M → 200k weekly downloads").
 */
export interface AdoptionComponents {
  npm_downloads_last_month?: number | null;
  npm_weekly_downloads?: number[] | null;
  npm_last_publish_date?: string | null;
  pypi_downloads_last_month?: number | null;
  pypi_weekly_downloads?: number[] | null;
  pypi_last_release_date?: string | null;
  gh_stars?: number | null;
  gh_forks?: number | null;
  gh_contributors?: number | null;
  gh_pr_count_open?: number | null;
  gh_pr_count_closed?: number | null;
  gh_last_push_at?: string | null;
  openssf_aggregate?: number | null;
  glama_security_grade?: string | null;
  glama_quality_grade?: string | null;
  glama_license_grade?: string | null;
  smithery_use_count?: number | null;
  smithery_verified?: boolean | null;
  depsdev_dependents_count?: number | null;
  depsdev_advisory_count?: number | null;
  sources_used?: string[] | null;
  [key: string]: unknown;
}

export interface AdoptionScoreRow {
  id: string;
  version_id: string;
  score: string; // numeric in Postgres arrives as string via supabase-js
  tier: AdoptionTier | null;
  components: AdoptionComponents;
  computed_at: string;
}

export interface RunRow {
  id: string;
  version_id: string;
  kind: RunKind;
  status: RunStatus;
  started_at: string | null;
  finished_at: string | null;
  log_url: string | null;
  error: Record<string, unknown> | null;
}

/**
 * Per-monitor alert threshold. NULL means "every regrade" (an email on every
 * new published grade — the default). Otherwise the engine only emails when the
 * new grade is at or below this letter on the A>B>C>D>F scale. No 'B' option by
 * design; grades are A,B,C,D,F (no 'E').
 */
export type AlertMinGrade = "C" | "D" | "F" | null;

/**
 * A new-version regrade subscription. Mirrors the `monitors` table. Exactly one
 * of `email` / `user_id` is set (the XOR constraint). `last_notified_run_id` is
 * the dedup watermark — the hosted_runs.id of the published grade last sent to
 * this watcher; the other `last_notified_*` fields are display/audit only.
 */
export interface MonitorRow {
  id: string;
  target: string;
  target_kind: "registry_ref" | "skill";
  email: string | null;
  user_id: string | null;
  unsubscribe_token: string;
  unsubscribed_at: string | null;
  created_at: string;
  last_notified_run_id: string | null;
  last_notified_version: string | null;
  last_notified_grade: string | null;
  last_notified_at: string | null;
  alert_min_grade: AlertMinGrade;
}

export type AlertDeliveryStatus = "pending" | "sent" | "failed";

/**
 * One alert email attempt. Mirrors the `alert_deliveries` table. The
 * `(monitor_id, hosted_run_id)` unique constraint is the double-email defense:
 * the reconcile pass claims a delivery here before sending.
 */
export interface AlertDeliveryRow {
  id: string;
  monitor_id: string;
  hosted_run_id: string;
  target: string;
  version: string | null;
  grade: string | null;
  email: string;
  status: AlertDeliveryStatus;
  resend_message_id: string | null;
  error: string | null;
  created_at: string;
  sent_at: string | null;
}

// ── Twitter threads ──────────────────────────────────────────────────────────

export type TwitterThreadStatus = "draft" | "scheduled" | "posted";

/**
 * Which X account a thread is posted from. 'product' = @polygraphso (the
 * record: grades, index deltas, releases, methodology); 'personal' = the
 * founder account (voice: commentary, quote-tweets).
 */
export type TwitterAccount = "personal" | "product";

/**
 * One tweet in a thread, in order. Char counts are computed in the UI.
 * `url` is the X permalink once the tweet is live; `posted` marks it live.
 */
export interface TwitterThreadTweet {
  text: string;
  url?: string | null;
  posted?: boolean;
}

/**
 * A launch/announcement thread, editable from Admin › Twitter. Mirrors the
 * `twitter_threads` table. `tweets` is an ordered array; a thread is always
 * read and saved as a whole.
 */
export interface TwitterThreadRow {
  id: string;
  slug: string;
  title: string;
  status: TwitterThreadStatus;
  account: TwitterAccount;
  scheduled_at: string | null;
  posted_at: string | null;
  tweets: TwitterThreadTweet[];
  /** Permalink of the thread's main (root) tweet — the whole-thread share link. */
  main_url: string | null;
  alt_text: string | null;
  /** Human filename label for the showcase image (e.g. "showcase.png"). */
  image_ref: string | null;
  /** Public URL of the showcase image in the `twitter-images` Storage bucket. */
  image_url: string | null;
  sources: string | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
}

// ── Ecosystems ───────────────────────────────────────────────────────────────

export type EcosystemMemberRole = "admin" | "member";
export type EcosystemMemberStatus = "invited" | "active";
export type EcosystemEntryKind = "registry_ref" | "remote_url" | "skill";

/**
 * Editorial + presentation for an ecosystem's public page, carried in
 * `ecosystems.page_config` (jsonb). The DB twin of the code-side
 * SkillEcosystemConfig: `footer`/`methodologyNote` are plain strings here (the
 * generic renderer wraps them), not ReactNode. All optional so a brand-new
 * ecosystem renders with sensible defaults before it is configured.
 */
export interface EcosystemPageConfig {
  /** Cohort keys in display order (must match entries' `cohort`). */
  cohortOrder?: string[];
  /** Cohort key → section heading. */
  cohortLabel?: Record<string, string>;
  /** Methodology tag for the private banner (e.g. "litmus-v14", "litmus-skill-v3"). */
  methodologyLabel?: string;
  cta?: { heading: string; body: string; mailtoSubject: string };
  /** Bordered methodology / caveat block above the table. */
  methodologyNote?: string;
  /** Mono footer note (source links etc.). */
  footer?: string;
}

/**
 * Per-index display fields for one entry, carried in `ecosystem_entries.metadata`
 * (jsonb). One bag covers every index's shape: skill cohorts use `name`; the Base
 * / Virtuals MCP indices use `project`/`handle`/`category`/`party`/`ownMcp`/
 * `mcpRef`/`pending`; Bankr uses `section` to split skills from agents. All
 * optional — the renderer reads what its ecosystem populates.
 */
export interface EcosystemEntryMetadata {
  /** Display name for a skill entry (slug or `<repo>`/`<repo>/<sub>`). */
  name?: string;
  project?: string;
  /** X handle without the leading @. */
  handle?: string;
  category?: string;
  /** Built by the protocol itself ("first") vs a community wrapper ("third"). */
  party?: "first" | "third";
  /** Does the project ship its own standalone MCP server? */
  ownMcp?: boolean;
  /** The MCP ref/endpoint for display, even when not graded. */
  mcpRef?: string | null;
  /** If it has an MCP but isn't graded yet, why. */
  pending?: "free-key" | "api-key" | "clone-build" | null;
  /** One-line editorial note. */
  note?: string;
  /** Sub-grouping within an ecosystem (e.g. Bankr "skills" vs "agents"). */
  section?: string;
}

/**
 * One ecosystem index. Mirrors the `ecosystems` table. Provisioned by a global
 * app admin; managed by its `ecosystem_members`. Grades are never stored on the
 * ecosystem — they join live from hosted_runs through the entries' targets.
 */
export interface EcosystemRow {
  id: string;
  slug: string;
  name: string;
  blurb: string | null;
  page_config: EcosystemPageConfig;
  is_public: boolean;
  is_listed: boolean;
  noindex: boolean;
  created_by: string | null;
  created_at: string;
}

/**
 * A person who manages an ecosystem, or a pending email invite. Mirrors the
 * `ecosystem_members` table. `user_id` is null while `status` is 'invited' and
 * binds to the account on first sign-in (resolve_ecosystem_invites).
 */
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

/**
 * A tracked MCP server / skill. Mirrors the `ecosystem_entries` table. `target`
 * is the canonical hosted_runs ref the grade join keys on (nullable for a
 * tracked-only row with no gradeable MCP). Display fields live in `metadata`;
 * `last_grade_*` track an in-flight immediate-grade job.
 */
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

// ── Advisories (CVE store) ───────────────────────────────────────────────────

export type AdvisorySeverity = "CRITICAL" | "HIGH" | "MODERATE" | "LOW";
export type AdvisorySource = "depsdev" | "github" | "osv";
export type AdvisoryEcosystem = "npm" | "pypi" | "github";

/**
 * One security advisory, keyed by GHSA id. Mirrors the `advisories` table.
 * Persisted daily by the ingest job so an ecosystem admin can see the real
 * "CVEs to fix" list; `cve_ids` are the CVE aliases, `withdrawn_at` marks a
 * rescinded advisory (suppressed at read time).
 */
export interface AdvisoryRow {
  id: string;
  ghsa_id: string;
  source: AdvisorySource;
  cve_ids: string[];
  severity: AdvisorySeverity | null;
  cvss: number | null;
  cvss_vector: string | null;
  summary: string | null;
  url: string | null;
  published_at: string | null;
  withdrawn_at: string | null;
  first_seen_at: string;
  last_seen_at: string;
}

/**
 * Which package(-version) an advisory affects. Mirrors the `advisory_targets`
 * table. `package_key` is the versionless target form an ecosystem entry keys on
 * (npm/@scope/pkg | pypi/pkg | github/owner/repo), so the CVE join is equality.
 * `is_current_affected` snapshots whether the evaluated `current_version` falls
 * in `affected_range` — the "to fix" filter.
 */
export interface AdvisoryTargetRow {
  id: string;
  advisory_id: string;
  package_key: string;
  ecosystem: AdvisoryEcosystem;
  affected_range: string | null;
  fixed_version: string | null;
  current_version: string | null;
  is_current_affected: boolean;
  first_seen_at: string;
  last_seen_at: string;
}

// ── Ecosystem alerts ─────────────────────────────────────────────────────────

export type EcosystemAlertFrequency = "weekly" | "off";
export type EcosystemAlertRecipientsMode = "admins" | "members" | "explicit";

/**
 * The per-ecosystem monitoring strategy. Mirrors the `ecosystem_alert_settings`
 * table (one row per ecosystem). An absent row means defaults; the web layer
 * upserts on first save. Each category toggles independently; `frequency: 'off'`
 * mutes the digest without losing the toggles.
 */
export interface EcosystemAlertSettingsRow {
  ecosystem_id: string;
  cve_enabled: boolean;
  cve_min_severity: AdvisorySeverity;
  grade_drop_enabled: boolean;
  new_version_enabled: boolean;
  frequency: EcosystemAlertFrequency;
  recipients_mode: EcosystemAlertRecipientsMode;
  last_cve_sent_at: string | null;
  last_digest_period: string | null;
  created_at: string;
  updated_at: string;
}

/**
 * One digest recipient for an ecosystem. Mirrors the `ecosystem_alert_recipients`
 * table. `source: 'auto'` rows mirror the resolved admins/members set (minted to
 * carry a stable unsubscribe token); `'explicit'` rows are hand-added addresses.
 */
export interface EcosystemAlertRecipientRow {
  id: string;
  ecosystem_id: string;
  email: string;
  user_id: string | null;
  unsubscribe_token: string;
  unsubscribed_at: string | null;
  source: "auto" | "explicit";
  created_at: string;
}

/**
 * Grade-drop / new-version watermark for one entry. Mirrors the
 * `ecosystem_entry_alert_state` table. Advances only after a digest reporting the
 * change is sent, so each change surfaces exactly once.
 */
export interface EcosystemEntryAlertStateRow {
  entry_id: string;
  last_seen_run_id: string | null;
  last_seen_grade: string | null;
  last_seen_version: string | null;
  updated_at: string;
}

/**
 * One weekly-digest send attempt. Mirrors the `ecosystem_alert_deliveries` table.
 * The `(recipient_id, period_key)` unique constraint is the weekly dedup — at
 * most one digest per recipient per ISO week (claim_ecosystem_delivery).
 */
export interface EcosystemAlertDeliveryRow {
  id: string;
  ecosystem_id: string;
  recipient_id: string;
  period_key: string;
  kind: string;
  email: string;
  status: AlertDeliveryStatus;
  resend_message_id: string | null;
  error: string | null;
  created_at: string;
  sent_at: string | null;
}

// ── LISTEN/NOTIFY payloads ───────────────────────────────────────────────────

export interface VersionDetectedPayload {
  version_id: string;
  server_id: string;
}

export interface GradeComputedPayload {
  version_id: string;
  kind: "adoption" | "behavioral";
  new_value: number | string;
}

export interface AlertFiredPayload {
  alert_id: string;
  user_id: string;
  server_id: string;
  reason: string;
}
