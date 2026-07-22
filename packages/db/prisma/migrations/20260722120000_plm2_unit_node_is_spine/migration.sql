-- PLM.2 — reconcile the ontology's UNIT node onto the Unit spine.
--
-- Before PLM.1a a "unit" had no single identity: it was split across WorkOrderMfg
-- (the build record) and Robot (the deployed record). ONT.1 therefore pointed its
-- UNIT graph nodes at WorkOrderMfg ids, and every consumer that wanted the actual
-- unit had to bridge serial -> Unit itself. PLM.1a introduced Unit as the
-- first-class per-serial spine (and the billing meter), so the graph node for a
-- unit should BE that Unit — fixed once here rather than bridged on every screen.
--
-- Data-only migration (no DDL): repoint existing UNIT endpoints from the build
-- record to the Unit with the same serial in the same org. Rows whose serial has
-- no Unit are left untouched (nothing is dropped or invented). Idempotent — a
-- second run matches nothing because the ids no longer join to WorkOrderMfg.

UPDATE "EntityLink" el
SET "toId" = u."id"
FROM "WorkOrderMfg" w
JOIN "Unit" u ON u."serial" = w."serial" AND u."orgId" = w."orgId"
WHERE el."toType" = 'UNIT'
  AND el."toId" = w."id"
  AND el."orgId" = w."orgId";

UPDATE "EntityLink" el
SET "fromId" = u."id"
FROM "WorkOrderMfg" w
JOIN "Unit" u ON u."serial" = w."serial" AND u."orgId" = w."orgId"
WHERE el."fromType" = 'UNIT'
  AND el."fromId" = w."id"
  AND el."orgId" = w."orgId";
