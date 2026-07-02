import Link from "next/link";

export default function PostNotFound() {
  return (
    <article className="mx-auto max-w-3xl">
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
  );
}
