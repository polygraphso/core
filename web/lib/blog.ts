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
