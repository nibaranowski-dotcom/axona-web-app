# AI-Native ERP for Robotics — Module Domains

Model: **Core = horizontal overview** across everything; every other module is a **vertical** that owns its own data and feeds summary signals up to Core. One app per domain.

---

## ⌂ Core — the home module
The command center. The only screen that reads horizontally across all domains.
- KPI tiles per domain (open POs, units built today, fleet uptime, cash position, open quality issues…)
- Cross-module alerts & exceptions ("supplier delay threatens 3 builds", "robot #214 flagged for maintenance")
- Global AI copilot entry point — ask anything across all modules
- Quick links / launchpad into each app

---

## Value chain
| Module | What it owns |
|---|---|
| **Procurement & Supply Chain** | Sourcing, supplier management, components/BOM purchasing, lead-time prediction, multi-tier supply risk |
| **Manufacturing & Production** | Assembly line execution (MES), work orders, build traceability per robot serial, throughput |
| **Inventory & Warehouse** | Parts, sub-assemblies, finished-robot stock, RMA/spares logistics |
| **Quality & Testing** | Inspection, calibration records, test rig data, defect/failure analysis, compliance certs (CE, UL, ISO) |
| **Fulfillment & Delivery** | Outbound logistics for finished robots: order fulfillment, freight/shipping, customs, on-site install, commissioning & handover (sits between Manufacturing and Fleet) |
| **Sales & CRM** | Pipeline, configure-price-quote for complex robot SKUs, contracts |
| **Marketing** | Campaigns, demand-gen, content, attribution |

## Robotics-specific (what makes it *not* a generic ERP)
| Module | What it owns |
|---|---|
| **Fleet & Deployment** | Every deployed robot as an asset: location, uptime, telemetry, OTA firmware versions |
| **Field Service & Maintenance** | Predictive maintenance, dispatch, technician scheduling, parts-at-the-edge |
| **Engineering & PLM** | Product lifecycle, CAD/firmware versioning, change orders (ECO/ECN), hardware-software revision mapping |
| **Robotics Ops / Autonomy** | Mission data, safety incidents, performance/SLA monitoring across the fleet |

## Back office
| Module | What it owns |
|---|---|
| **Finance & Accounting** | GL, AP/AR, revenue recognition (incl. robotics-as-a-service / subscription), unit economics per robot |
| **People / HR** | Workforce, technician certifications, skills |
| **IT & Security** | Identity/access, device security posture, OT/IT segmentation, compliance |
| **Legal & Compliance** | Contracts, liability/safety regulation, export controls |

---

## The AI-native layer (cross-cutting)
Not a module — a layer present in every screen.
- **Agents / Copilot** — a conversational layer over every domain ("why did line 3 slow down?", "reorder this part", "which robots are at risk this week?")
