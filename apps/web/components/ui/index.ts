// DS.1 shared primitive library (token-driven; from the imported design system).
// FND.14 (data components) and FND.15 (agent primitives) extend these — not
// parallel one-offs.
export { Button } from "./Button";
export { Badge } from "./Badge";
export { Pill } from "./Pill";
export { MonoChip } from "./MonoChip";
export { Card } from "./Card";
// TABLE.1 — dense-table mechanics (scroll frame + frozen leading column).
export { DenseTable } from "./DenseTable";
export { FROZEN_CELL, FROZEN_PAIR, frozenCell } from "./dense-table-tokens";
export type { DensePad } from "./dense-table-tokens";
export { AgentGlyph } from "../agents/AgentGlyph";
export type { AgentTone } from "../agents/AgentGlyph";
