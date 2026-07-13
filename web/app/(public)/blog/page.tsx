import type { Metadata } from "next";
import Link from "next/link";
import { getAllPosts } from "@/lib/blog";
import { JsonLd } from "@/app/_components/JsonLd";
import { SITE_ORIGIN } from "@/lib/site";

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

  const blogJsonLd = {
    "@context": "https://schema.org",
    "@type": "Blog",
    name: "polygraph.so blog",
    url: `${SITE_ORIGIN}/blog`,
    description:
      "Notes on independent AI safety testing, behavioral evaluation of MCP servers, and how polygraph is built and funded.",
    publisher: { "@id": `${SITE_ORIGIN}/#org` },
    blogPost: posts.map((post) => ({
      "@type": "BlogPosting",
      headline: post.title,
      url: `${SITE_ORIGIN}/blog/${post.slug}`,
      datePublished: post.date,
    })),
  };

  return (
      <article className="mx-auto max-w-3xl">
        <JsonLd data={blogJsonLd} />
        <header className="mb-14">
          <p className="section-label mb-4">Blog · notes</p>
          <h1 className="font-serif text-4xl md:text-5xl text-ink tracking-tight leading-[1.05]">
            Blog
          </h1>
          <p className="mt-5 font-serif italic text-ink-muted text-lg md:text-xl leading-snug max-w-2xl">
            Notes on independent AI safety testing — how the polygraphs are
            built, graded, and funded.
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
                  <Link
                    href={`/blog/${post.slug}`}
                    className="hover:text-oxblood transition-colors"
                  >
                    {post.title}
                  </Link>
                </h2>
                <p className="mt-2 text-ink-muted leading-relaxed">
                  {post.excerpt}
                </p>
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
  );
}
