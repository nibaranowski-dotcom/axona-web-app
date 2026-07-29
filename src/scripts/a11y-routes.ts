// A11Y.2 — the served-a11y route set. Config so adding a route is one line.
// Covers the a11y-sensitive surfaces: the public auth page, the dense shell,
// the audit trust surface (ReliabilityPanel), the PLM registry + detail + blast
// radius, an agent-pane-open surface, and a dense data table.

export interface A11yRoute {
  /** URL path to scan (a concrete serial for detail routes). */
  path: string;
  /** Human label in the report. */
  label: string;
  /** True → sign in first; false → scan logged-out (e.g. /login). */
  auth: boolean;
  /** Force the right agent pane open before scanning (agent surface coverage). */
  openAgentPane?: boolean;
  /** UX.14 — scan with the LEFT sidebar collapsed (the icon-only rail). */
  collapseSidebar?: boolean;
}

// One concrete serial for the PLM detail routes (the demo thread's hero unit).
export const A11Y_DETAIL_SERIAL = "SN-2208";

export const A11Y_ROUTES: A11yRoute[] = [
  { path: "/login", label: "Login (public auth page)", auth: false },
  { path: "/core", label: "Command Center (dense shell)", auth: true },
  {
    path: "/core",
    label: "Command Center — collapsed icon rail (UX.14)",
    auth: true,
    collapseSidebar: true,
  },
  {
    path: "/audit",
    label: "Audit trail (ReliabilityPanel)",
    auth: true,
  },
  { path: "/units", label: "Unit registry (dense table · PLM)", auth: true },
  {
    path: `/units/${A11Y_DETAIL_SERIAL}`,
    label: "Unit page (PLM detail)",
    auth: true,
  },
  { path: "/blast-radius", label: "Blast radius (PLM traversal)", auth: true },
  {
    path: "/configurations/CFG-HX2-r4.2",
    label: "Configuration detail (PLM.11 · baseline)",
    auth: true,
  },
  {
    path: "/changes",
    label: "Change orders list (PLM.12 · change queue)",
    auth: true,
  },
  {
    path: "/leads",
    label: "Leads triage (LEAD.1 · admin-gated)",
    auth: true,
  },
  {
    path: "/agents",
    label: "Agents (agent pane open)",
    auth: true,
    openAgentPane: true,
  },
  {
    path: "/procurement",
    label: "Procurement (dense PO queue)",
    auth: true,
  },
];

// A11Y.2 TRIAGE BASELINE — serious/critical violations that already existed on
// shipped screens when the served gate was stood up. Per the A11Y.2 PRD, standing
// up the gate must NOT block on a pre-existing sweep: entries here are accepted-
// for-now and become targeted per-route fix stories. The gate still FAILS on any
// serious/critical NOT listed here — it catches every regression and every new
// route, and the --selftest proves it's real. Burn this list down; never grow it.
//
// Keyed by (route path, axe rule id).
//
// EMPTY as of A11Y.3 — the 3 original entries (/units, /units/SN-2208,
// /blast-radius · color-contrast) were the functional-green `--success` token
// used as small status text; FIXED at the token level (darkened to AA), not
// triaged. Nothing is deferred.
export interface A11yBaselineEntry {
  path: string;
  rule: string;
  note: string;
}
export const A11Y_BASELINE: A11yBaselineEntry[] = [];
