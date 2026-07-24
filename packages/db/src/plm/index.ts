// PLM.1a — the Unit-spine core logic (L1 capture fidelity). resolveConfigAt +
// asBuiltDiff are pure over the org-scoped db; CSV import gives time-to-value.
// affectedUnits lives in @axona/agents (it reuses ONT.1 getBlastRadius, which
// depends on @axona/db — so it cannot live here without a cycle).
export {
  resolveConfigAt,
  asBuiltDiff,
  freezeConfigSnapshot,
  type ResolvedConfig,
  type ResolvedHwLine,
  type AsBuiltDiffResult,
  type AsBuiltDiffLine,
  type FrozenConfigSnapshot,
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
