// SEAMS.1 — Seam (a): the SENSE-layer input surface. INTERFACE + POINTER ONLY —
// there is NO ingest, NO table, NO pipeline here, and none is built by this story.
// It documents the typed shape SENSE.1 will capture, so the Sense layer plugs into
// the Record spine without a retrofit (capture fidelity caps the moat).
//
// It mirrors the existing typed-telemetry pattern already in the schema — a
// `MachineSignal` (plant machine time-series) / `TelemetryPoint` (fleet robot
// time-series) is a {ts · metric · value} reading tied to a machine/robot. A
// `StationSignal` is the same shape tied to a UNIT AT A BUILD/TEST STATION (the
// Record spine): "what the line sensed about this unit at this station." The
// discrete `StationEvent` variant covers scans / vision captures / gate results.
//
// Station telemetry is NOT captured yet. SENSE.1 owns the real ingest + decides
// whether it lands as a table (extending TelemetryPoint's pattern) — NOT this story.
// If this seam ever seems to want a real table, that is SENSE.1's call, not ours.

/**
 * A continuous station SIGNAL — a metric reading at a build/test station, tied to
 * the unit on that station when known. Same shape as TelemetryPoint/MachineSignal,
 * keyed to a unit-at-station. (Sense-layer input · not captured yet · SENSE.1.)
 */
export interface StationSignal {
  /** The unit at the station, if identified (a scan may precede identification). */
  unitId?: string;
  /** The build/test station the signal came from (e.g. "A-14 press", "SBX-A rig"). */
  station: string;
  ts: Date;
  /** The measured characteristic (e.g. "press_force_kN", "reflow_temp_c"). */
  metric: string;
  value: number;
}

/**
 * A discrete station EVENT — something happened at a station (a scan, a vision
 * capture, an alarm, a gate pass/fail). `payload` stays open until SENSE.1 pins the
 * per-eventType shape. (Sense-layer input · not captured yet · SENSE.1.)
 */
export interface StationEvent {
  unitId?: string;
  station: string;
  ts: Date;
  /** e.g. "scan" · "vision_capture" · "gate_fail" · "alarm". */
  eventType: string;
  payload?: Record<string, unknown>;
}

/**
 * The SENSE-layer input surface: the continuous signal OR the discrete event. A
 * union so a future ingest (SENSE.1) can accept the whole station stream. This is
 * the SEAM — the typed contract — not a built pipeline.
 */
export type StationInput = StationSignal | StationEvent;
