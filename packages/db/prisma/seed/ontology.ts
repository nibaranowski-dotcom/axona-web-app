import type { OrgScopedDb } from "../../src";
import { CODES } from "./constants";

// ONT.1 — the entity-link graph for the NCR-118 blast radius (§3.7 Act 4). Every
// cross-module hop in the seed today is a string/comment with no shared key, so
// the cascade is wired as explicit EntityLink FACTS: resolve each narrative code
// to its REAL record id, then create the typed edges. NCR-118 reaches all seven
// modules within depth 3; NCR-114 (contained) traverses a smaller, real cascade —
// generalization, nothing hardcoded to NCR-118.
//
// Runs LAST in the seed (after value-chain / robotics / back-office / inventory)
// so every referenced record already exists.

type EType =
  | "NCR"
  | "ECO"
  | "PART"
  | "SUPPLIER"
  | "PURCHASE_ORDER"
  | "UNIT"
  | "LOT"
  | "DELIVERY"
  | "WORK_ORDER"
  | "SPC_SAMPLE"
  | "INVOICE";

type Relation =
  | "CAUSED_BY"
  | "AFFECTS"
  | "RESOLVED_BY"
  | "SUPPLIED_BY"
  | "CONTAINS"
  | "SHIPPED_IN"
  | "DISPATCHED_FOR"
  | "IMPACTS";

export async function seedOntology(db: OrgScopedDb): Promise<number> {
  // ── resolve narrative codes → real record ids (throws if a record is missing,
  //    so drift in the upstream seed fails loudly here) ───────────────────────
  const id = async (
    label: string,
    finder: Promise<{ id: string } | null>,
  ): Promise<string> => {
    const r = await finder;
    if (!r) throw new Error(`ONT.1 seed: could not resolve ${label}`);
    return r.id;
  };

  const ncr = (code: string) =>
    id(
      `NCR ${code}`,
      db.nCR.findFirst({ where: { code }, select: { id: true } }),
    );
  const eco = (code: string) =>
    id(
      `ECO ${code}`,
      db.eCO.findFirst({ where: { code }, select: { id: true } }),
    );
  const part = (sku: string) =>
    id(
      `PART ${sku}`,
      db.part.findFirst({ where: { sku }, select: { id: true } }),
    );
  const supplier = (name: string) =>
    id(
      `SUPPLIER ${name}`,
      db.supplier.findFirst({ where: { name }, select: { id: true } }),
    );
  const po = (code: string) =>
    id(
      `PO ${code}`,
      db.purchaseOrder.findFirst({ where: { code }, select: { id: true } }),
    );
  const unit = (serial: string) =>
    id(
      `UNIT ${serial}`,
      db.workOrderMfg.findFirst({ where: { serial }, select: { id: true } }),
    );
  const delivery = (code: string) =>
    id(
      `DELIVERY ${code}`,
      db.delivery.findFirst({ where: { code }, select: { id: true } }),
    );
  const wof = (code: string) =>
    id(
      `WORK_ORDER ${code}`,
      db.workOrderField.findFirst({ where: { code }, select: { id: true } }),
    );
  const invoice = (code: string) =>
    id(
      `INVOICE ${code}`,
      db.invoice.findFirst({ where: { code }, select: { id: true } }),
    );

  // The two drive-torque samples over UCL — the breach evidence behind NCR-118.
  const torque = await db.spcSample.findMany({
    where: { characteristic: "drive_torque_Nm" },
    select: { id: true, value: true, ucl: true },
  });
  const breaches = torque.filter((s) => s.value > s.ucl).map((s) => s.id);
  if (breaches.length < 2)
    throw new Error(
      `ONT.1 seed: expected ≥2 drive-torque breaches, found ${breaches.length}`,
    );
  const [spcA, spcB] = breaches; // 4.3 and 4.5 (the two over UCL 4.2)

  // resolve the shared nodes
  const NCR118 = await ncr(CODES.ncr); // NCR-118
  const NCR114 = await ncr("NCR-114");
  const ECO318 = await eco(CODES.eco); // ECO-318 supersede
  const ECO316 = await eco("ECO-316"); // firmware torque comp
  const SERVO204 = await part(CODES.servoOld); // SERVO-204 actuator
  const LOT = await part("LOT-88421"); // quarantined lot (a Part row)
  const ACTUATOR_CO = await supplier("Tier-1 Actuator Co");
  const PO9002 = await po("PO-9002"); // the received actuator order
  const HX0208 = await unit("HX2-0208"); // held-at-Test unit
  const HX0214 = await unit("HX2-0214"); // a second unit from the lot
  const DLV = await delivery(CODES.delivery); // DLV-3312
  const WO = await wof("WO-5518"); // actuator recalibration
  const INV = await invoice("INV-7741"); // the affected order's invoice

  const E = (
    fromType: EType,
    fromId: string,
    relation: Relation,
    toType: EType,
    toId: string,
    note: string,
  ) => ({ fromType, fromId, relation, toType, toId, note });

  const edges = [
    // ── NCR-118: the full cross-module ripple (7 modules within depth 3) ──────
    E("NCR", NCR118, "CAUSED_BY", "SPC_SAMPLE", spcA!, "drive torque over UCL"),
    E("NCR", NCR118, "CAUSED_BY", "SPC_SAMPLE", spcB!, "drive torque over UCL"),
    E("NCR", NCR118, "CAUSED_BY", "PART", SERVO204, "stiff actuator drive"),
    E(
      "NCR",
      NCR118,
      "RESOLVED_BY",
      "ECO",
      ECO318,
      "supersede SERVO-204 → -205",
    ),
    E("NCR", NCR118, "AFFECTS", "UNIT", HX0208, "unit held at Test"),
    E("ECO", ECO318, "AFFECTS", "PART", SERVO204, "tighter tolerance"),
    E(
      "ECO",
      ECO316,
      "AFFECTS",
      "PART",
      SERVO204,
      "firmware torque compensation",
    ),
    E(
      "PART",
      SERVO204,
      "SUPPLIED_BY",
      "SUPPLIER",
      ACTUATOR_CO,
      "actuator vendor",
    ),
    E(
      "PURCHASE_ORDER",
      PO9002,
      "CONTAINS",
      "PART",
      SERVO204,
      "received actuator order",
    ),
    E("PURCHASE_ORDER", PO9002, "CONTAINS", "LOT", LOT, "the suspect lot"),
    E("LOT", LOT, "SUPPLIED_BY", "SUPPLIER", ACTUATOR_CO, "lot origin"),
    E("LOT", LOT, "AFFECTS", "UNIT", HX0208, "consumed a bad actuator"),
    E("LOT", LOT, "AFFECTS", "UNIT", HX0214, "consumed a bad actuator"),
    E(
      "UNIT",
      HX0208,
      "SHIPPED_IN",
      "DELIVERY",
      DLV,
      "in the affected shipment",
    ),
    E(
      "WORK_ORDER",
      WO,
      "DISPATCHED_FOR",
      "UNIT",
      HX0208,
      "actuator recalibration in the field",
    ),
    E("DELIVERY", DLV, "IMPACTS", "INVOICE", INV, "at-risk order value"),

    // ── NCR-114: contained — its own smaller cascade (generalization) ─────────
    E(
      "NCR",
      NCR114,
      "CAUSED_BY",
      "PART",
      SERVO204,
      "same actuator defect, contained",
    ),
    E(
      "NCR",
      NCR114,
      "RESOLVED_BY",
      "ECO",
      ECO318,
      "contained by the supersede",
    ),
  ];

  await db.entityLink.createMany({ data: edges });
  return edges.length;
}
