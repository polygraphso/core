/**
 * POST   /api/admin/twitter/[id]/image — upload/replace a thread's showcase
 *        image (multipart FormData, field `file`). Stores it in the public
 *        `twitter-images` bucket keyed by thread id, and sets image_url +
 *        image_ref on the row.
 * DELETE /api/admin/twitter/[id]/image — remove the image and clear both cols.
 *
 * Gated by proxy.ts (/api/admin/*). Uses the service-role client, which
 * bypasses Storage RLS; the bucket is public so the URL renders without auth.
 */
import { getSupabaseAdmin } from "@/lib/supabase";

const BUCKET = "twitter-images";
const EXT_BY_MIME: Record<string, string> = {
  "image/png": "png",
  "image/jpeg": "jpg",
  "image/webp": "webp",
  "image/gif": "gif",
};
const MAX_BYTES = 10 * 1024 * 1024;

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;

  let form: FormData;
  try {
    form = await request.formData();
  } catch {
    return Response.json({ error: "Expected multipart form data" }, { status: 400 });
  }

  const file = form.get("file");
  if (!(file instanceof File)) {
    return Response.json({ error: "Missing file" }, { status: 400 });
  }
  const ext = EXT_BY_MIME[file.type];
  if (!ext) {
    return Response.json({ error: `Unsupported type ${file.type}` }, { status: 400 });
  }
  if (file.size > MAX_BYTES) {
    return Response.json({ error: "Image exceeds 10 MB" }, { status: 400 });
  }

  const db = getSupabaseAdmin();
  if (!db) return Response.json({ error: "Database not configured" }, { status: 500 });

  const key = `${id}.${ext}`;
  const buffer = Buffer.from(await file.arrayBuffer());
  const { error: upErr } = await db.storage
    .from(BUCKET)
    .upload(key, buffer, { contentType: file.type, upsert: true });
  if (upErr) return Response.json({ error: upErr.message }, { status: 500 });

  // Public URL + a cache-buster so replacing a same-key image shows the new one.
  const base = db.storage.from(BUCKET).getPublicUrl(key).data.publicUrl;
  const image_url = `${base}?v=${Date.now()}`;
  const image_ref = file.name || `showcase.${ext}`;

  const { data, error } = await db
    .from("twitter_threads")
    .update({ image_url, image_ref, updated_at: new Date().toISOString() })
    .eq("id", id)
    .select("*")
    .maybeSingle();

  if (error) return Response.json({ error: error.message }, { status: 500 });
  if (!data) return Response.json({ error: "Thread not found" }, { status: 404 });
  return Response.json({ status: "uploaded", thread: data });
}

export async function DELETE(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;

  const db = getSupabaseAdmin();
  if (!db) return Response.json({ error: "Database not configured" }, { status: 500 });

  // Remove any extension variant for this id (remove() ignores missing keys).
  await db.storage
    .from(BUCKET)
    .remove(Object.values(EXT_BY_MIME).map((ext) => `${id}.${ext}`));

  const { error } = await db
    .from("twitter_threads")
    .update({ image_url: null, image_ref: null, updated_at: new Date().toISOString() })
    .eq("id", id);
  if (error) return Response.json({ error: error.message }, { status: 500 });
  return Response.json({ status: "removed", id });
}
