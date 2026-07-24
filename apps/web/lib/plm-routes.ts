// AGT.3 — the PLM sub-app routes are Engineering/Quality screens that live at
// top-level routes (a unit / config / test / RCA / change is a first-class object,
// not a sub-page of a module). This ONE map is the source of truth for "which
// module owns this route", used by:
//   • the shell layout — module-enablement gating (disable Engineering ⇒ its PLM
//     routes go too), and
//   • the AgentPane — so each PLM surface inherits its OWNING module's agent
//     roster (Engineering for units/configs/blast-radius/changes, Quality for
//     tests/rca) instead of falling back to the general Axona agent.
export const PLM_ROUTE_MODULE: Record<string, string> = {
  units: "engineering",
  configurations: "engineering",
  "blast-radius": "engineering",
  changes: "engineering",
  tests: "quality",
  rca: "quality",
};

/** The owning module key for a pathname's top-level segment (PLM routes map to
 *  their owning module; everything else is its own segment; "" ⇒ core). */
export function owningModuleFor(pathname: string): string {
  const seg = pathname.split("/").filter(Boolean)[0] ?? "core";
  return PLM_ROUTE_MODULE[seg] ?? (seg === "" ? "core" : seg);
}
