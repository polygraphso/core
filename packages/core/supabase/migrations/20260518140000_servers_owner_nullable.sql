-- Allow unscoped npm packages (e.g. `npm/lodash`). PyPI and GitHub still
-- require owner; that's enforced at the parser layer, not the schema.
--
-- The unique constraint must use `nulls not distinct` (Postgres 15+) so two
-- unscoped npm rows with the same (registry, name) can't coexist — the
-- default treats NULL as distinct and would break the identity invariant.

alter table servers alter column owner drop not null;

alter table servers drop constraint servers_registry_owner_name_key;

alter table servers
  add constraint servers_registry_owner_name_key
  unique nulls not distinct (registry, owner, name);
