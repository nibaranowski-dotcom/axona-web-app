// PLM.1a — the Unit-spine core logic (L1 capture fidelity). resolveConfigAt +
// asBuiltDiff are pure over the org-scoped db; CSV import gives time-to-value.
// affectedUnits lives in @axona/agents (it reuses ONT.1 getBlastRadius, which
// depends on @axona/db — so it cannot live here without a cycle).
export {
  resolveConfigAt,
  asBuiltDiff,
  freezeConfigSnapshot,
  // PLM.11 — the Configuration manifest (resolved live / frozen at baseline).
  resolveConfigManifest,
  freezeConfigManifest,
  readConfigManifest,
  type ResolvedConfig,
  type ResolvedHwLine,
  type AsBuiltDiffResult,
  type AsBuiltDiffLine,
  type FrozenConfigSnapshot,
  type ConfigManifest,
  type ConfigHwPosition,
  type ConfigSwItem,
} from "./config";
export {
  importUnits,
  importBom,
  type ImportResult,
  type RowError,
} from "./import";
export {
  captureAsBuilt,
  type CaptureInput,
  type CaptureResult,
} from "./capture";
export {
  recordFieldModification,
  applyFieldModification,
  rejectFieldModification,
  effectLabel,
  type FieldModChange,
  type RecordFieldModInput,
  type RecordFieldModResult,
  type ApplyFieldModResult,
} from "./field-modification";
// SEAMS.1 — Predict-layer substrate (read-only) + Sense-layer input seam (types only).
export {
  unitOutcomes,
  type UnitOutcome,
  type UnitOutcomeKind,
} from "./outcomes";
export {
  type StationSignal,
  type StationEvent,
  type StationInput,
} from "./sense-seam";
