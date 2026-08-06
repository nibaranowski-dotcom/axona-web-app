-- DEMO.7 §4 — index configurations and test runs too.
--
-- The first pass added the value-chain entities but left CONFIG_VERSION and TEST_RUN
-- out, so "what changed between <config A> and <config B>" — a question the
-- config-first run-of-show asks directly — still answered "neither exists in the
-- records for this tenant" about two seeded baselines. Same additive, enum-only shape
-- as the previous migration; the SearchDoc `tsv` generated column is untouched.
ALTER TYPE "SearchType" ADD VALUE IF NOT EXISTS 'CONFIG_VERSION';
ALTER TYPE "SearchType" ADD VALUE IF NOT EXISTS 'TEST_RUN';
