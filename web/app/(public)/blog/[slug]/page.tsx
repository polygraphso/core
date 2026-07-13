import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { getAllSlugs, getPost } from "@/lib/blog";
import { Markdown } from "../_components/Markdown";
import { JsonLd } from "@/app/_components/JsonLd";
import { SITE_ORIGIN } from "@/lib/site";

export async function generateStaticParams() {
  // Include unlisted posts so their direct link still resolves; they're just
  // hidden from the index and sitemap and marked noindex (see below).
  const slugs = await getAllSlugs();
  return slugs.map((slug) => ({ slug }));
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

/** SERP snippets cut around 155 chars; trim at a word boundary so the excerpt
 *  reads whole instead of being ellipsized mid-sentence by Google. */
function metaDescription(excerpt: string): string {
  if (excerpt.length <= 155) return excerpt;
  return `${excerpt.slice(0, 152).replace(/\s+\S*$/, "")}…`;
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
  // og:image / twitter:image come from the colocated opengraph-image.tsx card.
  return {
    title: post.title,
    description: metaDescription(post.excerpt),
    alternates: { canonical: url },
    // Unlisted posts are shareable by link but kept out of search indexes.
    robots: post.unlisted ? { index: false, follow: false } : undefined,
    openGraph: {
      type: "article",
      title: post.title,
      description: metaDescription(post.excerpt),
      url,
      publishedTime: post.date,
    },
    twitter: {
      card: "summary_large_image",
      title: post.title,
      description: metaDescription(post.excerpt),
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

  // Article markup only for indexable posts — an unlisted post is noindex, and
  // structured data on a noindexed page is contradictory.
  const postJsonLd = post.unlisted
    ? null
    : {
        "@context": "https://schema.org",
        "@type": "BlogPosting",
        headline: post.title,
        description: post.excerpt,
        url: `${SITE_ORIGIN}/blog/${post.slug}`,
        mainEntityOfPage: `${SITE_ORIGIN}/blog/${post.slug}`,
        // Required for Article-family eligibility. The per-post OG card lives
        // at a build-hashed URL, so use the stable brand card instead.
        image: [`${SITE_ORIGIN}/brand/social-preview.png`],
        datePublished: post.date,
        dateModified: post.date,
        author: { "@id": `${SITE_ORIGIN}/#org` },
        publisher: { "@id": `${SITE_ORIGIN}/#org` },
      };

  const breadcrumbJsonLd = post.unlisted
    ? null
    : {
        "@context": "https://schema.org",
        "@type": "BreadcrumbList",
        itemListElement: [
          { "@type": "ListItem", position: 1, name: "polygraph.so", item: SITE_ORIGIN },
          { "@type": "ListItem", position: 2, name: "Blog", item: `${SITE_ORIGIN}/blog` },
          { "@type": "ListItem", position: 3, name: post.title },
        ],
      };

  return (
      <article className="mx-auto max-w-3xl">
        {postJsonLd && <JsonLd data={postJsonLd} />}
        {breadcrumbJsonLd && <JsonLd data={breadcrumbJsonLd} />}
        <header className="mb-12">
          <p className="section-label mb-4">Blog · {formatDate(post.date)}</p>
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
  );
}
