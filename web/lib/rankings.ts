// web/lib/rankings.ts
import type { SupabaseClient } from "@supabase/supabase-js";
import { serverKey } from "@/lib/identity";
import type { LitmusGrade } from "@/lib/hostedGrades";

export type Registry = "npm" | "pypi" | "github";

/** The subset of adoption_scores.components we render. */
export interface RankingComponents {
  npm_downloads_last_month?: number | null;
  pypi_downloads_last_month?: number | null;
  gh_stars?: number | null;
  [key: string]: unknown;
}

export interface RankedServer {
  rank: number;
  registry: Registry;
  owner: string | null;
  name: string;
  score: number;
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
  adoptionSignal: string;
  grade: LitmusGrade | null;
  c01: string | null;
  c02: string | null;
  c03: string | null;
}

const VALID_GRADES = new Set(["A", "B", "C", "D", "F"]);
const compact = new Intl.NumberFormat("en", { notation: "compact", maximumFractionDigits: 1 });

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

/** Dedupe by version (input is newest-first), sort by score desc, take top `limit`, assign rank. */
export function dedupeAndRank(rows: JoinedScoreRow[], limit: number): RankedServer[] {
  const seen = new Set<string>();
  const latest: JoinedScoreRow[] = [];
  for (const row of rows) {
    if (seen.has(row.version_id)) continue;
    seen.add(row.version_id);
    latest.push(row);
  }
  latest.sort((a, b) => Number(b.score) - Number(a.score));

  const out: RankedServer[] = [];
  for (const row of latest) {
    const s = row.versions?.servers;
    if (!s) continue; // skip rows missing the FK join rather than throwing
    out.push({
      rank: out.length + 1,
      registry: s.registry,
      owner: s.owner,
      name: s.name,
      score: Number(row.score),
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
