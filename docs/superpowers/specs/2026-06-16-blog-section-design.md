# Blog section — design

**Date:** 2026-06-16
**Status:** Approved (pending spec review)

## Goal

Add a simple, file-based blog to `polygraph.so`. Posts are authored in Notion,
exported to Markdown, and dropped into the repo. Each post renders in the site's
existing scientific-preprint chrome and produces correct share/social metadata.

The first post is the Notion article "Open source needs new funding mechanisms"
(Notion page `38071f7adb2081fda4a2ec43a16de5e7`).

## Non-goals (YAGNI)

- No CMS, no Notion API at build/runtime, no database. Markdown files only.
- No tags, categories, author pages, pagination, RSS, or comments. (Parking-lot
  until the blog has enough posts to need them.)
- No dynamic per-post OG image generation. A static branded default image is
  enough pre-traction; frontmatter leaves room for a per-post override later.
- No changes to the header nav. Blog is linked from the footer only.

## Decisions (from brainstorming)

- **Content pipeline:** Markdown files committed to the repo.
- **Navigation:** Footer link only; header untouched.
- **Share metadata:** must work properly — real title, description, and image
  card when a post URL is shared.

## Architecture

### Content storage

```
web/content/blog/
  open-source-needs-new-funding-mechanisms.md
```

- One `.md` file per post. **Filename (minus `.md`) is the URL slug.**
- Frontmatter schema:

  ```markdown
  ---
  title: "Open source needs new funding mechanisms"
  date: "2026-06-16"          # ISO date, used for sort + article:published_time
  excerpt: "One-line summary for the index card and meta description."
  ogImage: "/og.png"          # optional; defaults to the site-wide OG image
  ---
  (post body in Markdown — no top-level H1; the title is rendered from frontmatter)
  ```

- Adding a future post = export from Notion, clean once (see Content cleanup),
  drop the file in. No code changes.

### Data layer — `web/lib/blog.ts` (server-only)

Uses Node `fs`; imported only by server components, never the client.

- `type PostMeta = { slug, title, date, excerpt, ogImage? }`
- `type Post = PostMeta & { body: string }` (body = raw Markdown)
- `getAllPosts(): PostMeta[]` — reads every `.md` in `content/blog/`, parses
  frontmatter with `gray-matter`, returns metadata sorted newest-first by `date`.
- `getPost(slug: string): Post | null` — reads one file, returns frontmatter +
  body, or `null` if the file does not exist.
- Slug derives from filename. Missing required frontmatter (`title`, `date`,
  `excerpt`) throws at build time with the offending filename — fail loud, not
  silent, since these are build-time static files.

### Rendering

- Library: `react-markdown` + `remark-gfm`. Body Markdown → React via a custom
  component map so output is styled, not raw HTML.
- Component map mirrors the `/methodology` preprint chrome:
  - `h2` → `font-serif text-2xl md:text-3xl text-ink tracking-tight`, top margin
  - `h3` → `font-serif text-lg md:text-xl text-ink`
  - `p`  → `text-ink-muted leading-relaxed`
  - `a`  → `text-ink hover:text-oxblood transition-colors`; external links
    (`http`) get `target="_blank" rel="noreferrer"`
  - `strong` → `text-ink font-semibold`
  - `ul`/`ol`/`li` → spaced list styling consistent with the site
- The map lives in a small shared component, e.g.
  `web/app/blog/_components/Markdown.tsx`, so the index and post pages share it
  if needed.

### Routes

- **`/blog` — `web/app/blog/page.tsx`** (server component)
  - Same `max-w-3xl` article column + header treatment as `/methodology`:
    section-label kicker ("Blog" / "Writing"), serif H1 ("Blog" or similar).
  - Lists `getAllPosts()`: each entry = post title (link to `/blog/<slug>`),
    mono date label, excerpt. Newest first.
  - Static metadata (title "Blog", description, canonical `/blog`).

- **`/blog/[slug]` — `web/app/blog/[slug]/page.tsx`** (server component)
  - `generateStaticParams()` from `getAllPosts()` → fully static, no runtime deps.
  - Renders: section-label kicker + mono date, serif `<h1>` from frontmatter
    title, then the Markdown body via the component map. `max-w-3xl` article column.
  - `getPost(slug)` returns `null` → `notFound()` (Next `not-found`).
  - `generateMetadata({ params })`:
    - `title` = post title (root layout template appends `· polygraph.so`)
    - `description` = excerpt
    - `alternates.canonical` = `/blog/<slug>`
    - `openGraph`: `type: "article"`, `title`, `description`,
      `url: /blog/<slug>`, `publishedTime: date`, `images: [ogImage ?? default]`
    - `twitter`: `summary_large_image`, title, description, image

### Share metadata — site-wide fix

The root layout currently sets **no** `openGraph.images`, so no page previews
with an image today. Fix once, benefit everywhere:

- Copy `brand/social-preview.png` → `web/public/og.png`.
- In `web/app/layout.tsx` add `openGraph.images` and `twitter.images` pointing
  at `/og.png` (1200×630 branded card) as the site-wide default.
- Blog posts inherit this default unless frontmatter sets `ogImage`.

### Navigation

- Add a **Blog** link to `web/app/_components/Footer.tsx`, in the CLI column
  directly above the existing Methodology link (`/blog`, same link styling).
- Header (`SiteHeader.tsx`) is unchanged.

## Content cleanup (one-time, for the first post)

The Notion Markdown export needs three fixes before committing the `.md`:

1. The post's real title is the body H1 "Open source needs new funding
   mechanisms" (Notion frontmatter said "First blog post"). Promote the real
   title into frontmatter; remove the H1 from the body.
2. One heading was exported wrapped in
   `<span discussion-urls="discussion://…">When agents start interacting with a
   messy Internet</span>`. Replace with a clean
   `## When agents start interacting with a messy Internet`.
3. Keep inline links as-is (Bankr, $POLYGRAPH, Telegram). Unescape Notion's
   `\$` → `$` where it reads naturally.

Write an `excerpt` (1 sentence) and `date: "2026-06-16"`.

## Dependencies

Three lightweight additions to `web/package.json`:

- `react-markdown`
- `remark-gfm`
- `gray-matter`

## Testing / verification

- `pnpm build` (or `next build`) succeeds; `/blog` and `/blog/<slug>` are
  statically generated (appear in the build's route list as static).
- Preview server: `/blog` lists the post; clicking through renders the full
  article in preprint styling with working external links.
- View source on `/blog/<slug>`: `<title>`, `og:title`, `og:description`,
  `og:type=article`, `og:image`, `twitter:card` are all present and correct.
- Footer shows the Blog link; header is unchanged.

## Files touched

| File | Change |
|------|--------|
| `web/content/blog/open-source-needs-new-funding-mechanisms.md` | new — first post |
| `web/lib/blog.ts` | new — data layer |
| `web/app/blog/page.tsx` | new — index |
| `web/app/blog/[slug]/page.tsx` | new — post page |
| `web/app/blog/[slug]/not-found.tsx` | new (optional) — 404 for unknown slug |
| `web/app/blog/_components/Markdown.tsx` | new — styled Markdown renderer |
| `web/app/layout.tsx` | edit — default OG/twitter image |
| `web/app/_components/Footer.tsx` | edit — Blog link |
| `web/public/og.png` | new — copied from brand/social-preview.png |
| `web/package.json` | edit — 3 deps |
