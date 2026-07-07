/**
 * PUT    /api/admin/twitter/[id] — update a thread (whole-thread save).
 * DELETE /api/admin/twitter/[id] — delete a thread.
 *
 * Gated by proxy.ts (/api/admin/*). Mirrors the publish route: validate, use
 * getSupabaseAdmin(), return JSON. Tweets are saved as a whole ordered array.
 */
import { getSupabaseAdmin } from "@/lib/supabase";
import type { TwitterThreadStatus, TwitterThreadTweet } from "@/lib/twitterThreads";

const STATUSES: TwitterThreadStatus[] = ["draft", "scheduled", "posted"];

// Build a whitelisted update patch from the request body. Returns an error
// string on the first invalid field, or the patch object.
function buildPatch(body: Record<string, unknown>): { patch: Record<string, unknown> } | { error: string } {
  const patch: Record<string, unknown> = {};

  if ("title" in body) {
    if (typeof body.title !== "string" || body.title.trim() === "" || body.title.length > 300) {
      return { error: "title must be a non-empty string ≤300 chars" };
    }
    patch.title = body.title;
  }

  if ("slug" in body) {
    if (typeof body.slug !== "string" || !/^[a-z0-9][a-z0-9-]{0,199}$/.test(body.slug)) {
      return { error: "slug must be kebab-case (a-z, 0-9, -)" };
    }
    patch.slug = body.slug;
  }

  if ("status" in body) {
    if (!STATUSES.includes(body.status as TwitterThreadStatus)) {
      return { error: `status must be one of ${STATUSES.join(", ")}` };
    }
    patch.status = body.status;
  }

  for (const key of ["scheduled_at", "posted_at"] as const) {
    if (key in body) {
      if (body[key] !== null && typeof body[key] !== "string") {
        return { error: `${key} must be an ISO string or null` };
      }
      patch[key] = body[key] === "" ? null : body[key];
    }
  }

  if ("tweets" in body) {
    const ok =
      Array.isArray(body.tweets) &&
      body.tweets.every((t) => {
        if (!t || typeof (t as { text?: unknown }).text !== "string") return false;
        const url = (t as { url?: unknown }).url;
        const posted = (t as { posted?: unknown }).posted;
        if (url != null && typeof url !== "string") return false;
        if (posted != null && typeof posted !== "boolean") return false;
        return true;
      });
    if (!ok) return { error: "tweets must be an array of { text, url?, posted? }" };
    patch.tweets = (body.tweets as { text: string; url?: string | null; posted?: boolean }[]).map(
      (t) => {
        const tweet: TwitterThreadTweet = { text: t.text };
        const url = typeof t.url === "string" ? t.url.trim() : "";
        if (url) tweet.url = url;
        if (t.posted) tweet.posted = true;
        return tweet;
      },
    );
  }

  for (const key of ["alt_text", "image_ref", "sources", "notes"] as const) {
    if (key in body) {
      if (body[key] !== null && typeof body[key] !== "string") {
        return { error: `${key} must be a string or null` };
      }
      patch[key] = body[key] === "" ? null : body[key];
    }
  }

  return { patch };
}

export async function PUT(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;

  let body: Record<string, unknown>;
  try {
    body = (await request.json()) as Record<string, unknown>;
  } catch {
    return Response.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const built = buildPatch(body);
  if ("error" in built) return Response.json({ error: built.error }, { status: 400 });

  const db = getSupabaseAdmin();
  if (!db) return Response.json({ error: "Database not configured" }, { status: 500 });

  const patch = built.patch;
  patch.updated_at = new Date().toISOString();
  // Stamp posted_at the first time a thread is marked posted (unless caller set it).
  if (patch.status === "posted" && !("posted_at" in patch)) {
    patch.posted_at = new Date().toISOString();
  }

  const { data, error } = await db
    .from("twitter_threads")
    .update(patch)
    .eq("id", id)
    .select("*")
    .maybeSingle();

  if (error) return Response.json({ error: error.message }, { status: 500 });
  if (!data) return Response.json({ error: "Thread not found" }, { status: 404 });
  return Response.json({ status: "saved", thread: data });
}

export async function DELETE(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;

  const db = getSupabaseAdmin();
  if (!db) return Response.json({ error: "Database not configured" }, { status: 500 });

  const { error } = await db.from("twitter_threads").delete().eq("id", id);
  if (error) return Response.json({ error: error.message }, { status: 500 });
  return Response.json({ status: "deleted", id });
}
