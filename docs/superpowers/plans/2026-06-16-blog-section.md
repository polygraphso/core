# Blog Section Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a file-based Markdown blog to polygraph.so — `/blog` index + `/blog/[slug]` posts in the site's preprint chrome, with correct share/social metadata.

**Architecture:** Posts are `.md` files in `web/content/blog/` (filename = slug, frontmatter for title/date/excerpt). A server-only `lib/blog.ts` reads them with `gray-matter`. Pages are static App Router server components; bodies render via `react-markdown` + `remark-gfm` through a styled component map. A site-wide default OG image plus per-post `article` metadata make shared links preview correctly.

**Tech Stack:** Next.js 16.2.6 (App Router), React 19, Tailwind v4, `react-markdown`, `remark-gfm`, `gray-matter`.

**Reference spec:** `docs/superpowers/specs/2026-06-16-blog-section-design.md`

---

## ⚠️ Next.js 16 note (read before coding)

This repo's `web/AGENTS.md` warns Next.js 16 differs from training-data conventions. After `pnpm install` (Task 1), skim `web/node_modules/next/dist/docs/` for `generateMetadata`, `generateStaticParams`, and dynamic-route params. **Known breaking change vs. older Next:** in dynamic routes, `params` is a `Promise` — you must `await params` in both the page component and `generateMetadata`. The code below already does this; confirm it matches the bundled docs.

There is **no test framework** in this repo and adding one is out of scope. Verification for every task is `next build` (static-route generation), the preview server, and view-source on metadata.

## File Structure

| File | Responsibility |
|------|----------------|
| `web/content/blog/open-source-needs-new-funding-mechanisms.md` | First post (content) |
| `web/lib/blog.ts` | Server-only data layer: list + fetch posts |
| `web/app/blog/_components/Markdown.tsx` | Styled `react-markdown` renderer (preprint chrome) |
| `web/app/blog/page.tsx` | Blog index |
| `web/app/blog/[slug]/page.tsx` | Single post + `generateMetadata` + `generateStaticParams` |
| `web/app/blog/[slug]/not-found.tsx` | 404 for unknown slug |
| `web/app/layout.tsx` | Edit: site-wide default OG/twitter image |
| `web/app/_components/Footer.tsx` | Edit: Blog link |
| `web/public/og.png` | Default social card (copied from brand/) |
| `web/package.json` | Edit: 3 deps |

---

## Task 1: Dependencies + OG image asset

**Files:**
- Modify: `web/package.json`
- Create: `web/public/og.png`

- [ ] **Step 1: Install runtime deps**

Run from `web/`:
```bash
pnpm add react-markdown remark-gfm gray-matter
```
Expected: `package.json` gains `react-markdown`, `remark-gfm`, `gray-matter`; lockfile updates; `node_modules/next/dist/docs/` now exists.

- [ ] **Step 2: Copy the default OG image into the web app**

Run from repo root:
```bash
mkdir -p web/public && cp brand/social-preview.png web/public/og.png
```
Expected: `web/public/og.png` exists (~108 KB, 1200×630).

- [ ] **Step 3: Read the Next 16 docs note above**

Skim `web/node_modules/next/dist/docs/` for `generateMetadata` / `generateStaticParams` / dynamic params. Confirm `params` is a Promise.

- [ ] **Step 4: Commit**

```bash
git add web/package.json web/pnpm-lock.yaml web/public/og.png
git commit -m "Add blog deps (react-markdown, remark-gfm, gray-matter) + default OG image"
```

---

## Task 2: First post content

**Files:**
- Create: `web/content/blog/open-source-needs-new-funding-mechanisms.md`

- [ ] **Step 1: Write the cleaned Markdown file**

The body H1 is promoted to frontmatter `title`; the Notion `<span discussion-urls=…>` heading is cleaned to a plain `##`; Notion's `\$` is unescaped to `$`.

```markdown
---
title: "Open source needs new funding mechanisms"
date: "2026-06-16"
excerpt: "Independent AI safety testing is hard to fund without bending the work. Polygraph is an experiment in open, community-funded safety infrastructure."
---

Open source is carrying more of the AI stack every week: agents, MCP servers, evals, safety tools, dev tooling, model wrappers, automation layers. A lot of the internet's next trust layer is being maintained by tiny teams, solo builders, and independent labs.

But the funding model still looks broken. Grants are slow. Sponsorships are fragile. VC pushes useful tools towards becoming for-profit ventures before the public-good layer is proven. And when the work is about trust, security, or AI safety, who funds it matters even more.

## Why this matters for AI

AI tools are moving from "vibe coded apps" into real workflows. They read private context, call APIs, install packages, and touch wallets. They connect to production systems, and make decisions faster than humans can inspect every step.

That means trust can't just come from brand, vibes, or screenshots. We need independent ways to test the tools we are starting to rely on.

The problem is that independent testing is expensive and tough to fund.

If the work depends on a big lab, it can become captured by the ecosystem it is supposed to grade. If it depends on grants, it moves at grant speed and may attract subsidy-dependent actors. If it depends on VC too early, the project may have to become a venture-scale company before the public-good layer is proven.

None of those models are evil, they just all bend the work in different directions. For open-source AI safety infrastructure, that is a big problem.

## The bigger experiment: open safety infrastructure

Polygraph is an independent open-source project that tests AI tools under adversarial conditions. We look for things like prompt hijacking, excessive permissions, unsafe actions, and data leaks, then publish simple A-F grades with evidence behind them. No graded party pays us. The polygraphs are public, and there is a CLI for fast checks.

That matters because open-source AI safety infrastructure has a trust problem.

If the people being graded pay for the grade, the result is easy to question. If the work depends only on grants or goodwill, it may not be sustainable. If it is closed, developers cannot inspect or challenge the tests.

Polygraph is our attempt at a different model: open tests, public evidence, simple grades, and a simple path to sustainability.

The team behind Polygraph is Talent Protocol. We have spent years building reputation systems for builders: turning projects, contributions, and verified signals into something people can trust. Polygraph applies that same instinct to the agentic web.

The product is still early, and the grading system has a lot to improve.

But the bigger question is this:

**Can independent open-source AI safety infrastructure become useful, credible, and sustainable in the long run?**

## When agents start interacting with a messy Internet

A simple example: an AI tool might look safe in a normal demo, but behave very differently when connected to private context and given a malicious instruction through a webpage, repo, document, or MCP server.

Maybe it leaks context it should not expose. Maybe it follows instructions from an untrusted source. Maybe it takes an action the user never intended. Maybe it gives another tool too much authority.

These are not abstract risks… So, the grading needs to be public enough to challenge, reproduce, and improve. That is why Polygraph needs to be open source.

## Bankr community steps in

[Bankr](https://bankr.bot) gives projects like Polygraph a way to test a different path: community-funded open source.

Instead of waiting for grants, chasing sponsors, or turning the whole thing into a venture-backed company too early, a project like Polygraph can receive support from the community around it, right from the start. If people believe independent AI tool testing should exist, they can support it directly.

The community has already created [$POLYGRAPH](https://bankr.bot/discover/0x2878cfc54aabdadd9bb5d70dd24d6b91485afba3). Polygraph is claiming dev fees from that community token to support the open-source project. That creates a funding loop closer to the people who actually want the work to exist, and that matters because open source usually has the opposite problem: a lot of people benefit, very few people pay, and maintainers are expected to keep going anyway.

However, Polygraph should not be trusted because it has a community around it. It should be trusted only if the tests are useful, the evidence is public, the methodology improves, and the grades hold up under scrutiny.

The community funding mechanism is there to help the work survive long enough to become credible.

## The cat and mouse game

The next step is to make Polygraph more useful and harder to fool. The roadmap is simple: grade more AI tools, publish more evidence-backed reports, improve the methodology, make checks easier to run from the CLI, and let builders request polygraphs for the tools they rely on.

If you care about independent AI safety infrastructure, don't just watch us shipping. Use Polygraph. Challenge the grades and submit AI tools that should be graded. And, suggest ways to make the methodology harder to fool.

Last but not least, if you want to support Polygraph's maintenance, join the [Polygraphers community on telegram](http://t.me/polygraphcommunity) and support [$POLYGRAPH](https://bankr.bot/discover/0x2878cfc54aabdadd9bb5d70dd24d6b91485afba3).
```

- [ ] **Step 2: Commit**

```bash
git add web/content/blog/open-source-needs-new-funding-mechanisms.md
git commit -m "Add first blog post (cleaned from Notion export)"
```

---

## Task 3: Data layer (`lib/blog.ts`)

**Files:**
- Create: `web/lib/blog.ts`

- [ ] **Step 1: Write the data layer**

```typescript
import "server-only";
import { promises as fs } from "node:fs";
import path from "node:path";
import matter from "gray-matter";

const BLOG_DIR = path.join(process.cwd(), "content", "blog");

export type PostMeta = {
  slug: string;
  title: string;
  date: string; // ISO yyyy-mm-dd
  excerpt: string;
  ogImage?: string;
};

export type Post = PostMeta & { body: string };

function parseFile(slug: string, raw: string): Post {
  const { data, content } = matter(raw);
  const missing = (["title", "date", "excerpt"] as const).filter(
    (k) => typeof data[k] !== "string" || data[k].trim() === "",
  );
  if (missing.length > 0) {
    throw new Error(
      `Blog post "${slug}.md" is missing frontmatter: ${missing.join(", ")}`,
    );
  }
  return {
    slug,
    title: data.title,
    date: data.date,
    excerpt: data.excerpt,
    ogImage: typeof data.ogImage === "string" ? data.ogImage : undefined,
    body: content.trim(),
  };
}

async function readAll(): Promise<Post[]> {
  const entries = await fs.readdir(BLOG_DIR);
  const files = entries.filter((f) => f.endsWith(".md"));
  const posts = await Promise.all(
    files.map(async (file) => {
      const slug = file.replace(/\.md$/, "");
      const raw = await fs.readFile(path.join(BLOG_DIR, file), "utf8");
      return parseFile(slug, raw);
    }),
  );
  // Newest first by date.
  return posts.sort((a, b) => (a.date < b.date ? 1 : a.date > b.date ? -1 : 0));
}

export async function getAllPosts(): Promise<PostMeta[]> {
  const posts = await readAll();
  return posts.map(({ body: _body, ...meta }) => meta);
}

export async function getPost(slug: string): Promise<Post | null> {
  try {
    const raw = await fs.readFile(path.join(BLOG_DIR, `${slug}.md`), "utf8");
    return parseFile(slug, raw);
  } catch (err) {
    if ((err as NodeJS.ErrnoException).code === "ENOENT") return null;
    throw err;
  }
}
```

> Note: `import "server-only"` requires the `server-only` package, which ships with Next.js — confirm it resolves during the Task 7 build. If the build complains it is missing, run `pnpm add server-only`.

- [ ] **Step 2: Commit**

```bash
git add web/lib/blog.ts
git commit -m "Add server-only blog data layer"
```

---

## Task 4: Styled Markdown renderer

**Files:**
- Create: `web/app/blog/_components/Markdown.tsx`

- [ ] **Step 1: Write the renderer**

Component map mirrors the `/methodology` preprint chrome (serif headings, ink-muted body, oxblood links). External links open in a new tab.

```tsx
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";

export function Markdown({ children }: { children: string }) {
  return (
    <div className="space-y-5 text-ink-muted leading-relaxed">
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        components={{
          h2: ({ children }) => (
            <h2 className="font-serif text-2xl md:text-3xl text-ink tracking-tight mt-12 mb-1">
              {children}
            </h2>
          ),
          h3: ({ children }) => (
            <h3 className="font-serif text-lg md:text-xl text-ink mt-8 mb-1">
              {children}
            </h3>
          ),
          p: ({ children }) => <p className="text-ink-muted leading-relaxed">{children}</p>,
          a: ({ href, children }) => {
            const external = !!href && /^https?:\/\//.test(href);
            return (
              <a
                href={href}
                className="text-ink underline decoration-rule underline-offset-2 hover:text-oxblood hover:decoration-oxblood transition-colors"
                {...(external ? { target: "_blank", rel: "noreferrer" } : {})}
              >
                {children}
              </a>
            );
          },
          strong: ({ children }) => <strong className="text-ink font-semibold">{children}</strong>,
          em: ({ children }) => <em className="italic">{children}</em>,
          ul: ({ children }) => (
            <ul className="list-disc pl-5 space-y-1.5 text-ink-muted">{children}</ul>
          ),
          ol: ({ children }) => (
            <ol className="list-decimal pl-5 space-y-1.5 text-ink-muted">{children}</ol>
          ),
          li: ({ children }) => <li className="leading-relaxed">{children}</li>,
          blockquote: ({ children }) => (
            <blockquote className="border-l-2 border-oxblood/40 pl-4 italic text-ink-muted">
              {children}
            </blockquote>
          ),
          code: ({ children }) => (
            <code className="font-mono text-[0.92em] text-ink bg-parchment-200/60 px-1 py-[1px] rounded-sm">
              {children}
            </code>
          ),
        }}
      >
        {children}
      </ReactMarkdown>
    </div>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add web/app/blog/_components/Markdown.tsx
git commit -m "Add styled Markdown renderer for blog"
```

---

## Task 5: Blog index page (`/blog`)

**Files:**
- Create: `web/app/blog/page.tsx`

- [ ] **Step 1: Write the index page**

Matches the `/methodology` header treatment and `max-w-3xl` column. Lists posts newest-first.

```tsx
import type { Metadata } from "next";
import Link from "next/link";
import { getAllPosts } from "@/lib/blog";

export const metadata: Metadata = {
  title: "Blog",
  description:
    "Notes on independent AI safety testing, behavioral evaluation of MCP servers, and how Polygraph is built and funded.",
  alternates: { canonical: "/blog" },
  openGraph: {
    title: "Blog · polygraph.so",
    description:
      "Notes on independent AI safety testing and how Polygraph is built and funded.",
    url: "/blog",
    type: "website",
  },
};

function formatDate(iso: string): string {
  // Parse as UTC to avoid timezone drift; render e.g. "June 16, 2026".
  const d = new Date(`${iso}T00:00:00Z`);
  return d.toLocaleDateString("en-US", {
    year: "numeric",
    month: "long",
    day: "numeric",
    timeZone: "UTC",
  });
}

export default async function BlogIndexPage() {
  const posts = await getAllPosts();

  return (
    <main className="flex-1">
      <article className="mx-auto max-w-3xl px-6 pt-14 pb-24 md:pt-20 md:pb-32">
        <header className="mb-14">
          <p className="section-label mb-4">Blog · notes</p>
          <h1 className="font-serif text-4xl md:text-5xl text-ink tracking-tight leading-[1.05]">
            Blog
          </h1>
          <p className="mt-5 font-serif italic text-ink-muted text-lg md:text-xl leading-snug max-w-2xl">
            Notes on independent AI safety testing — how the polygraphs are built,
            graded, and funded.
          </p>
        </header>

        {posts.length === 0 ? (
          <p className="text-ink-muted">No posts yet.</p>
        ) : (
          <ul className="space-y-12">
            {posts.map((post) => (
              <li key={post.slug}>
                <p className="font-mono text-[11px] uppercase tracking-[0.18em] text-ink-faint tabular mb-2">
                  {formatDate(post.date)}
                </p>
                <h2 className="font-serif text-2xl md:text-3xl text-ink tracking-tight leading-tight">
                  <Link href={`/blog/${post.slug}`} className="hover:text-oxblood transition-colors">
                    {post.title}
                  </Link>
                </h2>
                <p className="mt-2 text-ink-muted leading-relaxed">{post.excerpt}</p>
                <p className="mt-3">
                  <Link
                    href={`/blog/${post.slug}`}
                    className="font-mono text-[11px] uppercase tracking-[0.18em] text-ink hover:text-oxblood transition-colors"
                  >
                    Read →
                  </Link>
                </p>
              </li>
            ))}
          </ul>
        )}
      </article>
    </main>
  );
}
```

> Confirm the `@/` import alias resolves (check `web/tsconfig.json` `paths`). If there is no `@` alias, use a relative import: `../../lib/blog`.

- [ ] **Step 2: Commit**

```bash
git add web/app/blog/page.tsx
git commit -m "Add /blog index page"
```

---

## Task 6: Post page (`/blog/[slug]`) + metadata + not-found

**Files:**
- Create: `web/app/blog/[slug]/page.tsx`
- Create: `web/app/blog/[slug]/not-found.tsx`

- [ ] **Step 1: Write the not-found component**

```tsx
import Link from "next/link";

export default function PostNotFound() {
  return (
    <main className="flex-1">
      <article className="mx-auto max-w-3xl px-6 pt-20 pb-32">
        <p className="section-label mb-4">404 · post not found</p>
        <h1 className="font-serif text-3xl md:text-4xl text-ink tracking-tight">
          That post doesn&apos;t exist
        </h1>
        <p className="mt-5">
          <Link
            href="/blog"
            className="font-mono text-[11px] uppercase tracking-[0.18em] text-ink hover:text-oxblood transition-colors"
          >
            ← Back to the blog
          </Link>
        </p>
      </article>
    </main>
  );
}
```

- [ ] **Step 2: Write the post page**

`params` is a Promise in Next 16 — it is awaited in both `generateStaticParams` consumers and `generateMetadata`.

```tsx
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { getAllPosts, getPost } from "@/lib/blog";
import { Markdown } from "../_components/Markdown";

const DEFAULT_OG = "/og.png";

export async function generateStaticParams() {
  const posts = await getAllPosts();
  return posts.map((p) => ({ slug: p.slug }));
}

function formatDate(iso: string): string {
  const d = new Date(`${iso}T00:00:00Z`);
  return d.toLocaleDateString("en-US", {
    year: "numeric",
    month: "long",
    day: "numeric",
    timeZone: "UTC",
  });
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const post = await getPost(slug);
  if (!post) return { title: "Post not found" };

  const url = `/blog/${post.slug}`;
  const image = post.ogImage ?? DEFAULT_OG;
  return {
    title: post.title,
    description: post.excerpt,
    alternates: { canonical: url },
    openGraph: {
      type: "article",
      title: post.title,
      description: post.excerpt,
      url,
      publishedTime: post.date,
      images: [{ url: image }],
    },
    twitter: {
      card: "summary_large_image",
      title: post.title,
      description: post.excerpt,
      images: [image],
    },
  };
}

export default async function BlogPostPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const post = await getPost(slug);
  if (!post) notFound();

  return (
    <main className="flex-1">
      <article className="mx-auto max-w-3xl px-6 pt-14 pb-24 md:pt-20 md:pb-32">
        <header className="mb-12">
          <p className="section-label mb-4">
            Blog · {formatDate(post.date)}
          </p>
          <h1 className="font-serif text-4xl md:text-5xl text-ink tracking-tight leading-[1.05]">
            {post.title}
          </h1>
        </header>

        <Markdown>{post.body}</Markdown>

        <footer className="mt-16 pt-8 border-t hairline">
          <Link
            href="/blog"
            className="font-mono text-[11px] uppercase tracking-[0.18em] text-ink hover:text-oxblood transition-colors"
          >
            ← All posts
          </Link>
        </footer>
      </article>
    </main>
  );
}
```

- [ ] **Step 3: Commit**

```bash
git add web/app/blog/\[slug\]/page.tsx web/app/blog/\[slug\]/not-found.tsx
git commit -m "Add /blog/[slug] post page with article metadata"
```

---

## Task 7: Site-wide default OG image

**Files:**
- Modify: `web/app/layout.tsx` (the `metadata.openGraph` and `metadata.twitter` objects)

- [ ] **Step 1: Add the default image to `openGraph`**

In `web/app/layout.tsx`, add an `images` array to the existing `openGraph` object (keep all existing fields):

```tsx
  openGraph: {
    title: "polygraph.so — behavioral polygraphs for AI agents",
    description:
      "We polygraph AI tools so you don't have to. A behavioral litmus test for MCP servers — a grade backed by evidence anyone can re-run.",
    url: "https://polygraph.so",
    siteName: "polygraph.so",
    locale: "en_US",
    type: "website",
    images: [{ url: "/og.png", width: 1200, height: 630 }],
  },
```

- [ ] **Step 2: Add the default image to `twitter`**

```tsx
  twitter: {
    card: "summary_large_image",
    title: "polygraph.so",
    description:
      "Behavioral polygraphs for AI agents and MCP servers — grades anyone can re-run. No graded party pays us.",
    images: ["/og.png"],
  },
```

- [ ] **Step 3: Commit**

```bash
git add web/app/layout.tsx
git commit -m "Add site-wide default OG/twitter image"
```

---

## Task 8: Footer Blog link

**Files:**
- Modify: `web/app/_components/Footer.tsx` (CLI column, above the Methodology link)

- [ ] **Step 1: Insert the Blog link**

In the CLI column, directly **above** the existing Methodology `<p>` block, add:

```tsx
            <p className="mt-3 font-sans text-[11.5px] leading-relaxed">
              <a
                className="text-ink hover:text-oxblood transition-colors"
                href="/blog"
              >
                Blog →
              </a>
            </p>
```

Then change the Methodology block's wrapper from `mt-3` to `mt-1.5` so the two links sit together (matching the existing API-docs/Methodology spacing rhythm):

```tsx
            <p className="mt-1.5 font-sans text-[11.5px] leading-relaxed">
              <a
                className="text-ink hover:text-oxblood transition-colors"
                href="/methodology"
              >
                Methodology →
              </a>
            </p>
```

- [ ] **Step 2: Commit**

```bash
git add web/app/_components/Footer.tsx
git commit -m "Add Blog link to footer"
```

---

## Task 9: Build + preview verification

**Files:** none (verification only)

- [ ] **Step 1: Production build**

Run from `web/`:
```bash
pnpm build
```
Expected: build succeeds. In the route list, `/blog` is static and `/blog/[slug]` is statically generated (the `open-source-needs-new-funding-mechanisms` path prerendered via `generateStaticParams`). No type errors.

- [ ] **Step 2: Preview the pages**

Start the preview server (preview_start), then:
- Load `/blog` → index shows the post (date, title link, excerpt).
- Click through to `/blog/open-source-needs-new-funding-mechanisms` → full article renders in preprint styling; headings are serif, links are styled, external links (Bankr, $POLYGRAPH, Telegram) open in new tabs.
- Load `/blog/does-not-exist` → not-found page renders.
- Check the footer shows **Blog →**; header nav is unchanged.
- Check console + network for errors (preview_console_logs, preview_network).

- [ ] **Step 3: Verify share metadata (view source)**

For `/blog/open-source-needs-new-funding-mechanisms`, confirm the HTML `<head>` contains:
- `<title>Open source needs new funding mechanisms · polygraph.so</title>`
- `og:title`, `og:description` (the excerpt), `og:type` = `article`, `og:url`, `article:published_time`, `og:image` = `…/og.png`
- `twitter:card` = `summary_large_image`, `twitter:image`

- [ ] **Step 4: Screenshot for the user**

Capture `/blog` and the post page (preview_screenshot) to share as proof.

- [ ] **Step 5: Final commit (if any verification fixes were needed)**

```bash
git add -A
git commit -m "Fix blog issues found during verification"
```

---

## Self-Review Notes

- **Spec coverage:** content storage (T2), data layer (T3), rendering (T4), index (T5), post + metadata (T6), site-wide OG (T7), footer nav (T8), content cleanup (T2), deps (T1), verification (T9). All spec sections covered.
- **Type consistency:** `PostMeta`/`Post`, `getAllPosts()`, `getPost()`, `<Markdown>` used identically across T3–T6.
- **No test framework:** intentional — repo has none; verification is build + preview + view-source, called out at top and in T9.
