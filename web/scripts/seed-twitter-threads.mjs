// One-time seeder: parse the workspace twitter/<ts>_<slug>/ thread drafts into
// the twitter_threads table so they can be viewed/edited from Admin › Twitter.
//
// The admin runs on Vercel (read-only fs, can't read these files), so the DB is
// the home going forward — this just imports the current drafts once. It is
// insert-if-missing (keyed by slug), so re-running never clobbers edits made in
// the UI.
//
// Run from the core/ repo root:
//   node --env-file=web/.env.local web/scripts/seed-twitter-threads.mjs
// Optional arg: path to the twitter/ dir (defaults to the workspace twitter/).
//
// Needs SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY (both in web/.env.local).

import { promises as fs } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { createClient } from "@supabase/supabase-js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const TWITTER_DIR =
  process.argv[2] ?? path.resolve(__dirname, "../../../twitter");

const SEP = /^[-─═=_]{3,}\s*$/; // dashes, box ─ ═, =, underscores
const HEADER = /^\d+\/\d*\s*(?:\(\d+\))?\s*$/; // "1/5  (217)", "1/5", "1/"
const ALT_HEADER = /^IMAGE ALT TEXT/i;
const OTHER_SECTION = /^(SINGLE-TWEET ALT|LINKS|IMAGE)\b/i; // onchain-style extras

function clean(lines) {
  return lines
    .filter((l) => !SEP.test(l))
    .join("\n")
    .trim();
}

// Parse a thread.txt into { title, notes, tweets: [{text}], altText }.
// Tolerant: the regular "N/M (count)" + dashes format parses cleanly; the odd
// onchain draft (bare "N/" headers, ══ sections) parses best-effort. Anything
// unparseable is left for a human to fix in the editor.
function parseThread(txt) {
  const lines = txt.split(/\r?\n/);
  const title = (lines[0] ?? "").trim();

  const headerIdxs = [];
  lines.forEach((l, i) => {
    if (HEADER.test(l)) headerIdxs.push(i);
  });

  if (headerIdxs.length === 0) {
    // No tweet headers — dump the body as a single tweet for manual splitting.
    return { title, notes: "", tweets: [{ text: clean(lines.slice(1)) }], altText: "" };
  }

  const first = headerIdxs[0];
  const notes = clean(lines.slice(1, first));

  // Where the tweet region ends: the alt-text header or an onchain extra section.
  let altStart = -1;
  let regionEnd = lines.length;
  for (let i = first + 1; i < lines.length; i++) {
    if (ALT_HEADER.test(lines[i])) {
      altStart = i;
      regionEnd = i;
      break;
    }
    if (OTHER_SECTION.test(lines[i])) {
      regionEnd = i;
      break;
    }
  }

  const tweets = [];
  const inRegion = headerIdxs.filter((h) => h < regionEnd);
  inRegion.forEach((h, k) => {
    const end = k + 1 < inRegion.length ? inRegion[k + 1] : regionEnd;
    const text = clean(lines.slice(h + 1, end));
    if (text) tweets.push({ text });
  });

  const altText = altStart >= 0 ? clean(lines.slice(altStart + 1)) : "";

  return { title, notes, tweets, altText };
}

// "20260706-0900_mcp-security-index" → { slug, scheduledAt }
function parseFolderName(name) {
  const m = name.match(/^(\d{4})(\d{2})(\d{2})-(\d{2})(\d{2})_(.+)$/);
  if (!m) return { slug: name, scheduledAt: null };
  const [, y, mo, d, h, mi, slug] = m;
  return { slug, scheduledAt: `${y}-${mo}-${d}T${h}:${mi}:00+00:00` };
}

async function readIfExists(p) {
  try {
    return await fs.readFile(p, "utf8");
  } catch {
    return null;
  }
}

async function main() {
  const dry = process.env.DRY_RUN === "1";
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!dry && (!url || !key)) {
    console.error("Missing SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY (load web/.env.local).");
    process.exit(1);
  }
  const db = dry ? null : createClient(url, key, { auth: { persistSession: false } });

  const entries = await fs.readdir(TWITTER_DIR, { withFileTypes: true });
  const folders = entries
    .filter((e) => e.isDirectory() && /^\d{8}-\d{4}_/.test(e.name))
    .map((e) => e.name)
    .sort();

  if (folders.length === 0) {
    console.error(`No thread folders found in ${TWITTER_DIR}`);
    process.exit(1);
  }

  let existing = new Set();
  if (!dry) {
    const { data: existingRows, error: exErr } = await db
      .from("twitter_threads")
      .select("slug");
    if (exErr) {
      console.error("Failed to read existing slugs:", exErr.message);
      process.exit(1);
    }
    existing = new Set((existingRows ?? []).map((r) => r.slug));
  }

  let inserted = 0;
  let skipped = 0;
  for (const folder of folders) {
    const dir = path.join(TWITTER_DIR, folder);
    const { slug, scheduledAt } = parseFolderName(folder);
    if (existing.has(slug)) {
      console.log(`skip   ${slug} (already seeded)`);
      skipped++;
      continue;
    }

    const threadTxt = await readIfExists(path.join(dir, "thread.txt"));
    if (!threadTxt) {
      console.log(`skip   ${slug} (no thread.txt)`);
      skipped++;
      continue;
    }
    const parsed = parseThread(threadTxt);
    const sources = await readIfExists(path.join(dir, "sources.md"));

    const files = await fs.readdir(dir);
    const imageRef =
      files.find((f) => /^showcase\.(png|jpg|jpeg|txt)$/i.test(f)) ?? null;

    const row = {
      slug,
      title: parsed.title || slug,
      status: "draft",
      scheduled_at: scheduledAt,
      tweets: parsed.tweets,
      alt_text: parsed.altText || null,
      image_ref: imageRef,
      sources: sources ?? null,
      notes: parsed.notes || null,
    };

    if (dry) {
      console.log(`\n=== ${slug} (${parsed.tweets.length} tweets, img=${imageRef}) ===`);
      console.log(`title: ${row.title}`);
      parsed.tweets.forEach((t, i) =>
        console.log(`  [${i + 1}] ${t.text.slice(0, 70).replace(/\n/g, " ⏎ ")}…`),
      );
      console.log(`  alt: ${(row.alt_text ?? "").slice(0, 60).replace(/\n/g, " ")}…`);
      inserted++;
      continue;
    }

    const { error } = await db.from("twitter_threads").insert(row);
    if (error) {
      console.error(`FAIL   ${slug}: ${error.message}`);
      continue;
    }
    console.log(`insert ${slug} (${parsed.tweets.length} tweets)`);
    inserted++;
  }

  console.log(`\nDone. inserted=${inserted} skipped=${skipped} total=${folders.length}`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
