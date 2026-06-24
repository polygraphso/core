// web/lib/rankings.ts
import type { SupabaseClient } from "@supabase/supabase-js";
import { serverKey, parseServerRef } from "@/lib/identity";
import type { LitmusGrade } from "@/lib/hostedGrades";

export type Registry = "npm" | "pypi" | "github";

/** The subset of adoption_scores.components we render. */
export interface RankingComponents {
  npm_downloads_last_month?: number | null;
  pypi_downloads_last_month?: number | null;
  gh_stars?: number | null;
  gh_forks?: number | null;
  gh_contributors?: number | null;
  depsdev_dependents_count?: number | null;
  openssf_aggregate?: number | null;
  smithery_use_count?: number | null;
  npm_last_publish_date?: string | null;
  pypi_last_release_date?: string | null;
  /** Per-dimension breakdown (0–100). `adoption` is the public ranking key. */
  dimensions?: {
    adoption?: number;
    quality?: number;
    consistency?: number;
    risk?: number;
  } | null;
  [key: string]: unknown;
}

/** One raw adoption input, formatted for display. */
export interface AdoptionMetric {
  label: string;
  value: string;
}

export interface RankedServer {
  rank: number;
  registry: Registry;
  owner: string | null;
  name: string;
  /** Full composite score (adoption+quality+consistency−risk); kept for reference, not the rank key. */
  score: number;
  /** 0–100 adoption dimension (downloads + stars + dependents + velocity); THIS is the rank key. */
  adoptionScore: number;
  /** When this server's kept (newest) score row was computed — ISO timestamp. */
  computedAt: string;
  components: RankingComponents;
}

/** Shape of one adoption_scores row from the Supabase select below. */
export interface JoinedScoreRow {
  version_id: string;
  score: string | number;
  components: RankingComponents;
  computed_at: string;
  versions: {
    servers: { registry: Registry; owner: string | null; name: string } | null;
  } | null;
}

export interface RankingGrade {
  grade: LitmusGrade;
  c01: string | null;
  c02: string | null;
  c03: string | null;
}

export interface RankingRow {
  rank: number;
  serverKey: string;
  registry: Registry;
  /** 0–100 adoption score that determines the rank. */
  adoptionScore: number;
  /** Human-readable reach proxy (monthly downloads / stars). */
  adoptionSignal: string;
  grade: LitmusGrade | null;
  c01: string | null;
  c02: string | null;
  c03: string | null;
}

const VALID_GRADES = new Set(["A", "B", "C", "D", "F"]);
const compact = new Intl.NumberFormat("en", { notation: "compact", maximumSignificantDigits: 3 });

/** Human adoption signal: npm monthly, else PyPI monthly, else GitHub stars, else "—". */
export function formatAdoptionSignal(c: RankingComponents): string {
  if (typeof c.npm_downloads_last_month === "number" && c.npm_downloads_last_month > 0) {
    return `${compact.format(c.npm_downloads_last_month)} npm/mo`;
  }
  if (typeof c.pypi_downloads_last_month === "number" && c.pypi_downloads_last_month > 0) {
    return `${compact.format(c.pypi_downloads_last_month)} pypi/mo`;
  }
  if (typeof c.gh_stars === "number" && c.gh_stars > 0) {
    return `${compact.format(c.gh_stars)} ★`;
  }
  return "—";
}

function fmtInt(n: unknown): string | null {
  return typeof n === "number" && Number.isFinite(n) ? Math.round(n).toLocaleString("en-US") : null;
}

function fmtDate(d: unknown): string | null {
  return typeof d === "string" && d.length >= 10 ? d.slice(0, 10) : null;
}

/** The raw signals that fed the adoption score, formatted; present ones only, in display order. */
export function adoptionMetrics(c: RankingComponents): AdoptionMetric[] {
  const out: AdoptionMetric[] = [];
  const add = (label: string, value: string | null) => {
    if (value !== null) out.push({ label, value });
  };
  add("npm downloads (30d)", fmtInt(c.npm_downloads_last_month));
  add("PyPI downloads (30d)", fmtInt(c.pypi_downloads_last_month));
  add("GitHub stars", fmtInt(c.gh_stars));
  add("Forks", fmtInt(c.gh_forks));
  add("Contributors", fmtInt(c.gh_contributors));
  add("Dependents (deps.dev)", fmtInt(c.depsdev_dependents_count));
  add("OpenSSF score", fmtInt(c.openssf_aggregate));
  add("Smithery installs", fmtInt(c.smithery_use_count));
  add("Last published", fmtDate(c.npm_last_publish_date) ?? fmtDate(c.pypi_last_release_date));
  return out;
}

/** The 0–100 adoption dimension from a score row, or 0 when absent. */
function adoptionDimension(c: RankingComponents | null | undefined): number {
  const a = c?.dimensions?.adoption;
  return typeof a === "number" ? a : 0;
}

export function dedupeAndRank(rows: JoinedScoreRow[], limit: number): RankedServer[] {
  // Input is ordered by computed_at desc, so the first row seen for a server is
  // its most-recently-scored version. Dedupe by SERVER (not version_id) so a
  // server that shipped a new version doesn't show up twice. Then rank by the
  // ADOPTION dimension — this is "most-adopted", so popularity (downloads +
  // stars + dependents + velocity) orders the list, NOT the full composite
  // (which also folds in quality/consistency/risk and is for grading priority).
  const seen = new Set<string>();
  const out: RankedServer[] = [];
  const picked: Array<{ s: NonNullable<NonNullable<JoinedScoreRow["versions"]>["servers"]>; row: JoinedScoreRow }> = [];
  for (const row of rows) {
    const s = row.versions?.servers;
    if (!s) continue; // skip rows missing the FK join rather than throwing
    const key = `${s.registry}/${s.owner ?? ""}/${s.name}`;
    if (seen.has(key)) continue;
    seen.add(key);
    picked.push({ s, row });
  }
  picked.sort((a, b) => adoptionDimension(b.row.components) - adoptionDimension(a.row.components));
  for (const { s, row } of picked) {
    out.push({
      rank: out.length + 1,
      registry: s.registry,
      owner: s.owner,
      name: s.name,
      score: Number(row.score),
      adoptionScore: adoptionDimension(row.components),
      computedAt: row.computed_at,
      components: row.components ?? {},
    });
    if (out.length >= limit) break;
  }
  return out;
}

/** serverKey → grade detail, newest published row per target wins; invalid grades dropped. */
export function gradeMapFromRows(
  rows: Array<{
    target: string;
    grade: string | null;
    c01: string | null;
    c02: string | null;
    c03: string | null;
  }>,
): Map<string, RankingGrade> {
  const map = new Map<string, RankingGrade>();
  for (const r of rows) {
    if (map.has(r.target)) continue; // rows arrive newest-first
    if (r.grade && VALID_GRADES.has(r.grade)) {
      map.set(r.target, { grade: r.grade as LitmusGrade, c01: r.c01, c02: r.c02, c03: r.c03 });
    }
  }
  return map;
}

/** Join ranked servers to their published grades by serverKey. Pure. */
export function mergeRankings(
  ranked: RankedServer[],
  grades: Map<string, RankingGrade>,
): RankingRow[] {
  return ranked.map((r) => {
    const key = serverKey({ registry: r.registry, owner: r.owner, name: r.name });
    const g = grades.get(key) ?? null;
    return {
      rank: r.rank,
      serverKey: key,
      registry: r.registry,
      adoptionScore: r.adoptionScore,
      adoptionSignal: formatAdoptionSignal(r.components),
      grade: g?.grade ?? null,
      c01: g?.c01 ?? null,
      c02: g?.c02 ?? null,
      c03: g?.c03 ?? null,
    };
  });
}

// ── Impure reads (server-side; caller supplies the service-role client) ──────

/** Latest adoption_scores per version, top `limit` by score. Mirrors @polygraph/scoring readTopRanked. */
export async function fetchTopRanked(db: SupabaseClient, limit = 50): Promise<RankedServer[]> {
  const { data, error } = await db
    .from("adoption_scores")
    .select(
      "version_id, score, components, computed_at, versions:version_id(servers:server_id(registry, owner, name))",
    )
    .order("computed_at", { ascending: false })
    .limit(limit * 4);
  if (error) {
    console.warn("[rankings] adoption read soft-failed:", error.message);
    return [];
  }
  return dedupeAndRank((data ?? []) as unknown as JoinedScoreRow[], limit);
}

/** Every published registry_ref grade, keyed by versionless serverKey. */
export async function fetchPublishedGradeDetailMap(
  db: SupabaseClient,
): Promise<Map<string, RankingGrade>> {
  const { data, error } = await db
    .from("hosted_runs")
    .select("target, grade, c01, c02, c03, published_at")
    .eq("target_kind", "registry_ref")
    .eq("status", "complete")
    .not("published_at", "is", null)
    .order("published_at", { ascending: false });
  if (error) {
    console.warn("[rankings] grade read soft-failed:", error.message);
    return new Map();
  }
  return gradeMapFromRows(
    (data ?? []) as Array<{
      target: string;
      grade: string | null;
      c01: string | null;
      c02: string | null;
      c03: string | null;
    }>,
  );
}

export interface ServerAdoption {
  /** 0–100 adoption dimension. */
  adoptionScore: number;
  /** Human-readable reach proxy (monthly downloads / stars), or "—". */
  adoptionSignal: string;
  /** ISO timestamp of the newest score row used. */
  computedAt: string;
  /** The raw signals behind the score, formatted for display. */
  metrics: AdoptionMetric[];
}

type EmbeddedScoreRow = {
  score: string | number;
  components: RankingComponents;
  computed_at: string;
};

/**
 * Latest adoption score for a single server (newest computed_at across its
 * versions), or null if the server isn't tracked / has no score. Used by the
 * per-server report page.
 */
export async function fetchAdoptionForServer(
  db: SupabaseClient,
  key: string,
): Promise<ServerAdoption | null> {
  let registry: Registry;
  let owner: string | null;
  let name: string;
  try {
    const parsed = parseServerRef(key);
    registry = parsed.registry;
    owner = parsed.owner;
    name = parsed.name;
  } catch {
    return null;
  }

  let query = db
    .from("servers")
    // `!server_id` disambiguates: servers has two FK paths to versions
    // (versions.server_id and servers.latest_version_id); we want the former.
    .select("versions!server_id(adoption_scores(score, components, computed_at))")
    .eq("registry", registry)
    .eq("name", name);
  query = owner === null ? query.is("owner", null) : query.eq("owner", owner);

  const { data, error } = await query.maybeSingle();
  if (error) {
    console.warn("[rankings] server adoption read soft-failed:", error.message);
    return null;
  }
  if (!data) return null;

  const versions =
    (data as { versions?: Array<{ adoption_scores?: EmbeddedScoreRow[] }> }).versions ?? [];
  const scores = versions.flatMap((v) => v.adoption_scores ?? []);
  if (scores.length === 0) return null;
  // Newest score row wins (ISO timestamps compare lexically).
  scores.sort((a, b) => (a.computed_at < b.computed_at ? 1 : -1));
  const latest = scores[0]!;

  return {
    adoptionScore: adoptionDimension(latest.components),
    adoptionSignal: formatAdoptionSignal(latest.components),
    computedAt: latest.computed_at,
    metrics: adoptionMetrics(latest.components),
  };
}
