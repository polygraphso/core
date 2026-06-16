import { ImageResponse } from "next/og";
import { Frame, OG_SIZE, OG_CONTENT_TYPE, OG_COLORS as C } from "../../_og/Frame";
import { ogFonts } from "../../_og/fonts";
import { getAllPosts, getPost } from "@/lib/blog";

export const alt = "polygraph.so blog post";
export const size = OG_SIZE;
export const contentType = OG_CONTENT_TYPE;

// Prerender + cache one card per post at build time (mirrors the page route).
export async function generateStaticParams() {
  const posts = await getAllPosts();
  return posts.map((p) => ({ slug: p.slug }));
}

function formatDate(iso: string): string {
  const d = new Date(`${iso}T00:00:00Z`);
  return d
    .toLocaleDateString("en-US", {
      year: "numeric",
      month: "long",
      day: "numeric",
      timeZone: "UTC",
    })
    .toUpperCase();
}

export default async function Image({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const post = await getPost(slug);
  const title = post?.title ?? "Blog";
  const eyebrow = post ? `BLOG · ${formatDate(post.date)}` : "BLOG";
  // Scale the headline down for longer titles so they stay on ~3 lines.
  const titleSize = title.length > 52 ? 60 : title.length > 32 ? 70 : 80;

  return new ImageResponse(
    (
      <Frame rightLabel="BLOG">
        <div
          style={{
            display: "flex",
            fontFamily: "IBM Plex Mono",
            fontSize: 15,
            letterSpacing: 3,
            color: C.oxblood,
            marginBottom: 26,
          }}
        >
          {eyebrow}
        </div>
        <div
          style={{
            display: "flex",
            fontFamily: "Source Serif 4",
            fontWeight: 600,
            fontSize: titleSize,
            lineHeight: 1.08,
            letterSpacing: -1,
            color: C.ink,
            maxWidth: 1010,
          }}
        >
          {title}
        </div>
      </Frame>
    ),
    { ...size, fonts: await ogFonts() },
  );
}
