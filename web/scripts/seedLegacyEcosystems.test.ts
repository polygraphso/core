/**
 * One-off seed: import the six legacy indices' arrays and write them into the
 * ecosystems / ecosystem_entries tables, so the pre-DB ecosystems appear in the
 * management dashboard and their loaders switch from the hardcoded arrays to the DB.
 *
 * Run once (idempotent) against prod:
 *   set -a && source web/.env.local && set +a
 *   RUN_SEED=1 npx vitest run scripts/seedLegacyEcosystems.test.ts
 *
 * It only refreshes SEEDED rows (added_by = null); entries a member added through the
 * dashboard are never touched. Skipped in the normal suite (guarded by RUN_SEED). It
 * is a vitest file, not a plain script, because vitest resolves the `@/` alias and
 * stubs `server-only`, which a bare `tsx` run cannot.
 */

import { describe, it } from "vitest";
import { createClient } from "@supabase/supabase-js";
import { LEGACY_ECOSYSTEMS } from "@/lib/legacyEcosystems";

const RUN = process.env.RUN_SEED === "1";

describe("seed legacy ecosystems", () => {
  it.skipIf(!RUN)(
    "upserts the six legacy indices into the DB",
    async () => {
      const url = process.env.SUPABASE_URL;
      const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
      if (!url || !key) throw new Error("SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY not set");
      const db = createClient(url, key, { auth: { persistSession: false } });

      for (const eco of LEGACY_ECOSYSTEMS) {
        // Legacy pages stay bespoke + noindex and the hub renders them from the
        // static list, so keep the DB row unlisted (public so the console link works).
        const settings = {
          name: eco.name,
          blurb: eco.blurb,
          page_config: eco.page_config,
          is_public: true,
          is_listed: false,
          noindex: true,
        };

        const { data: existing } = await db
          .from("ecosystems")
          .select("id")
          .eq("slug", eco.slug)
          .maybeSingle();

        let ecosystemId: string;
        if (existing?.id) {
          ecosystemId = existing.id as string;
          const { error } = await db.from("ecosystems").update(settings).eq("id", ecosystemId);
          if (error) throw error;
        } else {
          const { data, error } = await db
            .from("ecosystems")
            .insert({ slug: eco.slug, ...settings })
            .select("id")
            .single();
          if (error) throw error;
          ecosystemId = data.id as string;
        }

        // Refresh only seeded rows; leave member-added entries (added_by set) intact.
        const { error: delErr } = await db
          .from("ecosystem_entries")
          .delete()
          .eq("ecosystem_id", ecosystemId)
          .is("added_by", null);
        if (delErr) throw delErr;

        const inserts = eco.entries.map((e) => ({
          ecosystem_id: ecosystemId,
          target: e.target,
          target_kind: e.target_kind,
          cohort: e.cohort,
          featured: e.featured,
          position: e.position,
          metadata: e.metadata,
        }));
        for (let i = 0; i < inserts.length; i += 200) {
          const { error } = await db.from("ecosystem_entries").insert(inserts.slice(i, i + 200));
          if (error) throw error;
        }
        // eslint-disable-next-line no-console
        console.log(`seeded ${eco.slug}: ${eco.entries.length} entries`);
      }
    },
    180_000,
  );
});
