/**
 * The public sitemap — the one place that tells search engines every indexable
 * URL polygraph publishes. The growth thesis is "one durable, rankable URL per
 * graded server/skill," so this file is what turns each newly published grade
 * into search coverage.
 *
 * What it lists: the stable marketing/docs routes, every published per-server
 * report (`/mcp/<key>`), every published per-skill report (`/skill/<path>`), and
 * every blog post. What it deliberately omits: remote (`https://…`) server
 * reports — they're mutable/unversioned and stay `noindex` (see
 * app/mcp/[...ref]/page.tsx) — and the operational/private routes (admin,
 * dashboard, the per-network decks like /base, /bankr), which carry their own
 * `noindex`.
 *
 * ISR-cached like /mcp-index: a freshly published grade surfaces within 10 min.
 */
import type { MetadataRoute } from "next";
import { getSupabaseAdmin } from "@/lib/supabase";
import { fetchPublishedGradeDetailMap, fetchPublishedLastModified } from "@/lib/rankings";
import { fetchPublishedSkillGrades } from "@/lib/skillGrades";
import { isRemoteKey, refToPath } from "@/lib/badgeData";
import { getAllPosts } from "@/lib/blog";

const ORIGIN = "https://www.polygraph.so";

// Match /mcp-index: a newly published grade or skill should appear within 10 min.
export const revalidate = 600;

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const staticEntries: MetadataRoute.Sitemap = [
    { url: `${ORIGIN}/`, changeFrequency: "daily", priority: 1 },
    { url: `${ORIGIN}/ecosystems`, changeFrequency: "daily", priority: 0.8 },
    { url: `${ORIGIN}/mcp-index`, changeFrequency: "daily", priority: 0.9 },
    { url: `${ORIGIN}/builders`, changeFrequency: "monthly", priority: 0.6 },
    { url: `${ORIGIN}/pricing`, changeFrequency: "monthly", priority: 0.6 },
    { url: `${ORIGIN}/methodology`, changeFrequency: "monthly", priority: 0.7 },
    { url: `${ORIGIN}/docs/api`, changeFrequency: "monthly", priority: 0.5 },
    { url: `${ORIGIN}/request`, changeFrequency: "monthly", priority: 0.5 },
    { url: `${ORIGIN}/brand-kit`, changeFrequency: "yearly", priority: 0.3 },
    { url: `${ORIGIN}/blog`, changeFrequency: "weekly", priority: 0.5 },
  ];

  // Blog posts are filesystem-backed, so they list even when the DB is absent.
  let blogEntries: MetadataRoute.Sitemap = [];
  try {
    const posts = await getAllPosts();
    blogEntries = posts.map((p) => ({
      url: `${ORIGIN}/blog/${p.slug}`,
      lastModified: p.date,
      changeFrequency: "yearly" as const,
      priority: 0.4,
    }));
  } catch {
    blogEntries = [];
  }

  const db = getSupabaseAdmin();
  if (!db) return [...staticEntries, ...blogEntries];

  const [gradeMap, skills, lastMod] = await Promise.all([
    fetchPublishedGradeDetailMap(db),
    fetchPublishedSkillGrades(db),
    fetchPublishedLastModified(db),
  ]);

  // Registry servers only — remote (https) reports stay noindex, so drop them.
  const serverEntries: MetadataRoute.Sitemap = [...gradeMap.keys()]
    .filter((key) => !isRemoteKey(key))
    .map((key) => ({
      url: `${ORIGIN}/mcp/${refToPath(key)}`,
      lastModified: lastMod.get(key),
      changeFrequency: "weekly" as const,
      priority: 0.8,
    }));

  const skillEntries: MetadataRoute.Sitemap = skills.map((s) => ({
    url: `${ORIGIN}/skill/${s.path}`,
    lastModified: lastMod.get(s.ref),
    changeFrequency: "weekly" as const,
    priority: 0.6,
  }));

  return [...staticEntries, ...serverEntries, ...skillEntries, ...blogEntries];
}
