# PRD — PLM.1 · The Unit spine + configuration/test data model

**Story:** PLM.1 — Introduce the PLM data layer: a first-class **Unit** spine, as-designed BOM + part
revisions, **as-built** records, **time-resolved configuration** (hw + sw), test traceability, field events,
and RCA classification — seeded around one coherent thread. **The prerequisite for every PLM screen.**
**Spec ref:** the PLM MVP spec (Marcel Gordon / ex-VP Product Helsing interview); `specs/PLM-design-brief.md`;
`specs/architecture-learnings.md` (**L1 Foundation — capture fidelity caps the moat**).
**Pri/size:** P0 · L. **Track:** PLM (E15). **Depth:** Full CPRD — **moat-load-bearing** (this *is* the
capture layer the whole moat compounds on).
**Deps:** ONT.1 (EntityLink — the golden thread), MFG (`WorkOrderMfg`), FLEET (`Robot`), ENG (`ECO`,
firmware), QUAL (`NCR`, `SpcSample`), PROC/INV (`Part`, `Supplier`). **Downstream:** every PLM screen story.

## Delivery split — build as **PLM.1a** then **PLM.1b** (two stories, two commits)

The CRO's wedge ruling (2026-07-20) keeps **Procurement** as the commercial wedge and treats PLM as a
**module** (domain #15), not a pivot — *CLAUDE.md's "Wedge = Procurement" stands; do not rewrite it.* Only part
of this model serves the wedge demo today, so ship it in two halves with a clean stop point between them:

**PLM.1a — the commercial slice (build first).** `ProductModel` · `PartMaster` · `PartRevision` · `BomLine` ·
**`Unit`** · `AsBuiltRecord` · `SoftwareRelease` · **`UnitSoftwareState`** · `ConfigurationVersion` · the
`EntityType` extensions · the seed thread · `resolveConfigAt` · `asBuiltDiff` · `affectedUnits` · CSV import.
This answers Q1, Q2 and most of Q5, strengthens the existing procurement demo, and covers the two things the
prospect resonated hardest on (per-unit config genealogy; fault → order the exact part).

**PLM.1b — the deferred tier (build after the stop point).** `TestRun` · `TestResult` · `FieldEvent` ·
`ChangeRequest` · `NCR.rootCause` + its links · `freezeConfigSnapshot`. No buyer has budget against these yet;
they're being built by founder decision, not by evidence. Keep them cleanly separable so the program can stop
after 1a if time compresses.
> **BUILT (PLM.1b, 2026-07-23).** Shipped on the PLM.1a spine (not a refork): the four models + the
> `RootCause`/`FieldEventKind`/`TestOutcome`/`ChangeState` enums + `TEST_RUN`/`FIELD_EVENT` EntityType members;
> `NCR.rootCause` + unit/test/field links + frozen `configSnapshot`; `ECO.changeRequestId`; **`freezeConfigSnapshot`**
> (immutable, never recomputed on read). Seed extends the SN-2208 thread: **TR-8841** FAIL (frozen to the
> post-upgrade config v4.2.1) vs prior **TR-8802** PASS (frozen to v4.1.0) — the test explorer's "how the builds
> differed"; **NCR-118** rootCause = component + links; a **gripper-swap FieldEvent** (field_modification, approved)
> at Site-3; **ECR-118** → ECO-318. All four models in `TENANT_MODELS`; migration hand-generated via
> `migrate diff` (schema-to-schema, no `tsv` drop — MIGRATE.1); `migrate status` clean; per-tenant isolation holds.
> Gate: `verify:plm-1b` (11 checks) incl. **a frozen snapshot resisting a live config change** and **a
> field_modification changing `resolveConfigAt(now)` but not a prior frozen snapshot**. This unblocks PLM.6–10 + PLM.V2/V5.

**Billing meter (CRO note — model for it now):** pricing will be **per module, metered by units under
management**, so **`Unit` is also the billing meter**. Give `Unit` a clean, countable, org-scoped identity with
a lifecycle status that distinguishes billable states — BILL.1 will meter on exactly this. Do **not** build
metering here; just don't model `Unit` in a way that makes it impossible.

**Copy guardrail (CRO note):** never lead with a category word in-product — "ERP" invites SAP, "PLM" invites
the incumbents our buyers actively reject. Lead with the pain. Engineering-facing copy is *"configuration
management and traceability"*; business-facing is *"the operating system for how robotics companies run."*
(This lands concretely on the Engineering nav label in PLM.V1.)

## Why this exists

The product must let a user answer five questions. Today it can answer roughly one and a half:

| # | Question | Today |
|---|---|---|
| 1 | As-designed vs as-built — what got substituted? | ✗ as-built captured informally; **no design intent to diff against** |
| 2 | Exact hw + sw version per unit | ✗ `Robot.firmware` is a **single scalar** — no history, no resolved config |
| 3 | This test result — which unit, which config, what conditions? | ✗ no test entities at all (`SpcSample` is process monitoring, not test traceability) |
| 4 | Root cause: software/hardware/design/production/component/field-mod? | ~ NCRs exist, **no root-cause taxonomy**, no config evidence |
| 5 | What changed, who approved, from when, which units affected? | ~ ECOs + approvals exist; **no effectivity, no rollout, no as-built linkage** |

The blocking structural gap: **a physical unit has no single identity.** It's split across `WorkOrderMfg`
(build) and `Robot` (deployed). Until those resolve to one **Unit**, config-at-time cannot exist, and neither
can any of the five answers.

## Goals

1. **`Unit` spine** — one entity per physical unit (keyed by serial), spanning build → test → deploy → field.
   `WorkOrderMfg` becomes its build record; `Robot` becomes its deployment record. **Non-breaking**: both keep
   working; backfill `Unit` from existing serials.
2. **Design side** — `ProductModel` (+ design revisions), `PartMaster`/`PartRevision` (rev, effectivity,
   originating ECO), multi-level **as-designed `BomLine`**.
3. **As-built** — `AsBuiltRecord` per BOM position: the *actual* PartRevision + lot/serial installed, by whom,
   when → enables the **diff** and substitution flags.
4. **Configuration (time-resolved)** — `SoftwareRelease`, `UnitSoftwareState` (**time-series**, effectiveFrom→To),
   and `ConfigurationVersion` (the named, lockable, baselineable resolved hw+sw combination).
5. **Evidence** — `TestRun` (with a **frozen config snapshot**, environment/conditions, operator, procedure) +
   `TestResult` (per-step measurement, pass/fail); `FieldEvent` (fault · maintenance · repair · **field
   modification**) carrying config-at-time.
6. **RCA + governance** — `NCR.rootCause` enum (`software | hardware | design | production | component |
   field_modification`) + links to unit/config/test/field event; `ChangeRequest` (ECR) → existing `ECO`
   extended with **effectivity** + **rollout status**.
7. **Extend the golden thread** — new `EntityType` members so `getBlastRadius` traverses units, configs, test
   runs, field events, part revisions (LOT/UNIT already exist).
8. **Seed one coherent thread** (below) so every PLM screen has real, connected data.

## The canonical demo thread (seed this exactly — all screens share it)

```
Unit SN-2208
  └─ as-built: SERVO-204 rev B, lot 88421   ← substitution vs as-designed (SERVO-204 rev C)
       └─ lot 88421 QUARANTINED
            └─ NCR-118 (drive torque over UCL) · rootCause = component
                 └─ ECO-318: supersede SERVO-204 → SERVO-205 · effectivity from serial SN-2210
                      └─ affected units (blast radius) → field service dispatch
  └─ config: HW rev B + firmware v4.2 → ConfigurationVersion "SBX-B-4.2" (baselined)
  └─ tests: TR-8841 FAIL (frozen config snapshot = SBX-B-4.2) · prior TR-8802 PASS on SBX-B-4.1
  └─ field event: gripper swap at Site-3 (field modification → config drift, recorded + approved)
```

This continues the **existing** ONT.1 thread (NCR-118 · SERVO-204/205 · lot 88421 · ECO-318 already seeded) —
extend it, don't fork it. Anonymized customers/sites only (SEED.1).

## Data model (via `prisma migrate dev` — **NEVER `db push`**, MIGRATE.1)

```prisma
enum RootCause { software hardware design production component field_modification }
enum FieldEventKind { fault maintenance repair field_modification }
enum TestOutcome { pass fail aborted }
enum ChangeState { draft in_review approved rejected released }

model ProductModel   { id, orgId, code, name, designRevision, …            }  // e.g. a picking cell
model PartMaster     { id, orgId, partNumber, description, category,
                       lifecycleStatus, approvedVendorIds …                }
model PartRevision   { id, orgId, partMasterId, rev, effectiveFrom,
                       effectiveTo?, originatingEcoId? …                   }
model BomLine        { id, orgId, productModelId, designRevision,
                       parentLineId?  /* multi-level */, position,
                       partRevisionId, qty …                               }
model Unit           { id, orgId, serial @unique(per org), productModelId,
                       buildDate?, status, siteLabel?, customerLabel?,
                       workOrderMfgId?, robotId?  /* the two legacy anchors */ }
model AsBuiltRecord  { id, orgId, unitId, bomPosition, partRevisionId,
                       lotCode?, componentSerial?, installedById?,
                       installedAt, isSubstitution Boolean, note? …        }
model SoftwareRelease{ id, orgId, component, version, notes? …             }
model UnitSoftwareState { id, orgId, unitId, softwareReleaseId,
                          effectiveFrom, effectiveTo? …                    }  // TIME-SERIES
model ConfigurationVersion { id, orgId, name, productModelId,
                             hwSpec Json, swSpec Json, isBaseline Boolean,
                             lockedAt?, lockedById? …                      }
model TestRun        { id, orgId, code, unitId, procedure, operatorId?,
                       startedAt, outcome TestOutcome,
                       configSnapshot Json  /* FROZEN — never recomputed */,
                       environment Json?  /* temp/humidity/rig */ …        }
model TestResult     { id, orgId, testRunId, step, measurement Float?,
                       unitOfMeasure?, lowerLimit?, upperLimit?, passed …  }
model FieldEvent     { id, orgId, unitId, kind FieldEventKind, summary,
                       occurredAt, configSnapshot Json, approvedById? …    }
model ChangeRequest  { id, orgId, code, title, rationale, state ChangeState,
                       ecoId? …                                            }
```

Extend existing (additive only):
- `NCR` → `rootCause RootCause?`, `unitId?`, `testRunId?`, `fieldEventId?`, `configSnapshot Json?`.
- `ECO` → `effectiveFromSerial?`, `effectiveFromDate?`, `rolloutStatus`, `changeRequestId?`.
- `EntityType` (ONT.1) → add `TEST_RUN`, `CONFIG_VERSION`, `FIELD_EVENT`, `PART_REVISION`, `PRODUCT_MODEL`
  (`UNIT` and `LOT` already exist).

**Tenancy:** every new model carries `orgId` + FK→Org(Cascade) and is added to **`TENANT_MODELS`** in
`packages/db/src/client.ts` (per-tenant isolation is a moat invariant). `migrate status` clean.
**Indexes:** `@@unique([orgId, serial])` on Unit; `@@index([orgId, unitId])` on AsBuiltRecord /
UnitSoftwareState / TestRun / FieldEvent; `@@index([unitId, effectiveFrom])` for config-at-time resolution.

## Core logic (`packages/db/src/plm/`)

- **`resolveConfigAt(db, unitId, at: Date)`** — the keystone. Returns the unit's resolved hw (as-built) + sw
  (`UnitSoftwareState` valid at `at`) → matched `ConfigurationVersion` if one matches. Every "what was it
  running *then*" answer routes through this.
- **`asBuiltDiff(db, unitId)`** — align `AsBuiltRecord` against the as-designed `BomLine` set by position →
  `{ position, expected, actual, isSubstitution, lot }[]` + a summary. **Substitutions are normal, not errors.**
- **`freezeConfigSnapshot(db, unitId, at)`** — materialize an immutable JSON snapshot for `TestRun.configSnapshot`
  / `FieldEvent.configSnapshot`. **Frozen at write time; never recomputed on read** (a test result is
  inseparable from the config it ran on).
- **`affectedUnits(db, { lot? , partRevision?, softwareRelease?, ecoId? })`** — reuse **ONT.1 `getBlastRadius`**
  where possible; this is the typed façade the Blast-radius screen and ECO impact block call.
- **CSV import** — `importUnits(csv)` / `importBom(csv)`: header-mapped, dry-run + row-level errors, idempotent
  by serial / (model, revision, position). **Time-to-value is a requirement, not a nicety.**

## Guardrails

- **As-built is captured, never reconstructed** (architecture invariant). `AsBuiltRecord` is written at build
  time; nothing infers it later.
- **Frozen snapshots are immutable** — `TestRun.configSnapshot` / `FieldEvent.configSnapshot` are written once.
- **Non-breaking retrofit** — Fleet/Manufacturing screens keep reading `Robot`/`WorkOrderMfg`; `Unit` links
  them. Backfill from existing serials; no data loss; existing verifies stay green.
- **Per-tenant isolation** — all new models in `TENANT_MODELS`; a second org sees zero of the first's units.
- Migration via `migrate dev` only; `migrate status` clean; seed/verify self-clean (MIGRATE.1); SEED.1
  anonymization holds (no real marques/customers).

## Verify + gate (`src/scripts/verify-plm-1.ts`)

1. All new models exist + are in `TENANT_MODELS`; `migrate status` clean; existing verifies still green
   (non-breaking retrofit).
2. `Unit` backfilled from existing serials; SN-2208 exists and links its build + deployment records.
3. `asBuiltDiff(SN-2208)` returns ≥1 **substitution** (SERVO-204 rev B installed where rev C was designed),
   flagged with lot 88421.
4. `resolveConfigAt(SN-2208, t_test)` returns the hw+sw resolved **at that time**, and differs from
   `resolveConfigAt(SN-2208, now)` after the field-modification event (time-resolution actually works).
5. `TestRun` TR-8841 carries a **frozen** `configSnapshot`; mutating current config does **not** change it.
6. NCR-118 carries `rootCause = component` and links unit + test run.
7. ECO-318 has effectivity (from SN-2210) and `affectedUnits(eco)` returns a real multi-unit set via ONT.1.
8. CSV import: a sample units CSV + BOM CSV import idempotently; re-import is a no-op; malformed rows report
   row-level errors without partial corruption.
9. Per-tenant isolation: a second org resolves **zero** of the first org's units/configs/tests.
CI gate: install --frozen-lockfile · lint · turbo typecheck · verify:all · **pnpm build** · `migrate status`
clean; commit + push; Actions green.

## Review gate

Stop after PLM.1; show: the migration, the Unit backfill (SN-2208 linked to its build + deployment records),
the as-built diff surfacing the SERVO-204 substitution, `resolveConfigAt` returning different configs before
and after the field modification, the frozen test snapshot resisting a config change, and CSV import running
twice with no duplication.
