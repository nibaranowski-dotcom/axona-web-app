// Presentation copy for module tiles. `Module` has no description column (no
// schema change), so one-line descriptions + a 1–2 char lettermark glyph live
// here, keyed by Module.key. mission-control (/) is the launcher itself — no tile.

export interface ModuleMeta {
  description: string;
  glyph: string;
}

export const moduleMeta: Record<string, ModuleMeta> = {
  core: { description: "Live snapshot across every module", glyph: "CC" },
  agents: { description: "Every module's agents in one roster", glyph: "AG" },
  workflows: { description: "Cross-module agent orchestrations", glyph: "WF" },
  projects: { description: "Workspaces with AI file matrices", glyph: "PR" },
  machines: {
    description: "Own plant & mobile equipment register",
    glyph: "MC",
  },
  search: { description: "Universal search across everything", glyph: "SE" },
  procurement: {
    description: "Agent-drafted sourcing → PO lifecycle",
    glyph: "PC",
  },
  manufacturing: {
    description: "Line execution + per-unit genealogy",
    glyph: "MF",
  },
  inventory: { description: "Stock, reorder, RMA, spares", glyph: "IN" },
  fulfillment: { description: "Delivery-as-a-project after QC", glyph: "FU" },
  quality: { description: "SPC vs spec + defect containment", glyph: "QA" },
  sales: {
    description: "Capital-equipment selling with ops feasibility",
    glyph: "SL",
  },
  marketing: { description: "Demand-gen feeding Sales", glyph: "MK" },
  fleet: { description: "Deployed robots as live assets", glyph: "FL" },
  "field-service": {
    description: "Triage → dispatch → beat the SLA clock",
    glyph: "FS",
  },
  engineering: {
    description: "Product definition + change control",
    glyph: "EN",
  },
  autonomy: {
    description: "Do robots do their jobs well & safely",
    glyph: "AU",
  },
  finance: { description: "Two revenue engines on one P&L", glyph: "FN" },
  people: { description: "Certification & competency management", glyph: "PE" },
  security: { description: "The connected-robot attack surface", glyph: "SC" },
  legal: {
    description: "Obligations vs live ops, export, liability",
    glyph: "LG",
  },
};

/** Fallback for a seeded key with no meta entry (verify flags the gap). */
export function metaFor(key: string, name: string): ModuleMeta {
  return (
    moduleMeta[key] ?? {
      description: name,
      glyph: name.slice(0, 2).toUpperCase(),
    }
  );
}
