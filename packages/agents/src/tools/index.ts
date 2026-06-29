// Typed tool registry (ART.2). The full registry over the data model, grouped by
// module, with the read / draft / gated category split.

export { registry, buildAgentDef, testDef } from "./registry";

export { coreTools, searchOperations, getModuleSummary } from "./core";
export {
  procurementTools,
  getPartStatus,
  listReorderCandidates,
  getSupplierRisk,
  draftPurchaseOrder,
  sendPurchaseOrder,
} from "./procurement";
export {
  qualityTools,
  runSpcCheck,
  listOpenNcrs,
  getCertStatus,
  openNcr,
} from "./quality";
export {
  engineeringTools,
  getEco,
  getCompatMatrix,
  draftEco,
  releaseEco,
} from "./engineering";
export {
  fieldServiceTools,
  getWorkOrder,
  findCertifiedTech,
  getSlaCountdown,
  routeTechnician,
} from "./field-service";
export {
  financeTools,
  getUnitEconomics,
  getArAging,
  recognizeRevenue,
  issueCreditNote,
} from "./finance";
export { inventoryTools, getStock } from "./inventory";
