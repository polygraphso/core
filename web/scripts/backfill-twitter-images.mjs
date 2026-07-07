// One-time backfill: upload each thread's local twitter/<folder>/showcase.png
// into the public `twitter-images` Storage bucket (keyed by thread id) and set
// image_url + image_ref on the row. Idempotent (upsert). Skips threads with no
// local image. Run:
//   node --env-file=web/.env.local web/scripts/backfill-twitter-images.mjs
import { readFileSync, readdirSync, existsSync, statSync } from "node:fs";
import { join } from "node:path";

const url = process.env.SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!url || !key) throw new Error("missing SUPABASE_URL / SERVICE_ROLE_KEY");

const TWITTER_DIR = "/Users/rubendinis/Documents/Code/polygraphso/twitter";
const BUCKET = "twitter-images";
const auth = { apikey: key, Authorization: `Bearer ${key}` };

// slug -> local showcase image path (folder name is `<timestamp>_<slug>`).
const folders = readdirSync(TWITTER_DIR).filter((f) => {
  const p = join(TWITTER_DIR, f);
  return existsSync(p) && statSync(p).isDirectory();
});
function localImage(slug) {
  const folder = folders.find((f) => f.endsWith(`_${slug}`));
  if (!folder) return null;
  for (const [name, ext, mime] of [
    ["showcase.png", "png", "image/png"],
    ["showcase.jpg", "jpg", "image/jpeg"],
    ["showcase.jpeg", "jpg", "image/jpeg"],
  ]) {
    const p = join(TWITTER_DIR, folder, name);
    if (existsSync(p)) return { path: p, name, ext, mime };
  }
  return null;
}

const rows = await (
  await fetch(`${url}/rest/v1/twitter_threads?select=id,slug`, { headers: auth })
).json();

for (const { id, slug } of rows) {
  const img = localImage(slug);
  if (!img) {
    console.log(`skip  ${slug} (no local image)`);
    continue;
  }
  const objectPath = `${id}.${img.ext}`;
  const bytes = readFileSync(img.path);

  const up = await fetch(`${url}/storage/v1/object/${BUCKET}/${objectPath}`, {
    method: "POST",
    headers: { ...auth, "Content-Type": img.mime, "x-upsert": "true" },
    body: bytes,
  });
  if (!up.ok) {
    console.log(`FAIL  ${slug}: upload ${up.status} ${await up.text()}`);
    continue;
  }

  const image_url = `${url}/storage/v1/object/public/${BUCKET}/${objectPath}`;
  const patch = await fetch(`${url}/rest/v1/twitter_threads?id=eq.${id}`, {
    method: "PATCH",
    headers: { ...auth, "Content-Type": "application/json", Prefer: "return=minimal" },
    body: JSON.stringify({ image_url, image_ref: img.name }),
  });
  if (!patch.ok) {
    console.log(`FAIL  ${slug}: patch ${patch.status} ${await patch.text()}`);
    continue;
  }
  console.log(`ok    ${slug} → ${objectPath} (${(bytes.length / 1024).toFixed(0)} KB)`);
}
