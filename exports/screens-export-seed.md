# Axona — deck screen export · SEED (investor) deck

Simplified, deck-ready crops of built product screens for the seed deck
(`content.md` + `content-addon-product.md`). Each block has a self-contained HTML
snippet (~1200×750, inline CSS, v2 tokens, no external deps) the deck designer drops
into a browser frame on the named slide.

**Built/designed line (honest):** every screen below is **built** in the app and verified
live (Procurement, Manufacturing genealogy, Command Center, Workflows, Launcher/module
map). #5 Cross-module ripple is a **diagram in v2 style, not a literal screen** (as the
export instruction specifies) — labelled as such on the slide.

**Human gate:** anonymization + "sample data — illustrative" labels are for Nicolas to
sign off before anything goes external. All companies/people are anonymized (Tier-1 Auto
OEM / OEM-2 / role labels); every crop carries a sample-data chip.

## Screen → slide map
| # | Screen | Slide | Proves |
|---|--------|-------|--------|
| 1 | Procurement co-pilot (PO queue + agent-drafted row + approve + trace) | Slide 3 · Solution | AI proposes, human approves — the wedge |
| 2 | Build genealogy (per-serial parts/serials/firmware, as-built) | Slide 3 · Moat | Per-unit data substrate that compounds |
| 3 | Command Center (cross-module KPI rollup + exception feed) | Slide 6 · Product | OS breadth across the robot lifecycle |
| 4 | Workflow run console (agent-orchestration trace lighting up steps) | Slide 9 · Moat | Multi-agent orchestration under approval gates |
| 5 | Cross-module ripple (Quality→Eng→Procurement→Fulfillment→Field→Finance→Legal) | "How it works in one story" | One event, one system — not point tools |
| 6 | Module map grid (Core / Value chain / Robotics / Back office) | Slide 6 · appendix | The whole lifecycle in one product |

---

### PROCUREMENT CO-PILOT → Slide 3 · Solution
- **Purpose on the slide:** the wedge — agents draft a purchase order, a human approves; every gated action carries model · confidence · approver.
- **Crop:** the agent reorder banner + the PO queue (agent-drafted row highlighted with the Approve action) + a compact agent trace. Hide the full sidebar/topbar.
- **Caption (on-slide):** "Procurement — agent-drafted PO awaiting approval · sample data"

```html
<div id="seed1" style="width:1200px;height:750px;font-family:'Archivo',system-ui,sans-serif;background:#fff;color:#0a0a0a;box-sizing:border-box;padding:34px 40px;position:relative">
  <style>
    #seed1 *{box-sizing:border-box}
    #seed1 .eyebrow{font-family:'JetBrains Mono',ui-monospace,monospace;font-size:11px;letter-spacing:.14em;text-transform:uppercase;color:rgba(10,10,10,.5)}
    #seed1 .h1{font-size:26px;font-weight:700;letter-spacing:-.01em;margin:2px 0 0}
    #seed1 .chip{font-family:'JetBrains Mono',ui-monospace,monospace;font-size:10px;letter-spacing:.06em;text-transform:uppercase;color:rgba(10,10,10,.5);border:1px solid rgba(10,10,10,.14);border-radius:999px;padding:4px 10px}
    #seed1 .lime{background:#c6f24f;color:#0a0a0a;border:none;border-radius:8px;padding:9px 16px;font-size:14px;font-weight:600;font-family:inherit}
    #seed1 .mono{font-family:'JetBrains Mono',ui-monospace,monospace}
    #seed1 table{width:100%;border-collapse:collapse}
    #seed1 th{font-family:'JetBrains Mono',ui-monospace,monospace;font-size:10px;letter-spacing:.08em;text-transform:uppercase;color:rgba(10,10,10,.45);text-align:left;padding:10px 14px;border-bottom:1px solid rgba(10,10,10,.12)}
    #seed1 td{font-size:14px;padding:13px 14px;border-bottom:1px solid rgba(10,10,10,.08)}
    #seed1 .badge{font-family:'JetBrains Mono',ui-monospace,monospace;font-size:11px;padding:3px 9px;border-radius:6px;display:inline-flex;align-items:center;gap:6px}
    #seed1 .dot{width:7px;height:7px;border-radius:50%;display:inline-block}
  </style>

  <div style="display:flex;align-items:flex-start;justify-content:space-between">
    <div>
      <div class="eyebrow">Value chain · Procurement · 12 POs</div>
      <div class="h1">Procurement</div>
    </div>
    <div style="display:flex;align-items:center;gap:12px">
      <span class="chip">sample data — illustrative</span>
      <button class="lime">Draft PO</button>
    </div>
  </div>

  <!-- agent recommendation banner -->
  <div style="margin-top:22px;border:1px solid rgba(10,10,10,.14);border-left:3px solid #c6f24f;border-radius:12px;padding:15px 18px;display:flex;align-items:center;justify-content:space-between;background:#fff">
    <div>
      <div style="font-size:15px;font-weight:600">Sourcing agent recommends a reorder</div>
      <div class="mono" style="font-size:12px;color:rgba(10,10,10,.55);margin-top:3px">2 parts at or below reorder point — DRIVE-204 0/20 · DRIVE-205 6/20</div>
    </div>
    <div class="mono" style="font-size:11px;color:rgba(10,10,10,.5)">model claude-sonnet · confidence 0.83</div>
  </div>

  <!-- filter chips -->
  <div style="margin-top:20px;display:flex;gap:8px;align-items:center">
    <span class="mono" style="font-size:12px;background:#0a0a0a;color:#fff;padding:6px 12px;border-radius:7px">All 12</span>
    <span class="mono" style="font-size:12px;color:rgba(10,10,10,.55);padding:6px 12px">Awaiting approval 1</span>
    <span class="mono" style="font-size:12px;color:rgba(10,10,10,.55);padding:6px 12px">Agent-drafted 8</span>
    <span class="mono" style="font-size:12px;color:rgba(10,10,10,.55);padding:6px 12px">Sent 3</span>
  </div>

  <table style="margin-top:8px">
    <tr><th>PO</th><th>Item</th><th>Vendor</th><th>Value</th><th style="text-align:right">Status</th></tr>
    <tr><td class="mono">PO-9001</td><td>DRIVE-204 · qty 50</td><td>Bearings Ltd</td><td class="mono">$42,000</td><td style="text-align:right"><span class="badge" style="background:rgba(31,158,111,.12);color:#1f9e6f"><span class="dot" style="background:#1f9e6f"></span>Sent</span></td></tr>
    <tr><td class="mono">PO-9002</td><td>DRIVE-204 · qty 24</td><td>Actuator Co (T1)</td><td class="mono">$86,400</td><td style="text-align:right"><span class="badge" style="background:rgba(31,158,111,.12);color:#1f9e6f"><span class="dot" style="background:#1f9e6f"></span>Received</span></td></tr>
    <tr style="background:rgba(198,242,79,.10)">
      <td class="mono">PO-9007</td>
      <td>DRIVE-205 · qty 24<br><span class="mono" style="font-size:11px;color:rgba(10,10,10,.5)">Drafted by agent · conf 0.83 · approver: Ops lead</span></td>
      <td>Actuator Co (T1)</td>
      <td class="mono">$91,200</td>
      <td style="text-align:right;white-space:nowrap">
        <span class="badge" style="background:#c6f24f;color:#0a0a0a;margin-right:8px">Awaiting approval</span>
        <button style="font-family:inherit;font-size:12px;border:1px solid rgba(10,10,10,.18);background:#fff;border-radius:6px;padding:6px 10px">Reject</button>
        <button style="font-family:inherit;font-size:12px;border:none;background:#c6f24f;color:#0a0a0a;font-weight:600;border-radius:6px;padding:6px 12px">Approve</button>
      </td>
    </tr>
    <tr><td class="mono">PO-9008</td><td>REDUCER-70 · qty 40</td><td>Reducer Co</td><td class="mono">$18,400</td><td style="text-align:right"><span class="badge" style="background:rgba(10,10,10,.06);color:rgba(10,10,10,.6)">Approved</span></td></tr>
    <tr><td class="mono">PO-9012</td><td>REDUCER-70 · qty 20<br><span class="mono" style="font-size:11px;color:rgba(10,10,10,.5)">Drafted by agent</span></td><td>Reducer Co</td><td class="mono">$9,200</td><td style="text-align:right"><span class="badge" style="background:rgba(10,10,10,.06);color:rgba(10,10,10,.6)">Drafted</span></td></tr>
  </table>

  <!-- agent trace -->
  <div style="position:absolute;left:40px;right:40px;bottom:28px;background:#0a0a0a;border-radius:12px;padding:14px 18px;font-family:'JetBrains Mono',ui-monospace,monospace;font-size:11px;line-height:1.85;color:rgba(255,255,255,.72)">
    <span style="color:rgba(255,255,255,.5);letter-spacing:.08em">TRACE · proc-orchestrator</span><br>
    <span style="color:rgba(255,255,255,.4)">09:41</span>&nbsp; scan &nbsp;· 2 parts ≤ reorder point &nbsp;&nbsp; <span style="color:rgba(255,255,255,.4)">09:41</span>&nbsp; draft &nbsp;· PO-9007 DRIVE-205 ×24 &nbsp;&nbsp; <span style="color:#c6f24f">await approval</span>
  </div>
</div>
```

---

### BUILD GENEALOGY → Slide 3 · Moat
- **Purpose on the slide:** per-unit genealogy captured **as-built** (parts · serials · firmware) — the proprietary substrate that compounds.
- **Crop:** one serial's station trace with the captured parts/serials/firmware per station; one station on HOLD linked to a quality flag. Hide throughput/other panels.
- **Caption (on-slide):** "Build genealogy — as-built parts · serials · firmware per unit · sample data"

```html
<div id="seed2" style="width:1200px;height:750px;font-family:'Archivo',system-ui,sans-serif;background:#fff;color:#0a0a0a;box-sizing:border-box;padding:34px 44px">
  <style>
    #seed2 *{box-sizing:border-box}
    #seed2 .eyebrow{font-family:'JetBrains Mono',ui-monospace,monospace;font-size:11px;letter-spacing:.14em;text-transform:uppercase;color:rgba(10,10,10,.5)}
    #seed2 .h1{font-size:25px;font-weight:700;margin:2px 0 0}
    #seed2 .chip{font-family:'JetBrains Mono',ui-monospace,monospace;font-size:10px;letter-spacing:.06em;text-transform:uppercase;color:rgba(10,10,10,.5);border:1px solid rgba(10,10,10,.14);border-radius:999px;padding:4px 10px}
    #seed2 .mono{font-family:'JetBrains Mono',ui-monospace,monospace}
    #seed2 .station{display:flex;align-items:flex-start;gap:16px;padding:16px 0;border-bottom:1px solid rgba(10,10,10,.08)}
    #seed2 .node{width:16px;height:16px;border-radius:50%;flex:none;margin-top:3px}
    #seed2 .st-name{font-size:16px;font-weight:600}
    #seed2 .built{font-family:'JetBrains Mono',ui-monospace,monospace;font-size:12px;color:rgba(10,10,10,.6);margin-top:4px}
    #seed2 .stat{font-family:'JetBrains Mono',ui-monospace,monospace;font-size:11px;padding:3px 9px;border-radius:6px}
  </style>

  <div style="display:flex;align-items:flex-start;justify-content:space-between">
    <div><div class="eyebrow">Manufacturing · as-built genealogy</div><div class="h1">Build genealogy · SN-0208</div></div>
    <span class="chip">sample data — illustrative</span>
  </div>
  <div class="mono" style="font-size:12px;color:rgba(10,10,10,.55);margin-top:10px">Product AX-2 · 6-station line · captured at each station — never reconstructed</div>

  <div style="margin-top:18px">
    <div class="station"><span class="node" style="background:#1f9e6f"></span><div style="flex:1"><div style="display:flex;justify-content:space-between"><span class="st-name">Frame build</span><span class="stat" style="background:rgba(31,158,111,.12);color:#1f9e6f">Done</span></div><div class="built">FRM-88 · s/n F88-0208 · 2026-06-27 09:12</div></div></div>
    <div class="station"><span class="node" style="background:#1f9e6f"></span><div style="flex:1"><div style="display:flex;justify-content:space-between"><span class="st-name">Drive integration</span><span class="stat" style="background:rgba(31,158,111,.12);color:#1f9e6f">Done</span></div><div class="built">DRIVE-204 · s/n D204-1183 · lot 88421 · 2026-06-29</div></div></div>
    <div class="station"><span class="node" style="background:#1f9e6f"></span><div style="flex:1"><div style="display:flex;justify-content:space-between"><span class="st-name">Actuators</span><span class="stat" style="background:rgba(31,158,111,.12);color:#1f9e6f">Done</span></div><div class="built">ACT-205 ×2 · s/n A205-0461 / 0462 · 2026-07-01</div></div></div>
    <div class="station"><span class="node" style="background:#1f9e6f"></span><div style="flex:1"><div style="display:flex;justify-content:space-between"><span class="st-name">Firmware</span><span class="stat" style="background:rgba(31,158,111,.12);color:#1f9e6f">Done</span></div><div class="built">flashed fw v4.2.1 · signed · 2026-07-02</div></div></div>
    <div class="station" style="background:rgba(198,242,79,.12);border-radius:10px;padding:16px 12px"><span class="node" style="background:#0a0a0a"></span><div style="flex:1"><div style="display:flex;justify-content:space-between;align-items:center"><span class="st-name">Test</span><span class="stat" style="background:#0a0a0a;color:#fff">HOLD</span></div><div class="built">payload torque +4% over UCL → opened NCR-118 · lot 88421</div></div></div>
    <div class="station" style="border-bottom:none"><span class="node" style="background:rgba(10,10,10,.15)"></span><div style="flex:1"><div style="display:flex;justify-content:space-between"><span class="st-name" style="color:rgba(10,10,10,.5)">Pack-out</span><span class="stat" style="background:rgba(10,10,10,.06);color:rgba(10,10,10,.5)">Pending</span></div><div class="built" style="color:rgba(10,10,10,.4)">blocked on Test</div></div></div>
  </div>
</div>
```

---

### COMMAND CENTER → Slide 6 · Product
- **Purpose on the slide:** the operating system view — one KPI rollup across every module + a live exception feed.
- **Crop:** the 5-tile KPI strip + the module-health grid + a short "needs attention" feed. Anonymized. Hide the Ask-Axona composer detail.
- **Caption (on-slide):** "Command Center — cross-module rollup + exception feed · sample data"

```html
<div id="seed3" style="width:1200px;height:750px;font-family:'Archivo',system-ui,sans-serif;background:#fff;color:#0a0a0a;box-sizing:border-box;padding:32px 40px;background-image:radial-gradient(rgba(10,10,10,.05) 1px,transparent 1px);background-size:20px 20px">
  <style>
    #seed3 *{box-sizing:border-box}
    #seed3 .eyebrow{font-family:'JetBrains Mono',ui-monospace,monospace;font-size:11px;letter-spacing:.14em;text-transform:uppercase;color:rgba(10,10,10,.5)}
    #seed3 .h1{font-size:24px;font-weight:700;margin:2px 0 0}
    #seed3 .chip{font-family:'JetBrains Mono',ui-monospace,monospace;font-size:10px;letter-spacing:.06em;text-transform:uppercase;color:rgba(10,10,10,.5);border:1px solid rgba(10,10,10,.14);border-radius:999px;padding:4px 10px;background:#fff}
    #seed3 .mono{font-family:'JetBrains Mono',ui-monospace,monospace}
    #seed3 .tile{background:#fff;border:1px solid rgba(10,10,10,.12);border-radius:12px;padding:14px 16px}
    #seed3 .big{font-size:24px;font-weight:700}
    #seed3 .lbl{font-family:'JetBrains Mono',ui-monospace,monospace;font-size:9.5px;letter-spacing:.08em;text-transform:uppercase;color:rgba(10,10,10,.5);margin-top:4px}
    #seed3 .card{background:#fff;border:1px solid rgba(10,10,10,.12);border-radius:11px;padding:12px 14px}
    #seed3 .cnum{font-size:20px;font-weight:700;margin-top:2px}
    #seed3 .sub{font-size:11px;color:rgba(10,10,10,.5);margin-top:3px}
  </style>

  <div style="display:flex;align-items:flex-start;justify-content:space-between">
    <div><div class="eyebrow">Command Center · 12 modules</div><div class="h1">Command center</div></div>
    <span class="chip">sample data — illustrative</span>
  </div>

  <div style="display:grid;grid-template-columns:repeat(5,1fr);gap:12px;margin-top:18px">
    <div class="tile"><div class="big">8</div><div class="lbl">Open exceptions</div></div>
    <div class="tile"><div class="big">10</div><div class="lbl">Units in build</div></div>
    <div class="tile"><div class="big">97.1%</div><div class="lbl">Fleet uptime</div></div>
    <div class="tile"><div class="big">$3.39M</div><div class="lbl">Net (Q2)</div></div>
    <div class="tile"><div class="big">5</div><div class="lbl">Open quality issues</div></div>
  </div>

  <div style="display:grid;grid-template-columns:2fr 1fr;gap:16px;margin-top:16px">
    <div style="display:grid;grid-template-columns:repeat(3,1fr);gap:10px">
      <div class="card"><span class="lbl">Procurement</span><div class="cnum">12</div><div class="sub">Open POs · awaiting 2</div></div>
      <div class="card"><span class="lbl">Manufacturing</span><div class="cnum">10</div><div class="sub">In build · 1 on hold</div></div>
      <div class="card"><span class="lbl">Quality</span><div class="cnum">5</div><div class="sub">Open NCRs · SPC breach 2</div></div>
      <div class="card"><span class="lbl">Fulfillment</span><div class="cnum">6</div><div class="sub">In transit · at-risk 1</div></div>
      <div class="card"><span class="lbl">Fleet</span><div class="cnum">97.1%</div><div class="sub">Uptime · watch/fault 5</div></div>
      <div class="card"><span class="lbl">Field service</span><div class="cnum">6</div><div class="sub">Work orders · SLA&lt;24h 3</div></div>
    </div>
    <div class="card" style="padding:0;overflow:hidden">
      <div class="lbl" style="padding:12px 14px 6px">Needs attention</div>
      <div style="padding:10px 14px;border-top:1px solid rgba(10,10,10,.08)"><div style="border-left:3px solid #0a0a0a;padding-left:10px"><div style="font-size:13px;font-weight:600">Drive torque over UCL</div><div class="sub mono">Quality · NCR-118 → Eng · Proc</div></div></div>
      <div style="padding:10px 14px;border-top:1px solid rgba(10,10,10,.08)"><div style="border-left:3px solid #c6f24f;padding-left:10px"><div style="font-size:13px;font-weight:600">Delivery held at customs</div><div class="sub mono">Fulfillment · Tier-1 Auto OEM</div></div></div>
      <div style="padding:10px 14px;border-top:1px solid rgba(10,10,10,.08)"><div style="border-left:3px solid rgba(10,10,10,.2);padding-left:10px"><div style="font-size:13px;font-weight:600">HV cert expiring — 12d</div><div class="sub mono">People · Field service dispatch</div></div></div>
    </div>
  </div>
</div>
```

---

### WORKFLOW RUN CONSOLE → Slide 9 · Moat
- **Purpose on the slide:** the moat — many specialized agents orchestrated under an approval gate, with a full trace.
- **Crop:** one workflow run: the step chain lighting up (done → active → gated → pending) + the live orchestration trace. Hide the workflow library list.
- **Caption (on-slide):** "Workflow run — multi-agent orchestration, human-gated · sample data"

```html
<div id="seed4" style="width:1200px;height:750px;font-family:'Archivo',system-ui,sans-serif;background:#fff;color:#0a0a0a;box-sizing:border-box;padding:34px 40px">
  <style>
    #seed4 *{box-sizing:border-box}
    #seed4 .eyebrow{font-family:'JetBrains Mono',ui-monospace,monospace;font-size:11px;letter-spacing:.14em;text-transform:uppercase;color:rgba(10,10,10,.5)}
    #seed4 .h1{font-size:24px;font-weight:700;margin:2px 0 0}
    #seed4 .chip{font-family:'JetBrains Mono',ui-monospace,monospace;font-size:10px;letter-spacing:.06em;text-transform:uppercase;color:rgba(10,10,10,.5);border:1px solid rgba(10,10,10,.14);border-radius:999px;padding:4px 10px}
    #seed4 .mono{font-family:'JetBrains Mono',ui-monospace,monospace}
    #seed4 .step{flex:1;text-align:center;position:relative}
    #seed4 .sdot{width:34px;height:34px;border-radius:50%;margin:0 auto 8px;display:flex;align-items:center;justify-content:center;font-family:'JetBrains Mono',ui-monospace,monospace;font-size:13px;font-weight:600}
    #seed4 .sname{font-size:12.5px;font-weight:600}
    #seed4 .sagent{font-family:'JetBrains Mono',ui-monospace,monospace;font-size:10px;color:rgba(10,10,10,.5);margin-top:2px}
    #seed4 .conn{position:absolute;top:17px;left:50%;width:100%;height:2px;background:rgba(10,10,10,.12);z-index:0}
  </style>

  <div style="display:flex;align-items:flex-start;justify-content:space-between">
    <div><div class="eyebrow">Workflows · run · 6 steps · 5 agents</div><div class="h1">Procurement reorder → approve</div></div>
    <span class="chip">sample data — illustrative</span>
  </div>

  <div style="display:flex;margin-top:36px;position:relative">
    <div class="step"><div class="conn"></div><div class="sdot" style="background:#1f9e6f;color:#fff">1</div><div class="sname">Detect</div><div class="sagent">reorder-agent</div></div>
    <div class="step"><div class="conn"></div><div class="sdot" style="background:#1f9e6f;color:#fff">2</div><div class="sname">Source</div><div class="sagent">sourcing-agent</div></div>
    <div class="step"><div class="conn"></div><div class="sdot" style="background:#1f9e6f;color:#fff">3</div><div class="sname">RFQ</div><div class="sagent">rfq-agent</div></div>
    <div class="step"><div class="conn"></div><div class="sdot" style="background:#c6f24f;color:#0a0a0a">4</div><div class="sname">Draft PO</div><div class="sagent">negotiation-agent</div></div>
    <div class="step"><div class="conn"></div><div class="sdot" style="border:2px dashed rgba(10,10,10,.3);color:rgba(10,10,10,.5)">5</div><div class="sname">Approve gate</div><div class="sagent">human · Ops lead</div></div>
    <div class="step"><div class="sdot" style="background:rgba(10,10,10,.08);color:rgba(10,10,10,.4)">6</div><div class="sname" style="color:rgba(10,10,10,.5)">Audit</div><div class="sagent">event log</div></div>
  </div>

  <div style="display:flex;gap:22px;justify-content:center;margin-top:22px;font-family:'JetBrains Mono',ui-monospace,monospace;font-size:10.5px;color:rgba(10,10,10,.5)">
    <span><span style="display:inline-block;width:9px;height:9px;border-radius:50%;background:#1f9e6f;margin-right:6px"></span>done</span>
    <span><span style="display:inline-block;width:9px;height:9px;border-radius:50%;background:#c6f24f;margin-right:6px"></span>active</span>
    <span><span style="display:inline-block;width:9px;height:9px;border-radius:50%;border:1px dashed rgba(10,10,10,.4);margin-right:6px"></span>human-gated</span>
  </div>

  <div style="margin-top:26px;background:#0a0a0a;border-radius:12px;padding:18px 22px;font-family:'JetBrains Mono',ui-monospace,monospace;font-size:12px;line-height:2;color:rgba(255,255,255,.72)">
    <div style="color:rgba(255,255,255,.5);letter-spacing:.08em;margin-bottom:6px">TRACE · wf-orchestrator</div>
    <div><span style="color:rgba(255,255,255,.4)">09:41:02</span>&nbsp; detect &nbsp;· 2 parts ≤ reorder point</div>
    <div><span style="color:rgba(255,255,255,.4)">09:41:05</span>&nbsp; source &nbsp;· ranked 3 vendors · risk-scored</div>
    <div><span style="color:rgba(255,255,255,.4)">09:41:09</span>&nbsp; rfq &nbsp;&nbsp;· quotes in · lead-time compared</div>
    <div><span style="color:#c6f24f">09:41:12</span>&nbsp; draft &nbsp;· PO-9007 DRIVE-205 ×24 · conf 0.83 → <span style="color:#c6f24f">awaiting approval</span></div>
  </div>
</div>
```

---

### CROSS-MODULE RIPPLE → "How it works in one story" slide
- **Purpose on the slide:** one event ripples across the whole operation — the case for an OS, not point tools. **Diagram in v2 style, not a literal screen.**
- **Crop:** a left-to-right cascade of 7 module nodes from a single quality flag; the origin node is the lime signal.
- **Caption (on-slide):** "One quality flag, seven modules — one system · sample data"

```html
<div id="seed5" style="width:1200px;height:750px;font-family:'Archivo',system-ui,sans-serif;background:#f4f3ef;color:#0a0a0a;box-sizing:border-box;padding:40px 44px;background-image:radial-gradient(rgba(10,10,10,.05) 1px,transparent 1px);background-size:22px 22px">
  <style>
    #seed5 *{box-sizing:border-box}
    #seed5 .eyebrow{font-family:'JetBrains Mono',ui-monospace,monospace;font-size:11px;letter-spacing:.14em;text-transform:uppercase;color:rgba(10,10,10,.5)}
    #seed5 .h1{font-size:25px;font-weight:700;margin:2px 0 0}
    #seed5 .chip{font-family:'JetBrains Mono',ui-monospace,monospace;font-size:10px;letter-spacing:.06em;text-transform:uppercase;color:rgba(10,10,10,.5);border:1px solid rgba(10,10,10,.14);border-radius:999px;padding:4px 10px;background:#fff}
    #seed5 .node{background:#fff;border:1px solid rgba(10,10,10,.14);border-radius:12px;padding:14px 15px;position:relative}
    #seed5 .mlabel{font-family:'JetBrains Mono',ui-monospace,monospace;font-size:9.5px;letter-spacing:.09em;text-transform:uppercase;color:rgba(10,10,10,.5)}
    #seed5 .eff{font-size:13.5px;font-weight:600;margin-top:6px;line-height:1.3}
    #seed5 .arrow{font-family:'JetBrains Mono',ui-monospace,monospace;color:rgba(10,10,10,.35);font-size:18px;text-align:center;align-self:center}
  </style>

  <div style="display:flex;align-items:flex-start;justify-content:space-between">
    <div><div class="eyebrow">How it works · one story</div><div class="h1">One quality flag ripples across the operation</div></div>
    <span class="chip">sample data — illustrative</span>
  </div>

  <div style="display:grid;grid-template-columns:1fr 22px 1fr 22px 1fr 22px 1fr;gap:12px 4px;margin-top:34px">
    <div class="node" style="border-left:3px solid #c6f24f"><div class="mlabel">Quality</div><div class="eff">Torque over UCL → NCR-118</div></div>
    <div class="arrow">→</div>
    <div class="node"><div class="mlabel">Engineering</div><div class="eff">ECO-318 supersede DRIVE-204→205</div></div>
    <div class="arrow">→</div>
    <div class="node"><div class="mlabel">Procurement</div><div class="eff">Re-source PO drafted, gated</div></div>
    <div class="arrow">→</div>
    <div class="node"><div class="mlabel">Fulfillment</div><div class="eff">Delivery flagged at-risk</div></div>
  </div>
  <div style="display:grid;grid-template-columns:1fr 22px 1fr 22px 1fr;gap:12px 4px;margin-top:20px">
    <div class="node"><div class="mlabel">Field service</div><div class="eff">Dispatch scheduled under SLA</div></div>
    <div class="arrow">→</div>
    <div class="node"><div class="mlabel">Finance</div><div class="eff">Unit margin −2.1pt from ECO</div></div>
    <div class="arrow">→</div>
    <div class="node"><div class="mlabel">Legal</div><div class="eff">Contract obligation checked</div></div>
  </div>

  <div style="margin-top:30px;font-family:'JetBrains Mono',ui-monospace,monospace;font-size:12px;color:rgba(10,10,10,.55);text-align:center">
    one event · captured once · reasoned across every module — <span style="color:#0a0a0a">point tools can't</span>
  </div>
</div>
```

---

### MODULE MAP GRID → Slide 6 · appendix
- **Purpose on the slide:** breadth — the whole robot lifecycle in one product, grouped Core / Value chain / Robotics / Back office.
- **Crop:** the launcher's grouped module grid, simplified to labels + a dot per module. Hide search/status chrome.
- **Caption (on-slide):** "One operating system — 20 modules across the lifecycle · sample data"

```html
<div id="seed6" style="width:1200px;height:750px;font-family:'Archivo',system-ui,sans-serif;background:#0a0a0a;color:#fff;box-sizing:border-box;padding:36px 44px;background-image:radial-gradient(rgba(255,255,255,.06) 1px,transparent 1px);background-size:22px 22px">
  <style>
    #seed6 *{box-sizing:border-box}
    #seed6 .eyebrow{font-family:'JetBrains Mono',ui-monospace,monospace;font-size:11px;letter-spacing:.14em;text-transform:uppercase;color:rgba(255,255,255,.5)}
    #seed6 .h1{font-size:25px;font-weight:700;margin:2px 0 0;color:#fff}
    #seed6 .chip{font-family:'JetBrains Mono',ui-monospace,monospace;font-size:10px;letter-spacing:.06em;text-transform:uppercase;color:rgba(255,255,255,.6);border:1px solid rgba(255,255,255,.2);border-radius:999px;padding:4px 10px}
    #seed6 .group{font-family:'JetBrains Mono',ui-monospace,monospace;font-size:10px;letter-spacing:.1em;text-transform:uppercase;color:rgba(255,255,255,.45);margin:22px 0 10px}
    #seed6 .cell{background:rgba(255,255,255,.04);border:1px solid rgba(255,255,255,.1);border-radius:10px;padding:13px 14px;display:flex;align-items:center;gap:10px}
    #seed6 .d{width:8px;height:8px;border-radius:50%;background:#c6f24f;flex:none}
    #seed6 .nm{font-size:13.5px;font-weight:600}
    #seed6 .grid4{display:grid;grid-template-columns:repeat(4,1fr);gap:10px}
  </style>

  <div style="display:flex;align-items:flex-start;justify-content:space-between">
    <div><div class="eyebrow">Axona · operating system</div><div class="h1">One system across the robot lifecycle</div></div>
    <span class="chip">sample data — illustrative</span>
  </div>

  <div class="group">Core</div>
  <div class="grid4">
    <div class="cell"><span class="d"></span><span class="nm">Command Center</span></div>
    <div class="cell"><span class="d"></span><span class="nm">Agents</span></div>
    <div class="cell"><span class="d"></span><span class="nm">Workflows</span></div>
    <div class="cell"><span class="d"></span><span class="nm">Projects</span></div>
  </div>
  <div class="group">Value chain</div>
  <div class="grid4">
    <div class="cell"><span class="d"></span><span class="nm">Procurement</span></div>
    <div class="cell"><span class="d"></span><span class="nm">Manufacturing</span></div>
    <div class="cell"><span class="d"></span><span class="nm">Inventory</span></div>
    <div class="cell"><span class="d"></span><span class="nm">Fulfillment</span></div>
    <div class="cell"><span class="d"></span><span class="nm">Quality</span></div>
    <div class="cell"><span class="d"></span><span class="nm">Sales &amp; CRM</span></div>
    <div class="cell"><span class="d"></span><span class="nm">Marketing</span></div>
    <div class="cell"><span class="d"></span><span class="nm">Machines</span></div>
  </div>
  <div class="group">Robotics</div>
  <div class="grid4">
    <div class="cell"><span class="d"></span><span class="nm">Fleet</span></div>
    <div class="cell"><span class="d"></span><span class="nm">Field service</span></div>
    <div class="cell"><span class="d"></span><span class="nm">Engineering</span></div>
    <div class="cell"><span class="d"></span><span class="nm">Autonomy</span></div>
  </div>
  <div class="group">Back office</div>
  <div class="grid4">
    <div class="cell"><span class="d"></span><span class="nm">Finance</span></div>
    <div class="cell"><span class="d"></span><span class="nm">People</span></div>
    <div class="cell"><span class="d"></span><span class="nm">Security</span></div>
    <div class="cell"><span class="d"></span><span class="nm">Legal</span></div>
  </div>
</div>
```
