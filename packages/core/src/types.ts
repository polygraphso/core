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
