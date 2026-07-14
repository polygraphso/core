/**
 * The one place the site's public identity lives. Every file that needs the
 * canonical origin (metadata, robots, sitemap, embed snippets, attestation
 * URLs) imports it from here — www vs apex drift across files is how the
 * 2026-07 SEO audit found three different origins in the codebase.
 *
 * The methodology versions are duplicated from litmus (the authoritative
 * source is litmus's types.ts); they live here so a version bump is a
 * one-line edit instead of a grep across the app. The /methodology changelog
 * keeps its own hardcoded history — those are records, not the current value.
 */

/** Canonical public origin. Apex redirects here (Vercel domain config). */
export const SITE_ORIGIN = "https://www.polygraph.so";

/** Current server-harness methodology version (mirrors litmus). */
export const METHODOLOGY_VERSION = "litmus-v16";

/** Current skill-litmus methodology version (mirrors litmus). */
export const SKILL_METHODOLOGY_VERSION = "litmus-skill-v2";
