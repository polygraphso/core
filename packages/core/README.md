# @polygraph/core

Shared data model, TypeScript types, and database migrations for the polygraph monorepo.

This package is the single source of truth for:

- **Postgres schema** — migrations live in `supabase/migrations/`.
- **Row types** — `src/types.ts` mirrors every table column-for-column.
- **Server identity** — `src/identity.ts` parses and formats `{registry}/{owner}/{name}@{version}` refs.

All other packages (`scoring`, `litmus`, `web`, `cli`) import from here. **No package redefines types locally; if a type is missing, add it here.**

## Migrations

```bash
# Apply locally via Supabase CLI
supabase db push --workdir packages/core
```

Each migration file is timestamped (`YYYYMMDDHHMMSS_description.sql`) and append-only — never edit a merged migration; add a new one.

Migration ownership follows the rule in `core-contracts.md`: **the package owning the table writes its migration**. Scoring owns `servers`/`versions`/`adoption_scores`/`runs`; litmus will add `behavioral_grades`; onboarding will add `users` and `alerts`.

Strategy and contract docs live outside this repo.
