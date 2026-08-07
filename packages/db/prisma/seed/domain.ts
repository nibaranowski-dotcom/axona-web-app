import { d } from "./constants";
import type { DomainDb, DomainPack, DomainSeedOpts } from "./domain-pack";
import { seedMachines } from "./machines";
import { seedIntegrations } from "./integrations";
import { seedBilling } from "./billing";

// SEED.5 — the pack-driven tenant BACKDROP.
//
// `seedTenantModules` (the old shared base) is still exported for tenants that opt into
// it, but it is no longer forced onto every prospect: it hardcodes ONE industry's
// vocabulary, and a demo tenant must carry only its own domain. This is the same
// cross-module richness, generated from a `DomainPack` instead.
//
// DIVISION OF LABOUR with the prospect config:
//   • the CONFIG owns the tenant's HERO records — the golden thread the demo walks
//     (its units, its PLM chain, the hero PO, the fault loop, its agents).
//   • this owns the BACKDROP — the surrounding rows that make every OTHER module
//     screen read as populated rather than half-empty.
// Call it AFTER the config's own rows: `/procurement` orders POs by id (insertion
// order), so the hero PO must be written first or it sinks under the filler. That
// ordering is the entire reason the hero PO used to sit at row 15 of 19.
//
// Every code is prefixed with the caller's `prefix`, so two tenants never collide and
// no row can be mistaken for another tenant's. Writes go through the org-scoped `db`,
// so isolation holds by construction.
//
// DELIBERATELY NOT SEEDED (owned elsewhere, same exclusions as the old base): users,
// agents, PLM + ontology, memory/calibration/trust.

export interface DomainSeedResult {
  suppliers: number;
  parts: number;
  purchaseOrders: number;
  robots: number;
  projects: number;
  workflows: number;
}

/** Deterministic pseudo-random in [0,1) — stable output, no Math.random. */
function rnd(seed: number): number {
  const x = Math.sin(seed * 12.9898) * 43758.5453;
  return x - Math.floor(x);
}

const PO_STATUSES = [
  "SENT",
  "RECEIVED",
  "APPROVED",
  "DRAFTED",
  "AWAITING_APPROVAL",
] as const;

const DEAL_STAGES = [
  "QUALIFY",
  "DEMO",
  "PROPOSAL",
  "NEGOTIATION",
  "COMMIT",
] as const;

const DELIVERY_STAGES = [
  "ALLOC",
  "CRATE",
  "FREIGHT",
  "CUSTOMS",
  "ONSITE",
  "COMMISSION",
  "ACTIVE",
] as const;

/**
 * Seed one tenant's cross-module backdrop from its domain pack.
 * `db` must already be org-scoped (`dbForOrg(orgId)`).
 */
export async function seedDomainModules(
  db: DomainDb,
  orgId: string,
  pack: DomainPack,
  opts: DomainSeedOpts,
): Promise<DomainSeedResult> {
  const P = opts.prefix;
  const serialBase = opts.serialBase ?? 4100;
  const code = (kind: string, n: number | string): string =>
    `${kind}-${P}-${n}`;

  // ── suppliers · parts · stock ────────────────────────────────────────────────
  // Reuse a supplier the CONFIG already created rather than adding a near-duplicate:
  // the backdrop runs after the config, and a vendor list showing the same name twice
  // reads as a data-quality bug on the screen it is supposed to make look populated.
  const suppliers = [];
  for (const s of pack.suppliers) {
    const existing = await db.supplier.findFirst({
      where: { name: s.name },
      select: { id: true },
    });
    suppliers.push(existing ?? (await db.supplier.create({ data: { ...s } })));
  }

  const parts = [];
  for (const p of pack.parts) {
    parts.push(
      await db.part.create({
        data: {
          sku: `${P}-${p.sku}`,
          name: p.name,
          onHand: p.onHand,
          reorderPoint: p.reorderPoint,
          leadDays: p.leadDays,
          dailyUse: 1 + (p.reorderPoint % 4),
        },
      }),
    );
  }

  // Stock across the four inventory kinds so /inventory's location board fills out,
  // including one edge cache deliberately BELOW min (the "replenish" state the screen
  // is built to surface).
  const stockKinds = [
    "CENTRAL",
    "LINE_SIDE",
    "EDGE_CACHE",
    "FINISHED_GOODS",
  ] as const;
  await db.inventoryStock.createMany({
    data: parts.flatMap((part, i) => {
      const spec = pack.parts[i]!;
      return stockKinds.map((kind, k) => {
        const onHand =
          kind === "EDGE_CACHE" && i % 5 === 0
            ? Math.max(0, spec.reorderPoint - 4) // below min on purpose
            : Math.round(spec.onHand / (k + 1));
        return {
          partId: part.id,
          location:
            kind === "CENTRAL"
              ? "Central warehouse"
              : kind === "LINE_SIDE"
                ? "Line-side"
                : kind === "EDGE_CACHE"
                  ? pack.sites[k % pack.sites.length]!
                  : "Finished goods",
          kind,
          onHand,
          reserved: Math.round(onHand * 0.2),
          minLevel: Math.round(spec.reorderPoint / 2),
          valueUsd: onHand * (400 + i * 65),
        };
      });
    }),
  });

  // ── purchase orders — a populated queue across vendors/statuses/values ───────
  const poRows = parts.map((part, i) => {
    const status = PO_STATUSES[i % PO_STATUSES.length]!;
    const qty = 8 + ((i * 7) % 44);
    return {
      code: code("PO", 7100 + i),
      supplierId: suppliers[i % suppliers.length]!.id,
      partId: part.id,
      qty,
      value: Math.round(qty * (620 + i * 145)),
      status,
      eta:
        status === "RECEIVED" ? d(`-${3 + (i % 9)}d`) : d(`+${7 + (i % 30)}d`),
      receivedAt: status === "RECEIVED" ? d(`-${2 + (i % 7)}d`) : null,
    };
  });
  await db.purchaseOrder.createMany({ data: poRows });

  // ── manufacturing: work orders spread across the line's stations ────────────
  // The station list is the manufacturing board's COLUMNS, so it must be the one the
  // config already uses — otherwise the board grows a second set of near-identical
  // columns ("Arm assembly" beside "Arm Assembly"). A config that seeds its own work
  // orders passes its own stations; the pack's are the fallback.
  const stations = opts.stations?.length ? opts.stations : pack.stations;
  // The app computes off these EXACT tokens (e.g. /core counts status "WIP"), so the
  // backdrop must speak the same vocabulary as the base — invented sentence-case
  // strings render a populated board while every KPI over it reads zero.
  const woStatuses = ["WIP", "PAUSED", "WIP", "DONE"];
  await db.workOrderMfg.createMany({
    data: Array.from({ length: 18 }, (_, i) => ({
      serial: `SN-${P}-${serialBase + i}`,
      product: pack.productLabel,
      station: stations[i % stations.length]!,
      status: woStatuses[i % woStatuses.length]!,
      startedAt: d(`-${1 + (i % 12)}d`),
    })),
  });

  // ── quality: the SPC run that breaches, plus NCRs from the pack's defects ────
  const { characteristic, ucl, lcl, mean, values } = pack.spc;
  const spcSerial = `${P}-${pack.parts[0]!.sku}`;
  await db.spcSample.createMany({
    data: values.map((value, i) => ({
      characteristic,
      serial: spcSerial,
      value,
      ucl,
      lcl,
      mean,
      ts: d(`-${values.length - i}d`),
    })),
  });

  const ncrStatuses = ["OPEN", "REVIEW", "CONTAINED", "CLOSED"];
  await db.nCR.createMany({
    data: Array.from({ length: 10 }, (_, i) => {
      const def = pack.defects[i % pack.defects.length]!;
      return {
        code: code("NCR", 300 + i),
        defect: def.defect,
        linkedTo: `SN-${P}-${serialBase + ((i * 3) % 18)}`,
        severity: def.severity,
        status: ncrStatuses[i % ncrStatuses.length]!,
      };
    }),
  });

  for (const c of pack.certs) {
    await db.cert.create({
      data: {
        name: c.name,
        scope: c.scope,
        validTo: d(`+${3 + pack.certs.indexOf(c) * 2}m`),
        status: "VALID",
      },
    });
  }

  // ── commercial: deals · campaigns · deliveries ───────────────────────────────
  await db.deal.createMany({
    data: pack.deals.map((deal, i) => ({
      account: pack.customers[i % pack.customers.length]!,
      config: deal.config,
      value: deal.value,
      stage: DEAL_STAGES[i % DEAL_STAGES.length]!,
      closeDate: d(`+${2 + (i % 5)}m`),
      feasibility: i % 4 === 0 ? "AT_RISK" : "ON_TIME",
    })),
  });

  await db.campaign.createMany({
    data: pack.campaigns.map((c, i) => ({
      name: c.name,
      channel: c.channel,
      mqls: 40 + i * 23,
      pipeline: 180_000 + i * 96_000,
      roi: Number((1.8 + rnd(i + 1) * 2.4).toFixed(1)),
      status: i % 3 === 0 ? "PAUSED" : "ACTIVE",
    })),
  });

  await db.delivery.createMany({
    data: Array.from({ length: 9 }, (_, i) => ({
      code: code("DLV", 3200 + i),
      account: pack.customers[i % pack.customers.length]!,
      destination: pack.sites[i % pack.sites.length]!,
      units: String(1 + (i % 6)),
      stage: DELIVERY_STAGES[i % DELIVERY_STAGES.length]!,
      committedDate: d(`+${4 + i * 3}d`),
      etaDate: d(`+${5 + i * 3}d`),
      riskState: i % 5 === 0 ? "supplier delay" : "on-track",
    })),
  });

  // ── fleet: robots + telemetry ────────────────────────────────────────────────
  const robots = [];
  for (let i = 0; i < 14; i++) {
    robots.push(
      await db.robot.create({
        data: {
          serial: `SN-${P}-${serialBase + 200 + i}`,
          model: pack.fleet.model,
          customer: pack.customers[i % pack.customers.length]!,
          site: pack.sites[i % pack.sites.length]!,
          uptimePct: Number((94 + rnd(i + 3) * 5.5).toFixed(1)),
          firmware: pack.fleet.firmwares[i % pack.fleet.firmwares.length]!,
          status: i % 7 === 0 ? "WATCH" : "ACTIVE",
          lat: 50 + rnd(i + 5) * 6,
          lng: 4 + rnd(i + 9) * 16,
        },
      }),
    );
  }
  await db.telemetryPoint.createMany({
    data: robots.flatMap((r, i) =>
      Array.from({ length: 5 }, (_, k) => ({
        robotId: r.id,
        ts: d(`-${(k + 1) * 6}h`),
        metric: k % 2 === 0 ? "throughput" : "uptime",
        value: Number((70 + rnd(i * 10 + k) * 30).toFixed(1)),
      })),
    ),
  });

  // ── field service: technicians + a dispatch board ────────────────────────────
  const certKeys = pack.certs.map((c) => c.name);
  const techs = [];
  for (let i = 0; i < 6; i++) {
    const name = `Tech ${String.fromCharCode(65 + i)}.`;
    techs.push(
      await db.technician.create({
        data: {
          name,
          initials: `T${String.fromCharCode(65 + i)}`,
          site: pack.sites[i % pack.sites.length]!,
          status: i % 4 === 0 ? "ON_SITE" : "AVAILABLE",
          certs: Object.fromEntries(
            certKeys.map((k, j) => [
              k,
              {
                state: (i + j) % 5 === 0 ? "expiring" : "valid",
                expiresAt: d(`+${2 + ((i + j) % 9)}m`).toISOString(),
              },
            ]),
          ),
        },
      }),
    );
  }

  const woSeverities = ["MINOR", "MAJOR", "CRITICAL"] as const;
  await db.workOrderField.createMany({
    data: Array.from({ length: 9 }, (_, i) => ({
      code: code("WO", 5600 + i),
      robotSerial: robots[i % robots.length]!.serial,
      site: pack.sites[i % pack.sites.length]!,
      issue: pack.fleet.issues[i % pack.fleet.issues.length]!,
      slaDueAt: d(`+${2 + (i % 20)}h`),
      techId: techs[i % techs.length]!.id,
      status: i % 3 === 0 ? "DISPATCH" : i % 3 === 1 ? "EN_ROUTE" : "OPEN",
      severity: woSeverities[i % woSeverities.length]!,
    })),
  });

  // ── engineering: ECOs (+reviewers) · firmware · compat matrix ────────────────
  const ecoStages = ["DRAFTED", "REVIEW", "APPROVED", "RELEASED"];
  for (let i = 0; i < pack.ecos.length; i++) {
    const spec = pack.ecos[i]!;
    const eco = await db.eCO.create({
      data: {
        code: code("ECO", 400 + i),
        title: spec.title,
        changeType: spec.changeType,
        affected: `${P}-${spec.affected}`,
        stage: ecoStages[i % ecoStages.length]!,
        effectiveFromSerial: `SN-${P}-${serialBase + 200 + i}`,
        effectiveFromDate: d(`+${5 + i * 4}d`),
      },
    });
    if (i < 3) {
      await db.ecoReviewer.create({
        data: {
          ecoId: eco.id,
          userId: opts.adminUserId,
          label: i === 0 ? "Engineering" : i === 1 ? "Quality" : "Supply chain",
          state: i === 0 ? "approved" : "pending",
        },
      });
    }
  }

  await db.firmwareRelease.createMany({
    data: pack.fleet.firmwares.map((version, i) => ({
      version,
      note:
        i === pack.fleet.firmwares.length - 1
          ? "Current release"
          : "Superseded",
      state: i === pack.fleet.firmwares.length - 1 ? "RELEASED" : "RC",
    })),
  });

  await db.compatCell.createMany({
    data: pack.compat.hwRevs.flatMap((hwRev, i) =>
      pack.compat.fwVersions.map((fwVersion, k) => ({
        hwRev,
        fwVersion,
        state:
          k === pack.compat.fwVersions.length - 1
            ? "in-test"
            : i + k < 2
              ? "cert"
              : "compatible",
      })),
    ),
  });

  // ── autonomy · safety · policy ───────────────────────────────────────────────
  await db.autonomyMetric.createMany({
    data: pack.sites.flatMap((site, i) =>
      Array.from({ length: 6 }, (_, k) => ({
        site,
        ts: d(`-${(6 - k) * 7}d`),
        autonomyRate: Number((0.86 + k * 0.018 + rnd(i + k) * 0.02).toFixed(3)),
        takeoversPer1k: Number((14 - k * 1.4 + rnd(i * 3 + k) * 2).toFixed(1)),
        policyVersion: `p-${20 + i}`,
      })),
    ),
  });

  await db.safetyIncident.createMany({
    data: pack.fleet.incidentTypes.map((type, i) => ({
      code: code("INC", 200 + i),
      type,
      robotSerial: robots[i % robots.length]!.serial,
      site: pack.sites[i % pack.sites.length]!,
      severity: woSeverities[i % woSeverities.length]!,
      status: i % 2 === 0 ? "CLOSED" : "OPEN",
    })),
  });

  await db.policyVersion.createMany({
    data: Array.from({ length: 3 }, (_, i) => ({
      version: `p-${20 + i}`,
      note: i === 2 ? "Current operating policy" : "Superseded",
      state: i === 2 ? "current" : "standby",
    })),
  });

  // ── back office: ledger · invoices · unit economics · hiring · risk · legal ──
  const periods = ["2026-Q1", "2026-Q2", "2026-Q3", "2026-Q4"];
  await db.ledgerEntry.createMany({
    data: periods.flatMap((period, i) =>
      pack.ledgerAccounts.map((account, k) => ({
        period,
        account,
        amount: Math.round(
          (k < 2 ? 1 : -1) * (120_000 + k * 38_000 + i * 24_000),
        ),
        kind: k < 2 ? "revenue" : "cost",
      })),
    ),
  });

  const invStatuses = ["PAID", "OPEN", "OVERDUE", "OPEN"];
  await db.invoice.createMany({
    data: Array.from({ length: 6 }, (_, i) => ({
      // 8800+ deliberately: a config's own hero invoices live in the 77xx range and
      // the backdrop collided with one the 3-way match cites by code.
      code: code("INV", 8800 + i),
      account: pack.customers[i % pack.customers.length]!,
      source: i % 2 === 0 ? "Delivery" : "Service",
      amount: 48_000 + i * 27_500,
      terms: i % 2 === 0 ? "Net 30" : "Net 60",
      dueDate: d(`${i % 3 === 2 ? "-" : "+"}${5 + i * 4}d`),
      status: invStatuses[i % invStatuses.length]!,
    })),
  });

  await db.unitEconomic.createMany({
    data: pack.unitEconomics.map((u) => ({
      product: u.product,
      asp: u.asp,
      cogs: u.cogs,
      marginPct: Number((((u.asp - u.cogs) / u.asp) * 100).toFixed(1)),
      trend: u.trend,
    })),
  });

  await db.requisition.createMany({
    data: pack.hiringRoles.map((role, i) => ({
      role,
      filled: 1 + (i % 4),
      target: 3 + (i % 3),
    })),
  });

  await db.cVE.createMany({
    data: Array.from({ length: 6 }, (_, i) => ({
      code: `CVE-2026-${4100 + i * 7}`,
      severity: woSeverities[i % woSeverities.length]!,
      affectedUnits: 2 + i * 3,
      status: i % 3 === 0 ? "MITIGATED" : "TRIAGE",
    })),
  });

  await db.obligation.createMany({
    data: pack.obligations.map((o, i) => ({
      account: pack.customers[i % pack.customers.length]!,
      obligation: o.obligation,
      actual: o.actual,
      state: i === 2 ? "AT_RISK" : "MET",
    })),
  });

  await db.exportLicense.createMany({
    data: pack.exportDestinations.map((destination, i) => ({
      destination,
      code: code("EXP", 900 + i),
      state: i % 3 === 0 ? "PENDING" : "CLEAR",
    })),
  });

  await db.legalMatter.createMany({
    data: pack.legalMatters.map((m, i) => ({
      type: m.type,
      title: m.title,
      linkedTo: pack.customers[i % pack.customers.length]!,
      status: i % 3 === 0 ? "OPEN" : "FILED",
    })),
  });

  // ── workspace: projects (+matrix columns) · machines · workflows ─────────────
  const projectStatuses = ["ACTIVE", "ACTIVE", "IN_REVIEW", "BLOCKED"] as const;
  const projects = [];
  for (let i = 0; i < pack.projects.length; i++) {
    const spec = pack.projects[i]!;
    projects.push(
      await db.project.create({
        data: {
          moduleKey: spec.moduleKey,
          name: spec.name,
          description: spec.description,
          status: projectStatuses[i % projectStatuses.length]!,
          members: [{ id: opts.adminUserId, role: "owner" }],
        },
      }),
    );
  }
  // Matrix columns hang off the sourcing project — the extraction grid MTX.1 renders.
  const sourcing = projects[0]!;
  for (const question of pack.matrixQuestions) {
    await db.matrixColumn.create({
      data: { projectId: sourcing.id, question, createdBy: opts.adminUserId },
    });
  }

  // Machines are domain-NEUTRAL in the base generator (CNC/AMR/test-rig assets read
  // the same in any plant), so reuse it rather than duplicate a parallel dataset.
  await seedMachines(db);

  const workflows = [];
  for (let i = 0; i < pack.workflows.length; i++) {
    const spec = pack.workflows[i]!;
    const wf = await db.workflow.create({
      data: {
        moduleKey: spec.moduleKey,
        name: spec.name,
        description: spec.description,
        status: i === pack.workflows.length - 1 ? "DRAFT" : "ACTIVE",
        trigger: {
          type: i % 2 === 0 ? "schedule" : "event",
          spec: spec.moduleKey,
        },
        steps: [
          { id: "s1", kind: "agent", label: "Gather evidence" },
          { id: "s2", kind: "agent", label: "Draft proposal" },
          { id: "s3", kind: "gate", label: "Human approval" },
          { id: "s4", kind: "output", label: "Record outcome" },
        ],
      },
    });
    workflows.push(wf);
    await db.workflowRun.createMany({
      data: Array.from({ length: 2 }, (_, k) => ({
        workflowId: wf.id,
        status: k === 0 ? "SUCCEEDED" : "RUNNING",
        trace: [
          { step: "s1", state: "done" },
          { step: "s2", state: k === 0 ? "done" : "running" },
        ],
        startedAt: d(`-${2 + i * 2 + k}d`),
        endedAt: k === 0 ? d(`-${1 + i * 2}d`) : null,
      })),
    });
  }

  // ── cross-cutting: notifications · integrations · SaaS billing · audit ──────
  await db.notification.createMany({
    data: [
      {
        userId: null,
        type: "APPROVAL",
        title: "Purchase order awaiting approval",
        body: `${code("PO", 7104)} needs a decision before the lead-time window closes.`,
        targetType: "PurchaseOrder",
        targetId: code("PO", 7104),
        url: "/procurement",
      },
      {
        userId: null,
        type: "EXCEPTION",
        title: "SPC characteristic over control limit",
        body: `${characteristic} breached UCL on the latest run.`,
        targetType: "SpcSample",
        targetId: spcSerial,
        url: "/quality",
      },
      {
        userId: null,
        type: "EXCEPTION",
        title: "Field work order approaching SLA",
        body: `${code("WO", 5600)} is inside its response window.`,
        targetType: "WorkOrderField",
        targetId: code("WO", 5600),
        url: "/field-service",
      },
      {
        userId: null,
        type: "RUN",
        title: "Engineering change moved to review",
        body: `${code("ECO", 401)} is awaiting reviewer sign-off.`,
        targetType: "ECO",
        targetId: code("ECO", 401),
        url: "/changes",
      },
      {
        userId: null,
        type: "SYSTEM",
        title: "Delivery entered customs",
        body: `${code("DLV", 3203)} is clearing customs.`,
        targetType: "Delivery",
        targetId: code("DLV", 3203),
        url: "/fulfillment",
      },
    ],
  });

  // Integrations and SaaS billing carry NO domain vocabulary — an API key and a
  // subscription invoice read the same on any tenant — so reuse the base generators
  // rather than fork a parallel dataset. (`billing.ts`'s "AX-2026-00n" is Axona's own
  // invoice numbering, not a product designation.)
  await seedIntegrations(db, orgId, opts.adminUserId);
  await seedBilling(db, orgId);

  await db.auditLog.createMany({
    data: [
      {
        actorType: "AGENT",
        actorLabel: "Sourcing agent",
        action: "po.draft",
        targetType: "PurchaseOrder",
        targetId: code("PO", 7104),
        summary: `Drafted ${code("PO", 7104)} — cover below lead time.`,
        model: "seed",
        confidence: 0.71,
        createdAt: d("-2d"),
      },
      {
        actorType: "AGENT",
        actorLabel: "Quality agent",
        action: "ncr.open",
        targetType: "NCR",
        targetId: code("NCR", 300),
        summary: `Opened ${code("NCR", 300)} — ${characteristic} over UCL.`,
        model: "seed",
        confidence: 0.68,
        createdAt: d("-3d"),
      },
      {
        actorType: "SYSTEM",
        actorLabel: "system",
        action: "workflow.run",
        targetType: "Workflow",
        targetId: workflows[0]?.name ?? "workflow",
        summary: "Scheduled workflow completed.",
        createdAt: d("-1d"),
      },
    ],
  });

  return {
    suppliers: suppliers.length,
    parts: parts.length,
    purchaseOrders: poRows.length,
    robots: robots.length,
    projects: projects.length,
    workflows: workflows.length,
  };
}
