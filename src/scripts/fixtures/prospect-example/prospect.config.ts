import type { ProspectConfig } from "@axona/db";

// PROSPECT.1 — the GENERIC, marque-free EXAMPLE prospect config. It is the template
// for a real prospect (copy it to an untracked prospects/<name>/prospect.config.ts
// and fill in the brand + tailored `seed()`), and the fixture verify-prospect-1 uses
// to prove the mechanism seeds a separate, ISOLATED org. Contains NO real company
// name — real prospect brands live only under the gitignored prospects/ dir.

const ORG_ID = "org_prospect_example";

const config: ProspectConfig = {
  orgId: ORG_ID,
  name: "Prospect Demo Co",
  slug: "prospect-demo-co",
  industry: "Robotics",
  // logoFile: "logo.png",  // (optional) an asset alongside this config → Org.logoKey
  demoUser: {
    name: "Demo Buyer",
    email: "demo@prospect-example.test",
    role: "ADMIN",
    password: "prospect-demo-2026!",
  },
  // The tailored data loader — over the EXISTING models, org-scoped by construction.
  // A real prospect seeds cells/inventory/SPC/NCR/ECO + its own EntityLink graph +
  // memory here (see docs/prospect-demo.md). This example seeds the minimum needed to
  // prove isolation.
  async seed({ db, orgId }) {
    // orgId is passed for the create input type; the org-scoped db re-injects it.
    await db.supplier.create({
      data: {
        orgId,
        name: "Example Supplier Co",
        tier: 2,
        riskScore: 0.2,
        onTimePct: 96.5,
      },
    });
    await db.nCR.create({
      data: {
        orgId,
        code: "PX-001",
        defect: "Example non-conformance (sample data — illustrative)",
        linkedTo: "example lot",
        severity: "MINOR",
        status: "OPEN",
      },
    });
  },
};

export default config;
