-- Bump the behavioral_grades.methodology_version default to litmus-v2.
--
-- The harness moved to litmus-v2 (C-02 probe 2.1 declared-permission
-- honesty + full-surface pagination; see polygraph-litmus docs and core
-- PR #39). Writers always pass an explicit methodology_version, so this
-- default is a backstop only — but on the public-grades table an insert
-- that omits it should label the current methodology, not a stale one.
--
-- Existing rows are untouched: a litmus-v1 grade stays litmus-v1 (those
-- grades remain valid; the version travels with the grade).

alter table behavioral_grades
  alter column methodology_version set default 'litmus-v2';
